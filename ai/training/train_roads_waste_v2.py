"""
Fine-Tuning MobileNetV3 Small on Real Waste Management and Roads Images.
Preserves the exact 6-class civic architecture contract:
  [0] Drainage
  [1] Other
  [2] Roads
  [3] Street Light
  [4] Waste Management
  [5] Water Supply

Initializes from: ai/models_real_data_experiment/best_model.pth (Waste Management checkpoint)
Saves all updated artifacts to: ai/models_roads_waste_v2/
Keeps existing production (ai/models/) and experimental (ai/models_real_data_experiment/) checkpoints untouched.
"""

import os
import sys
import json
import random
import time
from datetime import datetime
from collections import Counter, defaultdict
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
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
    classification_report
)

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
ROADS_CLASS_IDX = CLASS_TO_IDX["Roads"]              # 2
WASTE_CLASS_IDX = CLASS_TO_IDX["Waste Management"]  # 4


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False


class JointCivicDataset(Dataset):
    """Dataset for training and evaluating on real civic images with labels."""
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


def get_waste_group_key(filename: str) -> str:
    """Extracts burst/session grouping key for Waste Management images."""
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


def get_roads_group_key(filename: str) -> str:
    """Extracts grouping key for Roads images to prevent burst/stock leakage."""
    if filename.startswith("360_F_"):
        parts = filename.split("_")
        return f"adobe_{parts[2]}" if len(parts) > 2 else "adobe_360"
    elif filename.startswith("photo-"):
        return filename[:15]
    elif filename.startswith("a-"):
        parts = filename.split("-")
        return "-".join(parts[:3]) if len(parts) >= 3 else parts[0]
    elif "-" in filename:
        return filename.split("-")[0]
    elif "_" in filename:
        return filename.split("_")[0]
    else:
        return filename[:8]


