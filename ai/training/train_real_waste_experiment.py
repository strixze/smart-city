"""
Fine-Tuning MobileNetV3 Small on Real Waste Management Images.
Preserves the 6-class civic architecture contract:
  [0] Drainage
  [1] Other
  [2] Roads
  [3] Street Light
  [4] Waste Management
  [5] Water Supply

Saves all experimental artifacts to ai/models_real_data_experiment/
without modifying or overwriting the active production model in ai/models/.
"""

import os
import sys
import json
import random
import time
import hashlib
from datetime import datetime
from collections import Counter
from typing import Dict, List, Tuple, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torchvision.transforms import InterpolationMode
from PIL import Image

# Import existing model helpers
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from model import (
    build_mobilenet_v3_small,
    freeze_backbone,
    unfreeze_backbone,
    get_device,
    get_model_parameter_stats,
)
from dataset import (
    load_and_validate_image,
    IMAGE_SIZE,
    RESIZE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    SUPPORTED_EXTENSIONS
)

SIX_CLASSES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]
CLASS_TO_IDX = {name: idx for idx, name in enumerate(SIX_CLASSES)}
WASTE_CLASS_IDX = CLASS_TO_IDX["Waste Management"]  # 4


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


class RealWasteDataset(Dataset):
    """Dataset for real waste management images with target class index 4."""
    def __init__(self, samples: List[Tuple[str, int]], transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = load_and_validate_image(path)
        if img is None:
            img = Image.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color=(128, 128, 128))
        if self.transform:
            tensor = self.transform(img)
        else:
            tensor = transforms.ToTensor()(img)
        return tensor, label


def get_image_group_key(filename: str) -> str:
    """Extracts burst/session grouping key to prevent data leakage across splits."""
    if filename.startswith("taco_"):
        parts = filename.split("_")
        return f"taco_{parts[1]}"
    elif filename.startswith("360_F_"):
        return "adobe_360"
    elif filename.startswith("photo-"):
        return filename[:15]
    elif filename.startswith("pngtree-"):
        return "pngtree"
    else:
        return filename.split("-")[0]


