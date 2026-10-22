"""
Fine-Tuning MobileNetV3 Small for SmartCity Civic Complaint Classification.
Supports two-phase transfer learning:
  Phase 1: Train the custom classification head with frozen backbone.
  Phase 2: Fine-tune deep feature extraction blocks with differential learning rates.
"""

import os
import sys
import json
import random
import time
import argparse
from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

# Allow running from either repo root or inside ai/training
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from model import (
    build_mobilenet_v3_small,
    freeze_backbone,
    unfreeze_backbone,
    get_device,
    get_model_parameter_stats,
)
from dataset import (
    discover_dataset,
    split_dataset_stratified,
    create_dataloaders,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
)


def set_seed(seed: int = 42) -> None:
    """Sets random seeds for reproducibility."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


def train_one_epoch(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device
) -> Tuple[float, float]:
    """Runs a single training epoch."""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, targets in loader:
        images = images.to(device)
        targets = targets.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += torch.sum(preds == targets).item()
        total += targets.size(0)

    epoch_loss = running_loss / max(total, 1)
    epoch_acc = correct / max(total, 1)
    return epoch_loss, epoch_acc


@torch.no_grad()
def evaluate_epoch(
    model: nn.Module,
    loader: torch.utils.data.DataLoader,
    criterion: nn.Module,
    device: torch.device
) -> Tuple[float, float]:
    """Evaluates the model on validation or test DataLoader."""
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, targets in loader:
        images = images.to(device)
        targets = targets.to(device)

        outputs = model(images)
        loss = criterion(outputs, targets)

        running_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs, 1)
        correct += torch.sum(preds == targets).item()
        total += targets.size(0)

    epoch_loss = running_loss / max(total, 1)
    epoch_acc = correct / max(total, 1)
    return epoch_loss, epoch_acc


def run_training(
    data_dir: str,
    output_dir: str,
    epochs_phase1: int = 5,
    epochs_phase2: int = 5,
    batch_size: int = 16,
    lr_phase1: float = 1e-3,
    lr_phase2: float = 1e-4,
    seed: int = 42,
    patience: int = 3,
    target_classes: List[str] = None
) -> Dict:
    """
    Executes the complete transfer learning and validation loop.
    """
    set_seed(seed)
    device = get_device()
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 70)
    print(" Smart City MobileNetV3 Transfer Learning Pipeline")
    print(f" Target Device: {device} ({'GPU Acceleration' if device.type == 'cuda' else 'CPU'})")
    print(f" Dataset Directory: {data_dir}")
    print(f" Artifact Output: {output_dir}")
    print("=" * 70)

    # 1. Discover data and classes
    samples, class_names, class_to_idx = discover_dataset(data_dir, target_classes)
    num_classes = len(class_names)
    print(f" Discovered {len(samples)} valid images across {num_classes} categories:")
    for idx, cname in enumerate(class_names):
        c_count = sum(1 for s in samples if s[1] == idx)
        print(f"   [{idx}] {cname}: {c_count} images")

    if len(samples) < num_classes * 2:
        raise ValueError(
            f"Insufficient samples ({len(samples)}) for {num_classes} classes. "
            "Please provide at least 2 images per category."
        )

    # 2. Stratified train/val/test splits (test set strictly held out)
    train_samples, val_samples, test_samples = split_dataset_stratified(
        samples, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=seed
    )
    print(f"\n Partitions: Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)}")

    # Save test partition manifest so evaluate.py can evaluate the exact untouched set
    test_manifest_path = os.path.join(output_dir, "test_manifest.json")
    with open(test_manifest_path, "w") as f:
        json.dump({
            "test_samples": test_samples,
            "class_names": class_names,
            "class_to_idx": class_to_idx
        }, f, indent=2)

    # 3. DataLoaders
    train_loader, val_loader, test_loader = create_dataloaders(
        train_samples, val_samples, test_samples, batch_size=batch_size
    )

    # 4. Model initialization
    model = build_mobilenet_v3_small(num_classes=num_classes, pretrained=True)
    model = model.to(device)

    # Compute class weights if imbalanced
    label_counts = np.bincount([s[1] for s in train_samples], minlength=num_classes)
    total_train = len(train_samples)
    weights = [total_train / max(c, 1) for c in label_counts]
    class_weights = torch.tensor(weights, dtype=torch.float).to(device)
    class_weights = class_weights / class_weights.sum() * num_classes
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    best_val_loss = float("inf")
    best_val_acc = 0.0
    best_state_dict = None
    best_epoch = 0

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "phase": []
    }

    # =========================================================================
    # PHASE 1: Head-Only Transfer Learning (Backbone Frozen)
    # =========================================================================
    if epochs_phase1 > 0:
        freeze_backbone(model)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"\n--- Phase 1: Training Classification Head ({epochs_phase1} epochs) ---")
        print(f" Trainable params: {train_p:,} / Total: {total_p:,}")

        optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr_phase1, weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=epochs_phase1, eta_min=1e-5)

        for ep in range(1, epochs_phase1 + 1):
            t0 = time.time()
            t_loss, t_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
            v_loss, v_acc = evaluate_epoch(model, val_loader, criterion, device)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["phase"].append("phase1")

            print(f" [P1 Ep {ep:02d}/{epochs_phase1:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% ({dt:.1f}s)")

            if v_loss < best_val_loss:
                best_val_loss = v_loss
                best_val_acc = v_acc
                best_epoch = ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # =========================================================================
    # PHASE 2: Fine-Tuning Deep Layers (Unfreeze Last Blocks)
    # =========================================================================
    if epochs_phase2 > 0:
        unfreeze_backbone(model, last_n_blocks=3)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"\n--- Phase 2: Fine-Tuning Deeper Layers ({epochs_phase2} epochs) ---")
        print(f" Trainable params: {train_p:,} / Total: {total_p:,}")

        optimizer = AdamW([
            {"params": model.features.parameters(), "lr": lr_phase2 * 0.2},
            {"params": model.classifier.parameters(), "lr": lr_phase2}
        ], weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=epochs_phase2, eta_min=1e-6)

        no_improve = 0
        for ep in range(1, epochs_phase2 + 1):
            t0 = time.time()
            t_loss, t_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
            v_loss, v_acc = evaluate_epoch(model, val_loader, criterion, device)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["phase"].append("phase2")

            print(f" [P2 Ep {ep:02d}/{epochs_phase2:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% ({dt:.1f}s)")

            if v_loss < best_val_loss:
                best_val_loss = v_loss
                best_val_acc = v_acc
                best_epoch = epochs_phase1 + ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
                no_improve = 0
            else:
                no_improve += 1
                if no_improve >= patience:
                    print(f" Early stopping triggered after {patience} epochs without validation loss improvement.")
                    break

    # Save the best model state dict
    weights_path = os.path.join(output_dir, "best_model.pth")
    if best_state_dict is not None:
        torch.save(best_state_dict, weights_path)
    else:
        torch.save(model.state_dict(), weights_path)

    # Save model metadata configuration
    config = {
        "model_name": "MobileNetV3-Small-Civic",
        "architecture": "mobilenet_v3_small",
        "version": "1.0.0",
        "num_classes": num_classes,
        "classes": class_names,
        "class_to_idx": class_to_idx,
        "input_size": [3, IMAGE_SIZE, IMAGE_SIZE],
        "image_size": IMAGE_SIZE,
        "input_mean": IMAGENET_MEAN,
        "input_std": IMAGENET_STD,
        "best_epoch": best_epoch,
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4),
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_samples": {
            "total": len(samples),
            "train": len(train_samples),
            "val": len(val_samples),
            "test": len(test_samples)
        }
    }

    config_path = os.path.join(output_dir, "model_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)

    history_path = os.path.join(output_dir, "training_history.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    print("\n" + "=" * 70)
    print(" Training Completed Successfully!")
    print(f" Best Validation Accuracy: {best_val_acc*100:.2f}% (Loss: {best_val_loss:.4f}) at epoch {best_epoch}")
    print(f" Model weights saved: {weights_path}")
    print(f" Configuration saved: {config_path}")
    print(f" History saved: {history_path}")
    print("=" * 70)

    return config


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train MobileNetV3 for SmartCity civic complaints")
    parser.add_argument("--data-dir", type=str, default=os.path.join(os.path.dirname(__file__), "..", "data"),
                        help="Path to dataset directory with category subfolders")
    parser.add_argument("--output-dir", type=str, default=os.path.join(os.path.dirname(__file__), "..", "models"),
                        help="Path to save model weights and config")
    parser.add_argument("--epochs-phase1", type=int, default=5, help="Epochs for head training")
    parser.add_argument("--epochs-phase2", type=int, default=3, help="Epochs for deep fine-tuning")
    parser.add_argument("--batch-size", type=int, default=16, help="Training batch size")
    parser.add_argument("--lr-phase1", type=float, default=1e-3, help="Phase 1 learning rate")
    parser.add_argument("--lr-phase2", type=float, default=1e-4, help="Phase 2 learning rate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--patience", type=int, default=3, help="Early stopping patience")

    args = parser.parse_args()
    run_training(
        data_dir=os.path.abspath(args.data_dir),
        output_dir=os.path.abspath(args.output_dir),
        epochs_phase1=args.epochs_phase1,
        epochs_phase2=args.epochs_phase2,
        batch_size=args.batch_size,
        lr_phase1=args.lr_phase1,
        lr_phase2=args.lr_phase2,
        seed=args.seed,
        patience=args.patience
    )