def split_waste_images(
    wm_dir: str,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Reproduces the exact same 132 train / 28 val / 29 test split for Waste Management."""
    all_files = sorted([f for f in os.listdir(wm_dir) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS])
    rng = random.Random(seed)
    groups: Dict[str, List[str]] = {}
    for f in all_files:
        g = get_waste_group_key(f)
        groups.setdefault(g, []).append(f)

    sorted_groups = sorted(groups.keys())
    rng.shuffle(sorted_groups)

    total_images = len(all_files)
    target_train = int(total_images * 0.70)
    target_val = int(total_images * 0.15)

    train_files, val_files, test_files = [], [], []
    for g in sorted_groups:
        g_files = groups[g]
        if len(train_files) + len(g_files) <= target_train:
            train_files.extend(g_files)
        elif len(val_files) + len(g_files) <= target_val:
            val_files.extend(g_files)
        else:
            test_files.extend(g_files)

    all_assigned = set(train_files) | set(val_files) | set(test_files)
    for f in all_files:
        if f not in all_assigned:
            test_files.append(f)

    train_samples = [(os.path.join(wm_dir, f), WASTE_CLASS_IDX) for f in train_files]
    val_samples = [(os.path.join(wm_dir, f), WASTE_CLASS_IDX) for f in val_files]
    test_samples = [(os.path.join(wm_dir, f), WASTE_CLASS_IDX) for f in test_files]

    return train_samples, val_samples, test_samples


def split_roads_images(
    roads_dir: str,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Partitions Roads images into ~70% train, ~15% val, ~15% test without burst leakage."""
    all_files = sorted([f for f in os.listdir(roads_dir) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTENSIONS])
    rng = random.Random(seed)
    groups: Dict[str, List[str]] = defaultdict(list)
    for f in all_files:
        g = get_roads_group_key(f)
        groups[g].append(f)

    sorted_groups = sorted(groups.keys())
    rng.shuffle(sorted_groups)

    total_images = len(all_files)
    target_train = int(total_images * 0.70)
    target_val = int(total_images * 0.15)

    train_files, val_files, test_files = [], [], []
    for g in sorted_groups:
        g_files = groups[g]
        if len(train_files) + len(g_files) <= target_train:
            train_files.extend(g_files)
        elif len(val_files) + len(g_files) <= target_val:
            val_files.extend(g_files)
        else:
            test_files.extend(g_files)

    all_assigned = set(train_files) | set(val_files) | set(test_files)
    for f in all_files:
        if f not in all_assigned:
            test_files.append(f)

    train_samples = [(os.path.join(roads_dir, f), ROADS_CLASS_IDX) for f in train_files]
    val_samples = [(os.path.join(roads_dir, f), ROADS_CLASS_IDX) for f in val_files]
    test_samples = [(os.path.join(roads_dir, f), ROADS_CLASS_IDX) for f in test_files]

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


def run_joint_fine_tuning(
    data_dir: str,
    output_dir: str,
    base_checkpoint_path: str,
    epochs_phase1: int = 5,
    epochs_phase2: int = 5,
    batch_size: int = 16,
    lr_phase1: float = 4e-4,
    lr_phase2: float = 4e-5,
    seed: int = 42
) -> Dict:
    set_seed(seed)
    device = get_device()
    os.makedirs(output_dir, exist_ok=True)

    wm_dir = os.path.join(data_dir, "Waste Management")
    roads_dir = os.path.join(data_dir, "Roads")

    if not os.path.isdir(wm_dir):
        raise FileNotFoundError(f"Waste Management data directory not found: {wm_dir}")
    if not os.path.isdir(roads_dir):
        raise FileNotFoundError(f"Roads data directory not found: {roads_dir}")

    # 1. Create stratified splits
    wm_train, wm_val, wm_test = split_waste_images(wm_dir, seed=seed)
    roads_train, roads_val, roads_test = split_roads_images(roads_dir, seed=seed)

    # Combine
    train_samples = wm_train + roads_train
    val_samples = wm_val + roads_val
    test_samples = wm_test + roads_test

    # Shuffle training samples
    random.Random(seed).shuffle(train_samples)
    random.Random(seed).shuffle(val_samples)

    print("=" * 75)
    print(" MobileNetV3-Small Joint Fine-Tuning: Roads + Waste Management")
    print("=" * 75)
    print(f" Target Device: {device}")
    print(f" Preserved 6-Class Mapping: {SIX_CLASSES}")
    print(f"   [2] Roads | [4] Waste Management")
    print(f" Waste Management Counts: Train={len(wm_train)}, Val={len(wm_val)}, Test={len(wm_test)} (Total: {len(wm_train)+len(wm_val)+len(wm_test)})")
    print(f" Roads Counts:            Train={len(roads_train)}, Val={len(roads_val)}, Test={len(roads_test)} (Total: {len(roads_train)+len(roads_val)+len(roads_test)})")
    print(f" Combined Counts:         Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)} (Total: {len(train_samples)+len(val_samples)+len(test_samples)})")
    print("=" * 75)

    # 2. Save test manifest for exact evaluation and reproducibility
    test_manifest_path = os.path.join(output_dir, "test_manifest.json")
    with open(test_manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "target_classes": ["Roads", "Waste Management"],
            "classes": SIX_CLASSES,
            "class_to_idx": CLASS_TO_IDX,
            "waste_management_test_samples": [s[0] for s in wm_test],
            "roads_test_samples": [s[0] for s in roads_test],
            "all_test_samples": [
                {"path": s[0], "class": SIX_CLASSES[s[1]], "class_idx": s[1]}
                for s in test_samples
            ],
            "counts": {
                "waste_management_test": len(wm_test),
                "roads_test": len(roads_test),
                "total_test": len(test_samples)
            },
            "created_at": datetime.utcnow().isoformat() + "Z"
        }, f, indent=2)

    # 3. DataLoaders
    train_loader = DataLoader(
        JointCivicDataset(train_samples, transform=get_train_transform()),
        batch_size=batch_size, shuffle=True, num_workers=0
    )
    val_loader = DataLoader(
        JointCivicDataset(val_samples, transform=get_eval_transform()),
        batch_size=batch_size, shuffle=False, num_workers=0
    )

    # 4. Build Model & Load Checkpoint
    model = build_mobilenet_v3_small(num_classes=6, pretrained=False)
    if not os.path.exists(base_checkpoint_path):
        raise FileNotFoundError(f"Starting checkpoint not found: {base_checkpoint_path}")
    print(f" Loading starting weights from: {base_checkpoint_path}")
    state_dict = torch.load(base_checkpoint_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state_dict)
    model = model.to(device)

    # 5. Class weighting for slight imbalance: 143 Roads vs 132 Waste Management
    total_train = len(train_samples)
    n_roads_train = len(roads_train)
    n_wm_train = len(wm_train)
    weights = torch.ones(6, dtype=torch.float32, device=device)
    weights[ROADS_CLASS_IDX] = total_train / (2.0 * n_roads_train)
    weights[WASTE_CLASS_IDX] = total_train / (2.0 * n_wm_train)
    print(f" Class weights: Roads={weights[ROADS_CLASS_IDX]:.4f}, Waste Management={weights[WASTE_CLASS_IDX]:.4f}")

    criterion = nn.CrossEntropyLoss(weight=weights)

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "val_acc_roads": [], "val_acc_waste": [],
        "phase": []
    }

    best_val_loss = float("inf")
    best_state_dict = None
    best_epoch = 0
    best_val_acc = 0.0

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
            r_corr_wm, r_tot_wm = 0, 0
            r_corr_rd, r_tot_rd = 0, 0
            with torch.no_grad():
                for imgs, targets in val_loader:
                    imgs, targets = imgs.to(device), targets.to(device)
                    out = model(imgs)
                    loss = criterion(out, targets)
                    v_loss += loss.item() * imgs.size(0)
                    preds = torch.argmax(out, dim=1)
                    v_corr += (preds == targets).sum().item()
                    v_tot += targets.size(0)

                    for p, t in zip(preds, targets):
                        if t.item() == WASTE_CLASS_IDX:
                            r_tot_wm += 1
                            if p.item() == WASTE_CLASS_IDX:
                                r_corr_wm += 1
                        elif t.item() == ROADS_CLASS_IDX:
                            r_tot_rd += 1
                            if p.item() == ROADS_CLASS_IDX:
                                r_corr_rd += 1

            v_loss = v_loss / max(v_tot, 1)
            v_acc = v_corr / max(v_tot, 1)
            acc_wm = r_corr_wm / max(r_tot_wm, 1)
            acc_rd = r_corr_rd / max(r_tot_rd, 1)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["val_acc_roads"].append(round(acc_rd, 4))
            history["val_acc_waste"].append(round(acc_wm, 4))
            history["phase"].append("phase1")

            print(f" [Phase 1 Ep {ep:02d}/{epochs_phase1:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% (Waste: {acc_wm*100:.1f}%, Roads: {acc_rd*100:.1f}%) ({dt:.1f}s)")

            if v_loss < best_val_loss:
                best_val_loss = v_loss
                best_val_acc = v_acc
                best_epoch = ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # =========================================================================
    # PHASE 2: Cautious Deep Fine-Tuning (Unfreeze Last 2 Feature Blocks)
    # =========================================================================
    if epochs_phase2 > 0:
        unfreeze_backbone(model, last_n_blocks=2)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"\n--- Phase 2: Deep Feature Block Fine-Tuning ({epochs_phase2} epochs) ---")
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
            r_corr_wm, r_tot_wm = 0, 0
            r_corr_rd, r_tot_rd = 0, 0
            with torch.no_grad():
                for imgs, targets in val_loader:
                    imgs, targets = imgs.to(device), targets.to(device)
                    out = model(imgs)
                    loss = criterion(out, targets)
                    v_loss += loss.item() * imgs.size(0)
                    preds = torch.argmax(out, dim=1)
                    v_corr += (preds == targets).sum().item()
                    v_tot += targets.size(0)

                    for p, t in zip(preds, targets):
                        if t.item() == WASTE_CLASS_IDX:
                            r_tot_wm += 1
                            if p.item() == WASTE_CLASS_IDX:
                                r_corr_wm += 1
                        elif t.item() == ROADS_CLASS_IDX:
                            r_tot_rd += 1
                            if p.item() == ROADS_CLASS_IDX:
                                r_corr_rd += 1

            v_loss = v_loss / max(v_tot, 1)
            v_acc = v_corr / max(v_tot, 1)
            acc_wm = r_corr_wm / max(r_tot_wm, 1)
            acc_rd = r_corr_rd / max(r_tot_rd, 1)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["val_acc_roads"].append(round(acc_rd, 4))
            history["val_acc_waste"].append(round(acc_wm, 4))
            history["phase"].append("phase2")

            print(f" [Phase 2 Ep {ep:02d}/{epochs_phase2:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% (Waste: {acc_wm*100:.1f}%, Roads: {acc_rd*100:.1f}%) ({dt:.1f}s)")

            if v_loss < best_val_loss:
                best_val_loss = v_loss
                best_val_acc = v_acc
                best_epoch = epochs_phase1 + ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # Save best checkpoint
    new_weights_path = os.path.join(output_dir, "best_model.pth")
    if best_state_dict is not None:
        torch.save(best_state_dict, new_weights_path)
    else:
        torch.save(model.state_dict(), new_weights_path)

    # Save model config
    new_config = {
        "model_name": "MobileNetV3-Small-Civic-RoadsWasteV2",
        "architecture": "mobilenet_v3_small",
        "version": "1.2.0-roads-waste-v2",
        "num_classes": 6,
        "classes": SIX_CLASSES,
        "class_to_idx": CLASS_TO_IDX,
        "input_size": [3, IMAGE_SIZE, IMAGE_SIZE],
        "image_size": IMAGE_SIZE,
        "input_mean": IMAGENET_MEAN,
        "input_std": IMAGENET_STD,
        "best_epoch": best_epoch,
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4),
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_samples": {
            "total_real_images": len(train_samples) + len(val_samples) + len(test_samples),
            "waste_management": {
                "total": len(wm_train) + len(wm_val) + len(wm_test),
                "train": len(wm_train),
                "val": len(wm_val),
                "test": len(wm_test)
            },
            "roads": {
                "total": len(roads_train) + len(roads_val) + len(roads_test),
                "train": len(roads_train),
                "val": len(roads_val),
                "test": len(roads_test)
            },
            "train_total": len(train_samples),
            "val_total": len(val_samples),
            "test_total": len(test_samples)
        },
        "real_data_classes": [
            "Waste Management",
            "Roads"
        ],
        "training_notes": (
            "Fine-tuned jointly on verified real Waste Management and real Roads damage imagery. "
            "Initialized from Waste Management experimental checkpoint (ai/models_real_data_experiment/best_model.pth). "
            "Full 6-class output architecture preserved. Remaining four classes (Drainage, Other, Street Light, Water Supply) "
            "remain unrepresented by real datasets and route to heuristic vision fallback."
        )
    }

    new_config_path = os.path.join(output_dir, "model_config.json")
    with open(new_config_path, "w", encoding="utf-8") as f:
        json.dump(new_config, f, indent=2)

    history_path = os.path.join(output_dir, "training_history.json")
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    print("\n" + "=" * 75)
    print(" Joint Fine-Tuning Complete!")
    print(f" Best Validation Loss: {best_val_loss:.4f} (Epoch {best_epoch}) | Val Acc: {best_val_acc*100:.2f}%")
    print(f" Best Weights saved to: {new_weights_path}")
    print(f" Config saved to:        {new_config_path}")
    print(f" History saved to:       {history_path}")
    print("=" * 75)

    return new_config