def group_aware_split(
    files: List[str],
    cat_dir: str,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Partitions files into train/val/test without splitting burst groups."""
    rng = random.Random(seed)
    groups: Dict[str, List[str]] = {}
    for f in files:
        g = get_image_group_key(f)
        groups.setdefault(g, []).append(f)

    sorted_groups = sorted(groups.keys())
    rng.shuffle(sorted_groups)

    total_images = len(files)
    target_train = int(total_images * train_ratio)
    target_val = int(total_images * val_ratio)

    train_files, val_files, test_files = [], [], []

    for g in sorted_groups:
        g_files = groups[g]
        if len(train_files) + len(g_files) <= target_train:
            train_files.extend(g_files)
        elif len(val_files) + len(g_files) <= target_val:
            val_files.extend(g_files)
        else:
            test_files.extend(g_files)

    # Balance if uneven
    all_assigned = set(train_files) | set(val_files) | set(test_files)
    for f in files:
        if f not in all_assigned:
            test_files.append(f)

    train_samples = [(os.path.join(cat_dir, f), WASTE_CLASS_IDX) for f in train_files]
    val_samples = [(os.path.join(cat_dir, f), WASTE_CLASS_IDX) for f in val_files]
    test_samples = [(os.path.join(cat_dir, f), WASTE_CLASS_IDX) for f in test_files]

    return train_samples, val_samples, test_samples


def get_train_transform():
    return transforms.Compose([
        transforms.Resize((RESIZE_SIZE, RESIZE_SIZE), interpolation=InterpolationMode.BILINEAR),
        transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.75, 1.0), interpolation=InterpolationMode.BILINEAR),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_eval_transform():
    return transforms.Compose([
        transforms.Resize((RESIZE_SIZE, RESIZE_SIZE), interpolation=InterpolationMode.BILINEAR),
        transforms.CenterCrop(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def run_experiment(
    data_dir: str,
    output_dir: str,
    base_checkpoint_path: Optional[str] = None,
    epochs_phase1: int = 5,
    epochs_phase2: int = 3,
    batch_size: int = 16,
    lr_phase1: float = 5e-4,
    lr_phase2: float = 5e-5,
    seed: int = 42
) -> Dict:
    set_seed(seed)
    device = get_device()
    os.makedirs(output_dir, exist_ok=True)

    wm_dir = os.path.join(data_dir, "Waste Management")
    if not os.path.isdir(wm_dir):
        raise FileNotFoundError(f"Waste Management data directory not found at: {wm_dir}")

    all_files = sorted([f for f in os.listdir(wm_dir) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS])
    print("=" * 70)
    print(" MobileNetV3-Small Real Waste Management Fine-Tuning Experiment")
    print("=" * 70)
    print(f" Target Device: {device}")
    print(f" Total Real Waste Management Images: {len(all_files)}")
    print(f" Preserved 6-Class Mapping: {SIX_CLASSES}")
    print(f" Waste Management Class Index: {WASTE_CLASS_IDX}")

    # Group-aware split
    train_samples, val_samples, test_samples = group_aware_split(
        all_files, wm_dir, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=seed
    )
    print(f" Dataset Splits: Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)} (Held-out)")

    # Save test manifest for exact reproducible evaluation
    test_manifest_path = os.path.join(output_dir, "test_manifest.json")
    with open(test_manifest_path, "w") as f:
        json.dump({
            "target_class": "Waste Management",
            "target_class_idx": WASTE_CLASS_IDX,
            "classes": SIX_CLASSES,
            "test_samples": [s[0] for s in test_samples],
            "total_test_samples": len(test_samples),
            "created_at": datetime.utcnow().isoformat() + "Z"
        }, f, indent=2)

    # DataLoaders
    train_loader = DataLoader(
        RealWasteDataset(train_samples, transform=get_train_transform()),
        batch_size=batch_size, shuffle=True, num_workers=0
    )
    val_loader = DataLoader(
        RealWasteDataset(val_samples, transform=get_eval_transform()),
        batch_size=batch_size, shuffle=False, num_workers=0
    )

    # Build 6-class MobileNetV3 Small model
    model = build_mobilenet_v3_small(num_classes=6, pretrained=True)

    # If base checkpoint provided, load existing weights
    if base_checkpoint_path and os.path.exists(base_checkpoint_path):
        print(f" Initializing weights from production checkpoint: {base_checkpoint_path}")
        state_dict = torch.load(base_checkpoint_path, map_location="cpu", weights_only=True)
        model.load_state_dict(state_dict)
    else:
        print(" Initializing from official ImageNet pretrained weights")

    model = model.to(device)

    criterion = nn.CrossEntropyLoss()

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "phase": []
    }

    best_val_loss = float("inf")
    best_state_dict = None
    best_epoch = 0

    # =========================================================================
    # PHASE 1: Head-Only Transfer Learning (Backbone Frozen)
    # =========================================================================
    if epochs_phase1 > 0:
        freeze_backbone(model)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"\n--- Phase 1: Classifier Head Fine-Tuning ({epochs_phase1} epochs) ---")
        print(f" Trainable params: {train_p:,} / Total: {total_p:,}")

        optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr_phase1, weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=epochs_phase1, eta_min=1e-5)

        for ep in range(1, epochs_phase1 + 1):
            t0 = time.time()
            model.train()
            r_loss, r_corr, r_tot = 0.0, 0, 0
            for imgs, targets in train_loader:
                imgs, targets = imgs.to(device), targets.to(device)
                optimizer.zero_grad()
                out = model(imgs)
                loss = criterion(out, targets)
                loss.backward()
                optimizer.step()
                r_loss += loss.item() * imgs.size(0)
                preds = torch.argmax(out, dim=1)
                r_corr += (preds == targets).sum().item()
                r_tot += targets.size(0)

            t_loss = r_loss / max(r_tot, 1)
            t_acc = r_corr / max(r_tot, 1)

            # Validation
            model.eval()
            v_loss, v_corr, v_tot = 0.0, 0, 0
            with torch.no_grad():
                for imgs, targets in val_loader:
                    imgs, targets = imgs.to(device), targets.to(device)
                    out = model(imgs)
                    loss = criterion(out, targets)
                    v_loss += loss.item() * imgs.size(0)
                    preds = torch.argmax(out, dim=1)
                    v_corr += (preds == targets).sum().item()
                    v_tot += targets.size(0)

            v_loss = v_loss / max(v_tot, 1)
            v_acc = v_corr / max(v_tot, 1)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["phase"].append("phase1")

            print(f" [Phase 1 Ep {ep:02d}/{epochs_phase1:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% ({dt:.1f}s)")

            if v_loss < best_val_loss:
                best_val_loss = v_loss
                best_epoch = ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # =========================================================================
    # PHASE 2: Cautious Deep Fine-Tuning (Unfreeze Last Blocks)
    # =========================================================================
    if epochs_phase2 > 0:
        unfreeze_backbone(model, last_n_blocks=2)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"\n--- Phase 2: Cautious Feature Block Fine-Tuning ({epochs_phase2} epochs) ---")
        print(f" Trainable params: {train_p:,} / Total: {total_p:,}")

        optimizer = AdamW([
            {"params": model.features.parameters(), "lr": lr_phase2 * 0.2},
            {"params": model.classifier.parameters(), "lr": lr_phase2}
        ], weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=epochs_phase2, eta_min=1e-6)

        for ep in range(1, epochs_phase2 + 1):
            t0 = time.time()
            model.train()
            r_loss, r_corr, r_tot = 0.0, 0, 0
            for imgs, targets in train_loader:
                imgs, targets = imgs.to(device), targets.to(device)
                optimizer.zero_grad()
                out = model(imgs)
                loss = criterion(out, targets)
                loss.backward()
                optimizer.step()
                r_loss += loss.item() * imgs.size(0)
                preds = torch.argmax(out, dim=1)
                r_corr += (preds == targets).sum().item()
                r_tot += targets.size(0)

            t_loss = r_loss / max(r_tot, 1)
            t_acc = r_corr / max(r_tot, 1)

            # Validation
            model.eval()
            v_loss, v_corr, v_tot = 0.0, 0, 0
            with torch.no_grad():
                for imgs, targets in val_loader:
                    imgs, targets = imgs.to(device), targets.to(device)
                    out = model(imgs)
                    loss = criterion(out, targets)
                    v_loss += loss.item() * imgs.size(0)
                    preds = torch.argmax(out, dim=1)
                    v_corr += (preds == targets).sum().item()
                    v_tot += targets.size(0)

            v_loss = v_loss / max(v_tot, 1)
            v_acc = v_corr / max(v_tot, 1)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["phase"].append("phase2")

            print(f" [Phase 2 Ep {ep:02d}/{epochs_phase2:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% ({dt:.1f}s)")

            if v_loss < best_val_loss:
                best_val_loss = v_loss
                best_epoch = epochs_phase1 + ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Save experimental weights
    exp_weights_path = os.path.join(output_dir, "best_model.pth")
    if best_state_dict is not None:
        torch.save(best_state_dict, exp_weights_path)
    else:
        torch.save(model.state_dict(), exp_weights_path)

    # Save model config preserving exact 6-class architecture
    exp_config = {
        "model_name": "MobileNetV3-Small-Civic-RealWasteExperiment",
        "architecture": "mobilenet_v3_small",
        "version": "1.1.0-experiment",
        "num_classes": 6,
        "classes": SIX_CLASSES,
        "class_to_idx": CLASS_TO_IDX,
        "input_size": [3, IMAGE_SIZE, IMAGE_SIZE],
        "image_size": IMAGE_SIZE,
        "input_mean": IMAGENET_MEAN,
        "input_std": IMAGENET_STD,
        "best_epoch": best_epoch,
        "best_val_loss": round(best_val_loss, 4),
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_samples": {
            "total_real_waste_images": len(all_files),
            "train": len(train_samples),
            "val": len(val_samples),
            "test": len(test_samples)
        },
        "training_notes": "Trained exclusively on verified real Waste Management images. Five other classes preserved in output layer but unrepresented by real data."
    }

    exp_config_path = os.path.join(output_dir, "model_config.json")
    with open(exp_config_path, "w") as f:
        json.dump(exp_config, f, indent=2)

    history_path = os.path.join(output_dir, "training_history.json")
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)

    print("\n" + "=" * 70)
    print(" Experimental Training Run Finished!")
    print(f" Experimental Model saved to: {exp_weights_path}")
    print(f" Experimental Config saved to: {exp_config_path}")
    print("=" * 70)

    return exp_config


if __name__ == "__main__":
    ai_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(ai_dir, "data")
    output_dir = os.path.join(ai_dir, "models_real_data_experiment")
    base_checkpoint = os.path.join(ai_dir, "models", "best_model.pth")

    run_experiment(
        data_dir=data_dir,
        output_dir=output_dir,
        base_checkpoint_path=base_checkpoint,
        epochs_phase1=5,
        epochs_phase2=3,
        batch_size=16,
        lr_phase1=5e-4,
        lr_phase2=5e-5,
        seed=42
    )
