"""
Fine-Tuning MobileNetV3 Small on Real Water Supply, Drainage, Street Light, Roads, and Waste Management Images (v5).
Preserves the exact 6-class civic architecture contract:
  [0] Drainage
  [1] Other
  [2] Roads
  [3] Street Light
  [4] Waste Management
  [5] Water Supply

Initializes from: ai/models_drainage_v3/best_model.pth (latest 4-category Drainage + Roads + Street Light + Waste checkpoint)
Saves all updated artifacts to: ai/models_water_supply_v4/
Keeps existing checkpoints (ai/models/, ai/models_real_data_experiment/, ai/models_roads_waste_v2/,
ai/models_streetlight_roads_waste_v3/, ai/models_drainage_v3/) completely untouched.
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
    "Drainage",          # 0
    "Other",             # 1
    "Roads",             # 2
    "Street Light",      # 3
    "Waste Management",  # 4
    "Water Supply"       # 5
]
CLASS_TO_IDX = {name: idx for idx, name in enumerate(SIX_CLASSES)}
DRAINAGE_CLASS_IDX = CLASS_TO_IDX["Drainage"]          # 0
ROADS_CLASS_IDX = CLASS_TO_IDX["Roads"]                # 2
STREETLIGHT_CLASS_IDX = CLASS_TO_IDX["Street Light"]    # 3
WASTE_CLASS_IDX = CLASS_TO_IDX["Waste Management"]    # 4
WATERSUPPLY_CLASS_IDX = CLASS_TO_IDX["Water Supply"]  # 5


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


def get_watersupply_group_key(filename: str) -> str:
    """Extracts grouping key for Water Supply images to prevent burst/stock leakage."""
    if filename.startswith("360_F_"):
        parts = filename.split("_")
        return f"adobe_{parts[2]}" if len(parts) > 2 else "adobe_360"
    elif filename.startswith("photo-"):
        return filename[:15]
    elif filename.startswith("a-"):
        parts = filename.split("-")
        return "-".join(parts[:3]) if len(parts) >= 3 else parts[0]
    elif "-" in filename:
        return "-".join(filename.split("-")[:2])
    elif "_" in filename:
        return "-".join(filename.split("_")[:2])
    else:
        return filename[:8]


def get_drainage_group_key(filename: str) -> str:
    """Extracts grouping key for Drainage images to prevent burst/stock leakage."""
    if filename.startswith("360_F_"):
        parts = filename.split("_")
        return f"adobe_{parts[2]}" if len(parts) > 2 else "adobe_360"
    elif filename.startswith("photo-"):
        return filename[:15]
    elif filename.startswith("a-"):
        parts = filename.split("-")
        return "-".join(parts[:3]) if len(parts) >= 3 else parts[0]
    elif "-" in filename:
        return "-".join(filename.split("-")[:2])
    elif "_" in filename:
        return "-".join(filename.split("_")[:2])
    else:
        return filename[:8]


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


def get_sl_group_key(filename: str) -> str:
    """Extracts grouping key for Street Light images to prevent burst/stock leakage."""
    if filename.startswith("360_F_"):
        parts = filename.split("_")
        return f"adobe_{parts[2]}" if len(parts) > 2 else "adobe_360"
    elif filename.startswith("photo-"):
        return filename[:15]
    elif filename.startswith("broken-street-light"):
        return "broken-street-light"
    elif filename.startswith("broken-street-lamp"):
        return "broken-street-lamp"
    elif "-" in filename:
        return filename.split("-")[0]
    elif "_" in filename:
        return filename.split("_")[0]
    else:
        return filename[:8]


def split_watersupply_images(
    ws_dir: str,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Partitions 150 real Water Supply images into 105 train (~70%), 22 val (~15%), 23 test (~15%)."""
    all_files = sorted([f for f in os.listdir(ws_dir) if f.endswith(".webp")])
    rng = random.Random(seed)
    groups: Dict[str, List[str]] = defaultdict(list)
    for f in all_files:
        g = get_watersupply_group_key(f)
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

    train_samples = [(os.path.join(ws_dir, f), WATERSUPPLY_CLASS_IDX) for f in train_files]
    val_samples = [(os.path.join(ws_dir, f), WATERSUPPLY_CLASS_IDX) for f in val_files]
    test_samples = [(os.path.join(ws_dir, f), WATERSUPPLY_CLASS_IDX) for f in test_files]

    return train_samples, val_samples, test_samples