def evaluate_and_generate_report(
    output_dir: str,
    base_waste_checkpoint: str,
    base_prod_checkpoint: str
) -> Dict:
    """
    Evaluates the newly fine-tuned model against:
    1. Held-out Waste Management test set (29 images)
    2. Held-out Roads test set (32 images)
    3. Combined held-out test set (61 images)
    And compares against the previous Waste Management model on the same 29 Waste images.
    """
    print("\n" + "=" * 75)
    print(" Comprehensive Evaluation on Held-Out Test Sets")
    print("=" * 75)

    manifest_path = os.path.join(output_dir, "test_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    wm_test_paths = manifest["waste_management_test_samples"]
    roads_test_paths = manifest["roads_test_samples"]
    all_test_items = manifest["all_test_samples"]

    new_weights = os.path.join(output_dir, "best_model.pth")
    transform = get_eval_transform()
    softmax = nn.Softmax(dim=1)

    # 1. Evaluate New Model
    model = build_mobilenet_v3_small(num_classes=6, pretrained=False)
    model.load_state_dict(torch.load(new_weights, map_location="cpu", weights_only=True))
    model.eval()

    y_true_all = []
    y_pred_all = []
    confidences_all = []

    y_true_wm, y_pred_wm, confs_wm = [], [], []
    y_true_rd, y_pred_rd, confs_rd = [], [], []

    with torch.no_grad():
        for item in all_test_items:
            path = item["path"]
            true_idx = item["class_idx"]
            img = load_and_validate_image(path)
            tensor = transform(img).unsqueeze(0)
            probs = softmax(model(tensor))[0]
            pred_idx = torch.argmax(probs).item()
            pred_conf = float(probs[pred_idx].item())

            y_true_all.append(true_idx)
            y_pred_all.append(pred_idx)
            confidences_all.append(pred_conf)

            if true_idx == WASTE_CLASS_IDX:
                y_true_wm.append(true_idx)
                y_pred_wm.append(pred_idx)
                confs_wm.append(pred_conf)
            elif true_idx == ROADS_CLASS_IDX:
                y_true_rd.append(true_idx)
                y_pred_rd.append(pred_idx)
                confs_rd.append(pred_conf)

    # Overall metrics on real test set (Roads + Waste Management)
    test_acc_all = accuracy_score(y_true_all, y_pred_all)
    labels_eval = [ROADS_CLASS_IDX, WASTE_CLASS_IDX]
    precision_per_class, recall_per_class, f1_per_class, support_per_class = precision_recall_fscore_support(
        y_true_all, y_pred_all, labels=labels_eval, zero_division=0
    )

    macro_p = float(np.mean(precision_per_class))
    macro_r = float(np.mean(recall_per_class))
    macro_f1 = float(np.mean(f1_per_class))

    cm = confusion_matrix(y_true_all, y_pred_all, labels=range(6))

    # Waste-only accuracy & recall
    wm_acc = accuracy_score(y_true_wm, y_pred_wm)
    rd_acc = accuracy_score(y_true_rd, y_pred_rd)

    # 2. Evaluate Previous Waste Management Model on the exact same test sets
    prev_wm_model = build_mobilenet_v3_small(num_classes=6, pretrained=False)
    prev_wm_model.load_state_dict(torch.load(base_waste_checkpoint, map_location="cpu", weights_only=True))
    prev_wm_model.eval()

    prev_pred_wm = []
    prev_pred_rd = []
    with torch.no_grad():
        for p in wm_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_wm_model(transform(img).unsqueeze(0)))[0]
            prev_pred_wm.append(torch.argmax(probs).item())
        for p in roads_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_wm_model(transform(img).unsqueeze(0)))[0]
            prev_pred_rd.append(torch.argmax(probs).item())

    prev_wm_acc = accuracy_score(y_true_wm, prev_pred_wm)
    prev_rd_acc = accuracy_score(y_true_rd, prev_pred_rd)

    report = {
        "evaluation_timestamp": datetime.utcnow().isoformat() + "Z",
        "new_model_checkpoint": new_weights,
        "base_waste_checkpoint": base_waste_checkpoint,
        "test_counts": {
            "waste_management": len(wm_test_paths),
            "roads": len(roads_test_paths),
            "total_test": len(all_test_items)
        },
        "overall_test_metrics": {
            "accuracy": round(float(test_acc_all), 4),
            "accuracy_pct": f"{test_acc_all*100:.2f}%",
            "macro_precision": round(macro_p, 4),
            "macro_recall": round(macro_r, 4),
            "macro_f1": round(macro_f1, 4),
            "mean_confidence": round(float(np.mean(confidences_all)), 4)
        },
        "per_class_metrics": {
            "Roads": {
                "class_index": ROADS_CLASS_IDX,
                "test_support": int(support_per_class[0]),
                "accuracy": round(float(rd_acc), 4),
                "precision": round(float(precision_per_class[0]), 4),
                "recall": round(float(recall_per_class[0]), 4),
                "f1_score": round(float(f1_per_class[0]), 4),
                "mean_confidence": round(float(np.mean(confs_rd)), 4)
            },
            "Waste Management": {
                "class_index": WASTE_CLASS_IDX,
                "test_support": int(support_per_class[1]),
                "accuracy": round(float(wm_acc), 4),
                "precision": round(float(precision_per_class[1]), 4),
                "recall": round(float(recall_per_class[1]), 4),
                "f1_score": round(float(f1_per_class[1]), 4),
                "mean_confidence": round(float(np.mean(confs_wm)), 4)
            }
        },
        "confusion_matrix_6class": {
            "classes": SIX_CLASSES,
            "matrix": cm.tolist()
        },
        "comparison_with_previous_waste_model": {
            "waste_management_accuracy_previous": round(float(prev_wm_acc), 4),
            "waste_management_accuracy_new": round(float(wm_acc), 4),
            "waste_management_delta": round(float(wm_acc - prev_wm_acc), 4),
            "waste_performance_preserved": bool(wm_acc >= 0.95),
            "roads_accuracy_previous": round(float(prev_rd_acc), 4),
            "roads_accuracy_new": round(float(rd_acc), 4),
            "roads_improvement_delta": round(float(rd_acc - prev_rd_acc), 4),
            "roads_classification_improved": bool(rd_acc > prev_rd_acc)
        },
        "unsupported_categories_limitations": {
            "classes_without_real_training_data": ["Drainage", "Other", "Street Light", "Water Supply"],
            "explanation": (
                "Real labeled datasets were available only for Waste Management (189 images) and Roads (205 images). "
                "The 6-class output layer contract is preserved, but the model has NOT learned the other four classes from real imagery. "
                "Any complaint classified outside the verified real classes continues to use the calibrated heuristic vision fallback."
            )
        }
    }

    report_path = os.path.join(output_dir, "evaluation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nOverall Test Accuracy: {test_acc_all*100:.2f}%")
    print(f"Macro F1-Score:        {macro_f1:.4f}")
    print("\nPer-Class Breakdown:")
    print(f"  Roads:            Precision={precision_per_class[0]:.4f}, Recall={recall_per_class[0]:.4f}, F1={f1_per_class[0]:.4f} (Accuracy={rd_acc*100:.2f}%)")
    print(f"  Waste Management: Precision={precision_per_class[1]:.4f}, Recall={recall_per_class[1]:.4f}, F1={f1_per_class[1]:.4f} (Accuracy={wm_acc*100:.2f}%)")
    print("\nComparison with Previous Waste Management Checkpoint:")
    print(f"  Waste Management Accuracy: {prev_wm_acc*100:.2f}% -> {wm_acc*100:.2f}% (Preserved: {report['comparison_with_previous_waste_model']['waste_performance_preserved']})")
    print(f"  Roads Accuracy:            {prev_rd_acc*100:.2f}% -> {rd_acc*100:.2f}% (Improved: {report['comparison_with_previous_waste_model']['roads_classification_improved']})")
    print("\n6-Class Confusion Matrix:")
    print(cm)
    print(f"\nEvaluation Report saved to: {report_path}")

    return report


if __name__ == "__main__":
    ai_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(ai_dir, "data")
    output_dir = os.path.join(ai_dir, "models_roads_waste_v2")
    base_checkpoint = os.path.join(ai_dir, "models_real_data_experiment", "best_model.pth")
    prod_checkpoint = os.path.join(ai_dir, "models", "best_model.pth")

    run_joint_fine_tuning(
        data_dir=data_dir,
        output_dir=output_dir,
        base_checkpoint_path=base_checkpoint,
        epochs_phase1=5,
        epochs_phase2=5,
        batch_size=16,
        lr_phase1=4e-4,
        lr_phase2=4e-5,
        seed=42
    )

    evaluate_and_generate_report(
        output_dir=output_dir,
        base_waste_checkpoint=base_checkpoint,
        base_prod_checkpoint=prod_checkpoint
    )