def split_drainage_images(
    drainage_dir: str,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Reproduces the exact same 141 train / 30 val / 31 test split for real Drainage images."""
    all_files = sorted([f for f in os.listdir(drainage_dir) if f.endswith(".webp")])
    rng = random.Random(seed)
    groups: Dict[str, List[str]] = defaultdict(list)
    for f in all_files:
        g = get_drainage_group_key(f)
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

    train_samples = [(os.path.join(drainage_dir, f), DRAINAGE_CLASS_IDX) for f in train_files]
    val_samples = [(os.path.join(drainage_dir, f), DRAINAGE_CLASS_IDX) for f in val_files]
    test_samples = [(os.path.join(drainage_dir, f), DRAINAGE_CLASS_IDX) for f in test_files]

    return train_samples, val_samples, test_samples


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
    """Reproduces the exact same 143 train / 30 val / 32 test split for real Roads images."""
    all_files = sorted([f for f in os.listdir(roads_dir) if f.endswith(".webp")])
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


def split_streetlight_images(
    sl_dir: str,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """Reproduces the exact same 105 train / 22 val / 23 test split for real Street Light images."""
    all_files = sorted([f for f in os.listdir(sl_dir) if f.endswith(".webp")])
    rng = random.Random(seed)
    groups: Dict[str, List[str]] = defaultdict(list)
    for f in all_files:
        g = get_sl_group_key(f)
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

    train_samples = [(os.path.join(sl_dir, f), STREETLIGHT_CLASS_IDX) for f in train_files]
    val_samples = [(os.path.join(sl_dir, f), STREETLIGHT_CLASS_IDX) for f in val_files]
    test_samples = [(os.path.join(sl_dir, f), STREETLIGHT_CLASS_IDX) for f in test_files]

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
    lr_phase1: float = 3.5e-4,
    lr_phase2: float = 3.5e-5,
    seed: int = 42
) -> Dict:
    set_seed(seed)
    device = get_device()
    os.makedirs(output_dir, exist_ok=True)

    ws_dir = os.path.join(data_dir, "Water Supply")
    dr_dir = os.path.join(data_dir, "Drainage")
    wm_dir = os.path.join(data_dir, "Waste Management")
    roads_dir = os.path.join(data_dir, "Roads")
    sl_dir = os.path.join(data_dir, "Street Light")

    for d, name in [
        (ws_dir, "Water Supply"),
        (dr_dir, "Drainage"),
        (wm_dir, "Waste Management"),
        (roads_dir, "Roads"),
        (sl_dir, "Street Light")
    ]:
        if not os.path.isdir(d):
            raise FileNotFoundError(f"{name} data directory not found at: {d}")

    # 1. Stratified splits
    ws_train, ws_val, ws_test = split_watersupply_images(ws_dir, seed=seed)
    dr_train, dr_val, dr_test = split_drainage_images(dr_dir, seed=seed)
    wm_train, wm_val, wm_test = split_waste_images(wm_dir, seed=seed)
    roads_train, roads_val, roads_test = split_roads_images(roads_dir, seed=seed)
    sl_train, sl_val, sl_test = split_streetlight_images(sl_dir, seed=seed)

    train_samples = ws_train + dr_train + wm_train + roads_train + sl_train
    val_samples = ws_val + dr_val + wm_val + roads_val + sl_val
    test_samples = ws_test + dr_test + wm_test + roads_test + sl_test

    random.Random(seed).shuffle(train_samples)
    random.Random(seed).shuffle(val_samples)

    print("=" * 80)
    print(" MobileNetV3-Small Joint Fine-Tuning: Water Supply + Drainage + Roads + Street Light + Waste Management")
    print("=" * 80)
    print(f" Target Device: {device}")
    print(f" Preserved 6-Class Mapping: {SIX_CLASSES}")
    print(f"   [0] Drainage | [2] Roads | [3] Street Light | [4] Waste Management | [5] Water Supply")
    print(f" Water Supply Counts:     Train={len(ws_train)}, Val={len(ws_val)}, Test={len(ws_test)} (Total: {len(ws_train)+len(ws_val)+len(ws_test)})")
    print(f" Drainage Counts:         Train={len(dr_train)}, Val={len(dr_val)}, Test={len(dr_test)} (Total: {len(dr_train)+len(dr_val)+len(dr_test)})")
    print(f" Roads Counts:            Train={len(roads_train)}, Val={len(roads_val)}, Test={len(roads_test)} (Total: {len(roads_train)+len(roads_val)+len(roads_test)})")
    print(f" Street Light Counts:     Train={len(sl_train)}, Val={len(sl_val)}, Test={len(sl_test)} (Total: {len(sl_train)+len(sl_val)+len(sl_test)})")
    print(f" Waste Management Counts: Train={len(wm_train)}, Val={len(wm_val)}, Test={len(wm_test)} (Total: {len(wm_train)+len(wm_val)+len(wm_test)})")
    print(f" Combined Counts:         Train={len(train_samples)}, Val={len(val_samples)}, Test={len(test_samples)} (Total: {len(train_samples)+len(val_samples)+len(test_samples)})")
    print("=" * 80)

    # 2. Save test manifest for exact evaluation and reproducibility
    test_manifest_path = os.path.join(output_dir, "test_manifest.json")
    with open(test_manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "target_classes": ["Drainage", "Roads", "Street Light", "Waste Management", "Water Supply"],
            "classes": SIX_CLASSES,
            "class_to_idx": CLASS_TO_IDX,
            "watersupply_test_samples": [s[0] for s in ws_test],
            "drainage_test_samples": [s[0] for s in dr_test],
            "roads_test_samples": [s[0] for s in roads_test],
            "streetlight_test_samples": [s[0] for s in sl_test],
            "waste_management_test_samples": [s[0] for s in wm_test],
            "all_test_samples": [
                {"path": s[0], "class": SIX_CLASSES[s[1]], "class_idx": s[1]}
                for s in test_samples
            ],
            "counts": {
                "watersupply_test": len(ws_test),
                "drainage_test": len(dr_test),
                "roads_test": len(roads_test),
                "streetlight_test": len(sl_test),
                "waste_management_test": len(wm_test),
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

    # 4. Build Model & Load Starting Checkpoint
    model = build_mobilenet_v3_small(num_classes=6, pretrained=False)
    if not os.path.exists(base_checkpoint_path):
        raise FileNotFoundError(f"Starting checkpoint not found: {base_checkpoint_path}")
    print(f" Loading starting weights from: {base_checkpoint_path}")
    state_dict = torch.load(base_checkpoint_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state_dict)
    model = model.to(device)

    # 5. Class weighting for balanced gradient contribution across 5 active classes:
    # Drainage: 141, Roads: 143, Street Light: 105, Waste: 132, Water Supply: 105
    total_train = len(train_samples)
    weights = torch.ones(6, dtype=torch.float32, device=device)
    weights[DRAINAGE_CLASS_IDX] = total_train / (5.0 * len(dr_train))
    weights[ROADS_CLASS_IDX] = total_train / (5.0 * len(roads_train))
    weights[STREETLIGHT_CLASS_IDX] = total_train / (5.0 * len(sl_train))
    weights[WASTE_CLASS_IDX] = total_train / (5.0 * len(wm_train))
    weights[WATERSUPPLY_CLASS_IDX] = total_train / (5.0 * len(ws_train))
    print(f" Class weights: Drainage={weights[DRAINAGE_CLASS_IDX]:.4f}, Roads={weights[ROADS_CLASS_IDX]:.4f}, Street Light={weights[STREETLIGHT_CLASS_IDX]:.4f}, Waste Management={weights[WASTE_CLASS_IDX]:.4f}, Water Supply={weights[WATERSUPPLY_CLASS_IDX]:.4f}")

    criterion = nn.CrossEntropyLoss(weight=weights)

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "val_acc_drainage": [], "val_acc_roads": [], "val_acc_streetlight": [],
        "val_acc_waste": [], "val_acc_watersupply": [],
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
            c_corr = defaultdict(int)
            c_tot = defaultdict(int)
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
                        c_tot[t.item()] += 1
                        if p.item() == t.item():
                            c_corr[t.item()] += 1

            v_loss = v_loss / max(v_tot, 1)
            v_acc = v_corr / max(v_tot, 1)
            acc_dr = c_corr[DRAINAGE_CLASS_IDX] / max(c_tot[DRAINAGE_CLASS_IDX], 1)
            acc_rd = c_corr[ROADS_CLASS_IDX] / max(c_tot[ROADS_CLASS_IDX], 1)
            acc_sl = c_corr[STREETLIGHT_CLASS_IDX] / max(c_tot[STREETLIGHT_CLASS_IDX], 1)
            acc_wm = c_corr[WASTE_CLASS_IDX] / max(c_tot[WASTE_CLASS_IDX], 1)
            acc_ws = c_corr[WATERSUPPLY_CLASS_IDX] / max(c_tot[WATERSUPPLY_CLASS_IDX], 1)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["val_acc_drainage"].append(round(acc_dr, 4))
            history["val_acc_roads"].append(round(acc_rd, 4))
            history["val_acc_streetlight"].append(round(acc_sl, 4))
            history["val_acc_waste"].append(round(acc_wm, 4))
            history["val_acc_watersupply"].append(round(acc_ws, 4))
            history["phase"].append("phase1")

            print(f" [Phase 1 Ep {ep:02d}/{epochs_phase1:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% (WS: {acc_ws*100:.1f}%, Drainage: {acc_dr*100:.1f}%, Roads: {acc_rd*100:.1f}%, SL: {acc_sl*100:.1f}%, Waste: {acc_wm*100:.1f}%) ({dt:.1f}s)")

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
            c_corr = defaultdict(int)
            c_tot = defaultdict(int)
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
                        c_tot[t.item()] += 1
                        if p.item() == t.item():
                            c_corr[t.item()] += 1

            v_loss = v_loss / max(v_tot, 1)
            v_acc = v_corr / max(v_tot, 1)
            acc_dr = c_corr[DRAINAGE_CLASS_IDX] / max(c_tot[DRAINAGE_CLASS_IDX], 1)
            acc_rd = c_corr[ROADS_CLASS_IDX] / max(c_tot[ROADS_CLASS_IDX], 1)
            acc_sl = c_corr[STREETLIGHT_CLASS_IDX] / max(c_tot[STREETLIGHT_CLASS_IDX], 1)
            acc_wm = c_corr[WASTE_CLASS_IDX] / max(c_tot[WASTE_CLASS_IDX], 1)
            acc_ws = c_corr[WATERSUPPLY_CLASS_IDX] / max(c_tot[WATERSUPPLY_CLASS_IDX], 1)
            scheduler.step()
            dt = time.time() - t0

            history["train_loss"].append(round(t_loss, 4))
            history["train_acc"].append(round(t_acc, 4))
            history["val_loss"].append(round(v_loss, 4))
            history["val_acc"].append(round(v_acc, 4))
            history["val_acc_drainage"].append(round(acc_dr, 4))
            history["val_acc_roads"].append(round(acc_rd, 4))
            history["val_acc_streetlight"].append(round(acc_sl, 4))
            history["val_acc_waste"].append(round(acc_wm, 4))
            history["val_acc_watersupply"].append(round(acc_ws, 4))
            history["phase"].append("phase2")

            print(f" [Phase 2 Ep {ep:02d}/{epochs_phase2:02d}] Train Loss: {t_loss:.4f} Acc: {t_acc*100:.2f}% | "
                  f"Val Loss: {v_loss:.4f} Acc: {v_acc*100:.2f}% (WS: {acc_ws*100:.1f}%, Drainage: {acc_dr*100:.1f}%, Roads: {acc_rd*100:.1f}%, SL: {acc_sl*100:.1f}%, Waste: {acc_wm*100:.1f}%) ({dt:.1f}s)")

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
        "model_name": "MobileNetV3-Small-Civic-WaterSupplyV4",
        "architecture": "mobilenet_v3_small",
        "version": "1.5.0-water-supply-v4",
        "num_classes": 6,
        "classes": SIX_CLASSES,
        "class_to_idx": CLASS_TO_IDX,
        "input_size": [3, IMAGE_SIZE, IMAGE_SIZE],
        "image_size": IMAGE_SIZE,
        "input_mean": IMAGENET_MEAN,
        "input_std": IMAGENET_STD,
        "starting_checkpoint": base_checkpoint_path,
        "best_epoch": best_epoch,
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4),
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_samples": {
            "total_real_images": len(train_samples) + len(val_samples) + len(test_samples),
            "water_supply": {
                "total": len(ws_train) + len(ws_val) + len(ws_test),
                "train": len(ws_train),
                "val": len(ws_val),
                "test": len(ws_test)
            },
            "drainage": {
                "total": len(dr_train) + len(dr_val) + len(dr_test),
                "train": len(dr_train),
                "val": len(dr_val),
                "test": len(dr_test)
            },
            "roads": {
                "total": len(roads_train) + len(roads_val) + len(roads_test),
                "train": len(roads_train),
                "val": len(roads_val),
                "test": len(roads_test)
            },
            "street_light": {
                "total": len(sl_train) + len(sl_val) + len(sl_test),
                "train": len(sl_train),
                "val": len(sl_val),
                "test": len(sl_test)
            },
            "waste_management": {
                "total": len(wm_train) + len(wm_val) + len(wm_test),
                "train": len(wm_train),
                "val": len(wm_val),
                "test": len(wm_test)
            },
            "train_total": len(train_samples),
            "val_total": len(val_samples),
            "test_total": len(test_samples)
        },
        "real_data_classes": [
            "Drainage",
            "Roads",
            "Street Light",
            "Waste Management",
            "Water Supply"
        ],
        "training_notes": (
            "Fine-tuned jointly on verified real Water Supply (150), Drainage (202), Roads (205), Street Light (150), and Waste Management (189) imagery. "
            "Initialized from Drainage + Roads + Street Light + Waste Management checkpoint (ai/models_drainage_v3/best_model.pth). "
            "Full 6-class output architecture preserved. Remaining single class (Other) "
            "remains unrepresented by real datasets and routes to heuristic vision fallback."
        )
    }

    new_config_path = os.path.join(output_dir, "model_config.json")
    with open(new_config_path, "w", encoding="utf-8") as f:
        json.dump(new_config, f, indent=2)

    history_path = os.path.join(output_dir, "training_history.json")
    with open(history_path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)

    print("\n" + "=" * 80)
    print(" Joint Fine-Tuning Complete!")
    print(f" Best Validation Loss: {best_val_loss:.4f} (Epoch {best_epoch}) | Val Acc: {best_val_acc*100:.2f}%")
    print(f" Best Weights saved to: {new_weights_path}")
    print(f" Config saved to:        {new_config_path}")
    print(f" History saved to:       {history_path}")
    print("=" * 80)

    return new_config


def evaluate_and_generate_report(
    output_dir: str,
    base_v3_checkpoint: str
) -> Dict:
    """
    Evaluates the newly fine-tuned model against:
    1. Held-out Water Supply test set (23 images)
    2. Held-out Drainage test set (31 images)
    3. Held-out Roads test set (32 images)
    4. Held-out Street Light test set (23 images)
    5. Held-out Waste Management test set (29 images)
    6. Combined held-out test set (138 images)
    And compares against the previous checkpoint on the exact same held-out test images.
    """
    print("\n" + "=" * 80)
    print(" Comprehensive Evaluation on Held-Out Test Sets (138 Images)")
    print("=" * 80)

    manifest_path = os.path.join(output_dir, "test_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    ws_test_paths = manifest["watersupply_test_samples"]
    dr_test_paths = manifest["drainage_test_samples"]
    roads_test_paths = manifest["roads_test_samples"]
    sl_test_paths = manifest["streetlight_test_samples"]
    wm_test_paths = manifest["waste_management_test_samples"]
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

    y_true_ws, y_pred_ws, confs_ws = [], [], []
    y_true_dr, y_pred_dr, confs_dr = [], [], []
    y_true_rd, y_pred_rd, confs_rd = [], [], []
    y_true_sl, y_pred_sl, confs_sl = [], [], []
    y_true_wm, y_pred_wm, confs_wm = [], [], []

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

            if true_idx == WATERSUPPLY_CLASS_IDX:
                y_true_ws.append(true_idx)
                y_pred_ws.append(pred_idx)
                confs_ws.append(pred_conf)
            elif true_idx == DRAINAGE_CLASS_IDX:
                y_true_dr.append(true_idx)
                y_pred_dr.append(pred_idx)
                confs_dr.append(pred_conf)
            elif true_idx == ROADS_CLASS_IDX:
                y_true_rd.append(true_idx)
                y_pred_rd.append(pred_idx)
                confs_rd.append(pred_conf)
            elif true_idx == STREETLIGHT_CLASS_IDX:
                y_true_sl.append(true_idx)
                y_pred_sl.append(pred_idx)
                confs_sl.append(pred_conf)
            elif true_idx == WASTE_CLASS_IDX:
                y_true_wm.append(true_idx)
                y_pred_wm.append(pred_idx)
                confs_wm.append(pred_conf)

    # Overall metrics on real test set (5 active classes)
    test_acc_all = accuracy_score(y_true_all, y_pred_all)
    labels_eval = [DRAINAGE_CLASS_IDX, ROADS_CLASS_IDX, STREETLIGHT_CLASS_IDX, WASTE_CLASS_IDX, WATERSUPPLY_CLASS_IDX]
    precision_per_class, recall_per_class, f1_per_class, support_per_class = precision_recall_fscore_support(
        y_true_all, y_pred_all, labels=labels_eval, zero_division=0
    )

    macro_p = float(np.mean(precision_per_class))
    macro_r = float(np.mean(recall_per_class))
    macro_f1 = float(np.mean(f1_per_class))

    cm = confusion_matrix(y_true_all, y_pred_all, labels=range(6))

    ws_acc = accuracy_score(y_true_ws, y_pred_ws)
    dr_acc = accuracy_score(y_true_dr, y_pred_dr)
    rd_acc = accuracy_score(y_true_rd, y_pred_rd)
    sl_acc = accuracy_score(y_true_sl, y_pred_sl)
    wm_acc = accuracy_score(y_true_wm, y_pred_wm)

    # 2. Evaluate Previous (4-category) Checkpoint on the exact same test sets
    prev_model = build_mobilenet_v3_small(num_classes=6, pretrained=False)
    prev_model.load_state_dict(torch.load(base_v3_checkpoint, map_location="cpu", weights_only=True))
    prev_model.eval()

    prev_pred_ws = []
    prev_pred_dr = []
    prev_pred_rd = []
    prev_pred_sl = []
    prev_pred_wm = []
    with torch.no_grad():
        for p in ws_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_model(transform(img).unsqueeze(0)))[0]
            prev_pred_ws.append(torch.argmax(probs).item())
        for p in dr_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_model(transform(img).unsqueeze(0)))[0]
            prev_pred_dr.append(torch.argmax(probs).item())
        for p in roads_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_model(transform(img).unsqueeze(0)))[0]
            prev_pred_rd.append(torch.argmax(probs).item())
        for p in sl_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_model(transform(img).unsqueeze(0)))[0]
            prev_pred_sl.append(torch.argmax(probs).item())
        for p in wm_test_paths:
            img = load_and_validate_image(p)
            probs = softmax(prev_model(transform(img).unsqueeze(0)))[0]
            prev_pred_wm.append(torch.argmax(probs).item())

    prev_ws_acc = accuracy_score(y_true_ws, prev_pred_ws)
    prev_dr_acc = accuracy_score(y_true_dr, prev_pred_dr)
    prev_rd_acc = accuracy_score(y_true_rd, prev_pred_rd)
    prev_sl_acc = accuracy_score(y_true_sl, prev_pred_sl)
    prev_wm_acc = accuracy_score(y_true_wm, prev_pred_wm)

    report = {
        "evaluation_timestamp": datetime.utcnow().isoformat() + "Z",
        "new_model_checkpoint": new_weights,
        "base_checkpoint": base_v3_checkpoint,
        "test_counts": {
            "water_supply": len(ws_test_paths),
            "drainage": len(dr_test_paths),
            "roads": len(roads_test_paths),
            "street_light": len(sl_test_paths),
            "waste_management": len(wm_test_paths),
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
            "Drainage": {
                "class_index": DRAINAGE_CLASS_IDX,
                "test_support": int(support_per_class[0]),
                "accuracy": round(float(dr_acc), 4),
                "precision": round(float(precision_per_class[0]), 4),
                "recall": round(float(recall_per_class[0]), 4),
                "f1_score": round(float(f1_per_class[0]), 4),
                "mean_confidence": round(float(np.mean(confs_dr)), 4)
            },
            "Roads": {
                "class_index": ROADS_CLASS_IDX,
                "test_support": int(support_per_class[1]),
                "accuracy": round(float(rd_acc), 4),
                "precision": round(float(precision_per_class[1]), 4),
                "recall": round(float(recall_per_class[1]), 4),
                "f1_score": round(float(f1_per_class[1]), 4),
                "mean_confidence": round(float(np.mean(confs_rd)), 4)
            },
            "Street Light": {
                "class_index": STREETLIGHT_CLASS_IDX,
                "test_support": int(support_per_class[2]),
                "accuracy": round(float(sl_acc), 4),
                "precision": round(float(precision_per_class[2]), 4),
                "recall": round(float(recall_per_class[2]), 4),
                "f1_score": round(float(f1_per_class[2]), 4),
                "mean_confidence": round(float(np.mean(confs_sl)), 4)
            },
            "Waste Management": {
                "class_index": WASTE_CLASS_IDX,
                "test_support": int(support_per_class[3]),
                "accuracy": round(float(wm_acc), 4),
                "precision": round(float(precision_per_class[3]), 4),
                "recall": round(float(recall_per_class[3]), 4),
                "f1_score": round(float(f1_per_class[3]), 4),
                "mean_confidence": round(float(np.mean(confs_wm)), 4)
            },
            "Water Supply": {
                "class_index": WATERSUPPLY_CLASS_IDX,
                "test_support": int(support_per_class[4]),
                "accuracy": round(float(ws_acc), 4),
                "precision": round(float(precision_per_class[4]), 4),
                "recall": round(float(recall_per_class[4]), 4),
                "f1_score": round(float(f1_per_class[4]), 4),
                "mean_confidence": round(float(np.mean(confs_ws)), 4)
            }
        },
        "confusion_matrix_6class": {
            "classes": SIX_CLASSES,
            "matrix": cm.tolist()
        },
        "pairwise_confusion_analysis": {
            "drainage_vs_water_supply": {
                "drainage_confused_as_water_supply": int(cm[DRAINAGE_CLASS_IDX, WATERSUPPLY_CLASS_IDX]),
                "water_supply_confused_as_drainage": int(cm[WATERSUPPLY_CLASS_IDX, DRAINAGE_CLASS_IDX])
            },
            "roads_vs_drainage": {
                "roads_confused_as_drainage": int(cm[ROADS_CLASS_IDX, DRAINAGE_CLASS_IDX]),
                "drainage_confused_as_roads": int(cm[DRAINAGE_CLASS_IDX, ROADS_CLASS_IDX])
            },
            "waste_management_vs_drainage": {
                "waste_confused_as_drainage": int(cm[WASTE_CLASS_IDX, DRAINAGE_CLASS_IDX]),
                "drainage_confused_as_waste": int(cm[DRAINAGE_CLASS_IDX, WASTE_CLASS_IDX])
            }
        },
        "comparison_with_previous_checkpoint": {
            "water_supply_accuracy_previous": round(float(prev_ws_acc), 4),
            "water_supply_accuracy_new": round(float(ws_acc), 4),
            "water_supply_improvement_delta": round(float(ws_acc - prev_ws_acc), 4),
            "water_supply_classification_improved": bool(ws_acc > prev_ws_acc),
            "drainage_accuracy_previous": round(float(prev_dr_acc), 4),
            "drainage_accuracy_new": round(float(dr_acc), 4),
            "drainage_delta": round(float(dr_acc - prev_dr_acc), 4),
            "drainage_performance_preserved": bool(dr_acc >= 0.74),
            "roads_accuracy_previous": round(float(prev_rd_acc), 4),
            "roads_accuracy_new": round(float(rd_acc), 4),
            "roads_delta": round(float(rd_acc - prev_rd_acc), 4),
            "roads_performance_preserved": bool(rd_acc >= 0.84),
            "street_light_accuracy_previous": round(float(prev_sl_acc), 4),
            "street_light_accuracy_new": round(float(sl_acc), 4),
            "street_light_delta": round(float(sl_acc - prev_sl_acc), 4),
            "street_light_performance_preserved": bool(sl_acc >= 0.90),
            "waste_management_accuracy_previous": round(float(prev_wm_acc), 4),
            "waste_management_accuracy_new": round(float(wm_acc), 4),
            "waste_management_delta": round(float(wm_acc - prev_wm_acc), 4),
            "waste_performance_preserved": bool(wm_acc >= 0.90)
        },
        "unsupported_categories_limitations": {
            "classes_without_real_training_data": ["Other"],
            "explanation": (
                "Real labeled datasets are available now for Water Supply (150 images), Drainage (202 images), "
                "Roads (205 images), Street Light (150 images), and Waste Management (189 images). The 6-class output "
                "layer contract is preserved, but the model has NOT learned the single remaining class (Other) from real imagery. "
                "Any complaint classified in Other continues to use the calibrated heuristic vision fallback."
            )
        }
    }

    report_path = os.path.join(output_dir, "evaluation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nOverall Test Accuracy: {test_acc_all*100:.2f}% (138 held-out images)")
    print(f"Macro F1-Score:        {macro_f1:.4f}")
    print("\nPer-Class Breakdown:")
    print(f"  Water Supply:     Precision={precision_per_class[4]:.4f}, Recall={recall_per_class[4]:.4f}, F1={f1_per_class[4]:.4f} (Accuracy={ws_acc*100:.2f}%)")
    print(f"  Drainage:         Precision={precision_per_class[0]:.4f}, Recall={recall_per_class[0]:.4f}, F1={f1_per_class[0]:.4f} (Accuracy={dr_acc*100:.2f}%)")
    print(f"  Roads:            Precision={precision_per_class[1]:.4f}, Recall={recall_per_class[1]:.4f}, F1={f1_per_class[1]:.4f} (Accuracy={rd_acc*100:.2f}%)")
    print(f"  Street Light:     Precision={precision_per_class[2]:.4f}, Recall={recall_per_class[2]:.4f}, F1={f1_per_class[2]:.4f} (Accuracy={sl_acc*100:.2f}%)")
    print(f"  Waste Management: Precision={precision_per_class[3]:.4f}, Recall={recall_per_class[3]:.4f}, F1={f1_per_class[3]:.4f} (Accuracy={wm_acc*100:.2f}%)")
    print("\nComparison with Previous Checkpoint:")
    print(f"  Water Supply Accuracy:     {prev_ws_acc*100:.2f}% -> {ws_acc*100:.2f}% (Improved: {report['comparison_with_previous_checkpoint']['water_supply_classification_improved']})")
    print(f"  Drainage Accuracy:         {prev_dr_acc*100:.2f}% -> {dr_acc*100:.2f}% (Preserved: {report['comparison_with_previous_checkpoint']['drainage_performance_preserved']})")
    print(f"  Roads Accuracy:            {prev_rd_acc*100:.2f}% -> {rd_acc*100:.2f}% (Preserved: {report['comparison_with_previous_checkpoint']['roads_performance_preserved']})")
    print(f"  Street Light Accuracy:     {prev_sl_acc*100:.2f}% -> {sl_acc*100:.2f}% (Preserved: {report['comparison_with_previous_checkpoint']['street_light_performance_preserved']})")
    print(f"  Waste Management Accuracy: {prev_wm_acc*100:.2f}% -> {wm_acc*100:.2f}% (Preserved: {report['comparison_with_previous_checkpoint']['waste_performance_preserved']})")
    print("\nPairwise Confusion Checks:")
    print(f"  Drainage confused as Water Supply: {report['pairwise_confusion_analysis']['drainage_vs_water_supply']['drainage_confused_as_water_supply']}")
    print(f"  Water Supply confused as Drainage: {report['pairwise_confusion_analysis']['drainage_vs_water_supply']['water_supply_confused_as_drainage']}")
    print(f"  Roads confused as Drainage:        {report['pairwise_confusion_analysis']['roads_vs_drainage']['roads_confused_as_drainage']}")
    print(f"  Waste confused as Drainage:        {report['pairwise_confusion_analysis']['waste_management_vs_drainage']['waste_confused_as_drainage']}")
    print("\n6-Class Confusion Matrix:")
    print(cm)
    print(f"\nEvaluation Report saved to: {report_path}")

    return report


if __name__ == "__main__":
    ai_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(ai_dir, "data")
    output_dir = os.path.join(ai_dir, "models_water_supply_v4")
    base_checkpoint = os.path.join(ai_dir, "models_drainage_v3", "best_model.pth")

    print("Starting Joint Fine-Tuning with Water Supply (5 Categories)...")
    print(f"Data Dir:        {data_dir}")
    print(f"Output Dir:      {output_dir}")
    print(f"Base Checkpoint: {base_checkpoint}")

    run_joint_fine_tuning(
        data_dir=data_dir,
        output_dir=output_dir,
        base_checkpoint_path=base_checkpoint,
        epochs_phase1=5,
        epochs_phase2=5,
        batch_size=16,
        lr_phase1=3.5e-4,
        lr_phase2=3.5e-5,
        seed=42
    )

    evaluate_and_generate_report(
        output_dir=output_dir,
        base_v3_checkpoint=base_checkpoint
    )
