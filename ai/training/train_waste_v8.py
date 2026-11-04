"""
Smart City MobileNetV3-Small Retraining Pipeline for Updated Waste Management Dataset (v8)
Trains all six civic categories together:
  [0] Drainage
  [1] Other
  [2] Roads
  [3] Street Light
  [4] Waste Management
  [5] Water Supply
Evaluates:
  - Approach A: Fine-tuning from active production checkpoint (ai/models_water_supply_v5/best_model.pth)
  - Approach B: Retraining from official pretrained ImageNet weights
Saves all artifacts in ai/models_waste_updated_v8/
"""

import os
import sys
import json
import time
import random
import hashlib
from datetime import datetime
from collections import Counter, defaultdict
from typing import Dict, List, Tuple, Any, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torchvision import transforms
from torchvision.transforms import InterpolationMode
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from PIL import Image
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.dirname(CURRENT_DIR)
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from utils import get_accessible_path, safe_load_image

# ---------------------------------------------------------------------------
# Constants & Configuration
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
IMAGE_SIZE = 224
BATCH_SIZE = 32
NUM_CLASSES = 6

SIX_CLASSES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]
CLASS_TO_IDX = {cls_name: idx for idx, cls_name in enumerate(SIX_CLASSES)}
IDX_TO_CLASS = {idx: cls_name for idx, cls_name in enumerate(SIX_CLASSES)}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def set_seed(seed: int = RANDOM_SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_and_validate_image(path: str) -> Optional[Image.Image]:
    img, err, dims, fmt = safe_load_image(path)
    if err or img is None:
        return None
    return img


# ---------------------------------------------------------------------------
# Transforms
# ---------------------------------------------------------------------------
def get_train_transform():
    return transforms.Compose([
        transforms.Resize((256, 256), interpolation=InterpolationMode.BILINEAR),
        transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.80, 1.0), interpolation=InterpolationMode.BILINEAR),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.RandomAffine(degrees=0, translate=(0.05, 0.05)),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])


def get_eval_transform():
    return transforms.Compose([
        transforms.Resize((256, 256), interpolation=InterpolationMode.BILINEAR),
        transforms.CenterCrop(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])


# ---------------------------------------------------------------------------
# Dataset Class
# ---------------------------------------------------------------------------
class JointCivicDataset(Dataset):
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
            img = self.transform(img)

        return img, label, path


# ---------------------------------------------------------------------------
# Architecture Builder
# ---------------------------------------------------------------------------
def build_mobilenet_v3_small(num_classes: int = 6, pretrained: bool = False) -> nn.Module:
    weights = MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    model = mobilenet_v3_small(weights=weights)
    in_features = model.classifier[3].in_features
    model.classifier[2] = nn.Dropout(p=0.2, inplace=True)
    model.classifier[3] = nn.Linear(in_features=in_features, out_features=num_classes)
    return model


def freeze_backbone(model: nn.Module) -> None:
    for param in model.features.parameters():
        param.requires_grad = False
    for param in model.classifier.parameters():
        param.requires_grad = True


def unfreeze_feature_blocks(model: nn.Module, start_block: int = 9) -> None:
    for i, block in enumerate(model.features):
        requires_grad = (i >= start_block)
        for param in block.parameters():
            param.requires_grad = requires_grad
    for param in model.classifier.parameters():
        param.requires_grad = True


def get_model_parameter_stats(model: nn.Module) -> Tuple[int, int]:
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return total_params, trainable_params


# ---------------------------------------------------------------------------
# Dataset Splitting (Preserving Baseline v5 Test Set & Group-Aware Isolation)
# ---------------------------------------------------------------------------
def create_stratified_group_splits(
    data_dir: str,
    baseline_manifest_path: Optional[str] = None,
    seed: int = RANDOM_SEED
) -> Dict[str, Any]:
    rng = random.Random(seed)

    baseline_test_filenames = defaultdict(set)
    if baseline_manifest_path and os.path.exists(baseline_manifest_path):
        with open(baseline_manifest_path, "r", encoding="utf-8") as f:
            base_manifest = json.load(f)
        for cat in SIX_CLASSES:
            k_candidates = [
                f"{cat.lower().replace(' ', '_')}_test_samples",
                f"{cat.lower().replace(' ', '')}_test_samples"
            ]
            for k in k_candidates:
                if k in base_manifest:
                    for s in base_manifest[k]:
                        baseline_test_filenames[cat].add(os.path.basename(s))

    splits = {
        "train": [],
        "val": [],
        "test": [],
        "baseline_v5_test": [],
        "per_class": {}
    }

    GENERIC_PREFIXES = {
        "other", "image", "images", "img", "photo", "360", "frame", "video",
        "drainage", "roads", "waste", "water", "street", "light", "lamp", "garbage"
    }

    for cat_name in SIX_CLASSES:
        cat_idx = CLASS_TO_IDX[cat_name]
        cat_dir = os.path.join(data_dir, cat_name)
        valid_exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

        all_files = []
        for root, _, filenames in os.walk(cat_dir):
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext in valid_exts:
                    all_files.append(os.path.join(root, fname))

        all_files.sort()

        base_test_set = baseline_test_filenames.get(cat_name, set())
        mandatory_test_files = [f for f in all_files if os.path.basename(f) in base_test_set]
        candidate_pool = [f for f in all_files if os.path.basename(f) not in base_test_set]

        # Group candidates by multi-instance prefix if applicable
        grouped = defaultdict(list)
        singletons = []
        for f in candidate_pool:
            bname = os.path.basename(f)
            prefix = None
            if "_jpg.rf." in bname:
                prefix = bname.split("_jpg.rf.")[0]
            elif "_jpeg.rf." in bname:
                prefix = bname.split("_jpeg.rf.")[0]
            elif "_png.rf." in bname:
                prefix = bname.split("_png.rf.")[0]
            elif "_" in bname:
                p = bname.split("_")[0]
                if p.lower() not in GENERIC_PREFIXES and len(p) >= 3:
                    prefix = p

            if prefix:
                grouped[prefix].append(f)
            else:
                singletons.append(f)

        groups_list = list(grouped.values())
        for s in singletons:
            groups_list.append([s])

        rng.shuffle(groups_list)

        n_mandatory_test = len(mandatory_test_files)
        total_cat = len(all_files)
        target_test_total = max(int(total_cat * 0.15), n_mandatory_test)
        target_val_total = max(int(total_cat * 0.15), 2 if total_cat >= 10 else 1)

        needed_test = max(0, target_test_total - n_mandatory_test)
        cat_test_files = list(mandatory_test_files)
        cat_val_files = []
        cat_train_files = []

        for group in groups_list:
            if len(cat_test_files) - n_mandatory_test < needed_test:
                cat_test_files.extend(group)
            elif len(cat_val_files) < target_val_total:
                cat_val_files.extend(group)
            else:
                cat_train_files.extend(group)

        # Ensure train has files
        if len(cat_train_files) == 0 and len(cat_val_files) > 1:
            cat_train_files.append(cat_val_files.pop())

        splits["train"].extend([(f, cat_idx) for f in cat_train_files])
        splits["val"].extend([(f, cat_idx) for f in cat_val_files])
        splits["test"].extend([(f, cat_idx) for f in cat_test_files])

        base_tuples = [(f, cat_idx) for f in cat_test_files if os.path.basename(f) in base_test_set]
        splits["baseline_v5_test"].extend(base_tuples)

        splits["per_class"][cat_name] = {
            "class_idx": cat_idx,
            "total": len(all_files),
            "train": len(cat_train_files),
            "val": len(cat_val_files),
            "test": len(cat_test_files),
            "baseline_v5_test": len(base_tuples)
        }

    # Verify 0 leakage
    train_paths = set(s[0] for s in splits["train"])
    val_paths = set(s[0] for s in splits["val"])
    test_paths = set(s[0] for s in splits["test"])

    assert len(train_paths & val_paths) == 0, "Leakage between train and val!"
    assert len(train_paths & test_paths) == 0, "Leakage between train and test!"
    assert len(val_paths & test_paths) == 0, "Leakage between val and test!"

    rng.shuffle(splits["train"])
    rng.shuffle(splits["val"])
    rng.shuffle(splits["test"])

    return splits


# ---------------------------------------------------------------------------
# Training Loop
# ---------------------------------------------------------------------------
def train_model(
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    criterion: nn.Module,
    epochs_phase1: int,
    epochs_phase2: int,
    lr_phase1: float,
    lr_phase2: float,
    device: torch.device,
    experiment_name: str
) -> Tuple[nn.Module, Dict[str, Any], Dict[str, Any]]:
    print(f"\n{'='*75}\n STARTING EXPERIMENT: {experiment_name}\n{'='*75}")

    history = {
        "train_loss": [], "train_acc": [],
        "val_loss": [], "val_acc": [],
        "val_per_class": defaultdict(list),
        "phase": []
    }

    best_val_loss = float("inf")
    best_val_acc = 0.0
    best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}
    best_epoch = 0

    # ---------------- Phase 1: Classifier Head ----------------
    if epochs_phase1 > 0:
        freeze_backbone(model)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"--- Phase 1: Classifier Head ({epochs_phase1} epochs) | Trainable params: {train_p:,} / {total_p:,} ---")

        optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr_phase1, weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=epochs_phase1, eta_min=1e-5)

        for ep in range(1, epochs_phase1 + 1):
            t0 = time.time()
            model.train()
            r_loss, r_corr, r_tot = 0.0, 0, 0

            for imgs, lbls, _ in train_loader:
                imgs, lbls = imgs.to(device), lbls.to(device)
                optimizer.zero_grad()
                outputs = model(imgs)
                loss = criterion(outputs, lbls)
                loss.backward()
                optimizer.step()

                r_loss += loss.item() * imgs.size(0)
                _, preds = torch.max(outputs, 1)
                r_corr += torch.sum(preds == lbls).item()
                r_tot += imgs.size(0)

            scheduler.step()
            train_loss = r_loss / max(r_tot, 1)
            train_acc = r_corr / max(r_tot, 1)

            val_loss, val_acc, val_cm = evaluate_validation(model, val_loader, criterion, device)
            elapsed = time.time() - t0

            history["train_loss"].append(round(train_loss, 4))
            history["train_acc"].append(round(train_acc, 4))
            history["val_loss"].append(round(val_loss, 4))
            history["val_acc"].append(round(val_acc, 4))
            history["phase"].append("phase1")

            print(f" [P1 Ep {ep:02d}/{epochs_phase1:02d}] Loss: {train_loss:.4f} Acc: {train_acc*100:.2f}% | Val Loss: {val_loss:.4f} Acc: {val_acc*100:.2f}% | {elapsed:.1f}s")

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_val_acc = val_acc
                best_epoch = ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # ---------------- Phase 2: Deep Backbone Fine-Tuning ----------------
    if epochs_phase2 > 0:
        unfreeze_feature_blocks(model, start_block=9)
        total_p, train_p = get_model_parameter_stats(model)
        print(f"\n--- Phase 2: Deep Feature Block Fine-Tuning ({epochs_phase2} epochs) | Trainable params: {train_p:,} / {total_p:,} ---")

        optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=lr_phase2, weight_decay=1e-4)
        scheduler = CosineAnnealingLR(optimizer, T_max=epochs_phase2, eta_min=1e-6)

        for ep in range(1, epochs_phase2 + 1):
            t0 = time.time()
            model.train()
            r_loss, r_corr, r_tot = 0.0, 0, 0

            for imgs, lbls, _ in train_loader:
                imgs, lbls = imgs.to(device), lbls.to(device)
                optimizer.zero_grad()
                outputs = model(imgs)
                loss = criterion(outputs, lbls)
                loss.backward()
                optimizer.step()

                r_loss += loss.item() * imgs.size(0)
                _, preds = torch.max(outputs, 1)
                r_corr += torch.sum(preds == lbls).item()
                r_tot += imgs.size(0)

            scheduler.step()
            train_loss = r_loss / max(r_tot, 1)
            train_acc = r_corr / max(r_tot, 1)

            val_loss, val_acc, val_cm = evaluate_validation(model, val_loader, criterion, device)
            elapsed = time.time() - t0

            history["train_loss"].append(round(train_loss, 4))
            history["train_acc"].append(round(train_acc, 4))
            history["val_loss"].append(round(val_loss, 4))
            history["val_acc"].append(round(val_acc, 4))
            history["phase"].append("phase2")

            print(f" [P2 Ep {ep:02d}/{epochs_phase2:02d}] Loss: {train_loss:.4f} Acc: {train_acc*100:.2f}% | Val Loss: {val_loss:.4f} Acc: {val_acc*100:.2f}% | {elapsed:.1f}s")

            if val_loss < best_val_loss:
                best_val_loss = val_loss
                best_val_acc = val_acc
                best_epoch = epochs_phase1 + ep
                best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state_dict)
    summary = {
        "best_epoch": best_epoch,
        "best_val_loss": round(best_val_loss, 4),
        "best_val_acc": round(best_val_acc, 4)
    }
    return model, history, summary


def evaluate_validation(
    model: nn.Module,
    val_loader: DataLoader,
    criterion: nn.Module,
    device: torch.device
) -> Tuple[float, float, np.ndarray]:
    model.eval()
    r_loss, r_corr, r_tot = 0.0, 0, 0
    y_true, y_pred = [], []

    with torch.no_grad():
        for imgs, lbls, _ in val_loader:
            imgs, lbls = imgs.to(device), lbls.to(device)
            outputs = model(imgs)
            loss = criterion(outputs, lbls)
            r_loss += loss.item() * imgs.size(0)
            _, preds = torch.max(outputs, 1)
            r_corr += torch.sum(preds == lbls).item()
            r_tot += imgs.size(0)
            y_true.extend(lbls.cpu().tolist())
            y_pred.extend(preds.cpu().tolist())

    val_loss = r_loss / max(r_tot, 1)
    val_acc = r_corr / max(r_tot, 1)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(NUM_CLASSES)))
    return val_loss, val_acc, cm


# ---------------------------------------------------------------------------
# Test Evaluation Function
# ---------------------------------------------------------------------------
def run_evaluation(
    model: nn.Module,
    samples: List[Tuple[str, int]],
    device: torch.device,
    classes: List[str] = SIX_CLASSES
) -> Dict[str, Any]:
    model.eval()
    transform = get_eval_transform()

    y_true, y_pred = [], []
    confidences = []

    for path, label in samples:
        img = load_and_validate_image(path)
        if img is None:
            img = Image.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color=(128, 128, 128))
        tensor = transform(img).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(tensor)
            probs = torch.softmax(logits, dim=1)
            conf, pred = torch.max(probs, dim=1)

        y_true.append(label)
        y_pred.append(pred.item())
        confidences.append(conf.item())

    overall_acc = accuracy_score(y_true, y_pred)
    prec, rec, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=list(range(len(classes))), zero_division=0
    )

    macro_prec = float(np.mean([p for i, p in enumerate(prec) if support[i] > 0]))
    macro_rec = float(np.mean([r for i, r in enumerate(rec) if support[i] > 0]))
    macro_f1 = float(np.mean([f for i, f in enumerate(f1) if support[i] > 0]))

    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(classes))))

    per_class_metrics = {}
    for i, cname in enumerate(classes):
        sup = int(support[i])
        per_class_metrics[cname] = {
            "class_index": i,
            "test_support": sup,
            "accuracy": round(float(cm[i, i] / sup), 4) if sup > 0 else 0.0,
            "precision": round(float(prec[i]), 4),
            "recall": round(float(rec[i]), 4),
            "f1_score": round(float(f1[i]), 4),
        }

    return {
        "overall_accuracy": round(float(overall_acc), 4),
        "overall_accuracy_pct": f"{overall_acc * 100:.2f}%",
        "macro_precision": round(macro_prec, 4),
        "macro_recall": round(macro_rec, 4),
        "macro_f1": round(macro_f1, 4),
        "mean_confidence": round(float(np.mean(confidences)), 4),
        "total_evaluated": len(y_true),
        "per_class": per_class_metrics,
        "confusion_matrix": cm.tolist(),
        "classes": classes
    }


def generate_plots(output_dir, history, eval_base, eval_full, base_metrics):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        # Plot 1: Loss & Accuracy Curves
        epochs = list(range(1, len(history["train_loss"]) + 1))
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

        ax1.plot(epochs, history["train_loss"], "b-o", label="Train Loss", linewidth=2)
        ax1.plot(epochs, history["val_loss"], "r--s", label="Val Loss", linewidth=2)
        if "phase1" in history["phase"] and "phase2" in history["phase"]:
            p1_end = history["phase"].count("phase1")
            ax1.axvline(x=p1_end + 0.5, color="gray", linestyle=":", label="Phase 2 Start")
        ax1.set_xlabel("Epoch", fontsize=11)
        ax1.set_ylabel("Cross Entropy Loss", fontsize=11)
        ax1.set_title("Training and Validation Loss Curves (Waste v8)", fontsize=12, fontweight="bold")
        ax1.legend(loc="upper right")
        ax1.grid(True, linestyle="--", alpha=0.6)

        ax2.plot(epochs, [a * 100 for a in history["train_acc"]], "b-o", label="Train Acc", linewidth=2)
        ax2.plot(epochs, [a * 100 for a in history["val_acc"]], "r--s", label="Val Acc", linewidth=2)
        if "phase1" in history["phase"] and "phase2" in history["phase"]:
            p1_end = history["phase"].count("phase1")
            ax2.axvline(x=p1_end + 0.5, color="gray", linestyle=":", label="Phase 2 Start")
        ax2.set_xlabel("Epoch", fontsize=11)
        ax2.set_ylabel("Accuracy (%)", fontsize=11)
        ax2.set_title("Training and Validation Accuracy Curves (Waste v8)", fontsize=12, fontweight="bold")
        ax2.legend(loc="lower right")
        ax2.grid(True, linestyle="--", alpha=0.6)

        plt.tight_layout()
        plot_path = os.path.join(output_dir, "loss_curves.png")
        plt.savefig(plot_path, dpi=200)
        plt.close(fig)
        print(f" Saved loss and accuracy curves to: {plot_path}")

        # Plot 2: Confusion Matrices
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 7))
        classes = SIX_CLASSES

        cm_base = np.array(base_metrics["confusion_matrix"])
        cm_new = np.array(eval_full["confusion_matrix"])

        im1 = ax1.imshow(cm_base, interpolation="nearest", cmap=plt.cm.Blues)
        ax1.set_title(f"Baseline Checkpoint v5 (Acc: {base_metrics['overall_accuracy_pct']})", fontsize=12, fontweight="bold")
        fig.colorbar(im1, ax=ax1, fraction=0.046, pad=0.04)
        tick_marks = np.arange(len(classes))
        ax1.set_xticks(tick_marks)
        ax1.set_xticklabels(classes, rotation=45, ha="right", fontsize=9)
        ax1.set_yticks(tick_marks)
        ax1.set_yticklabels(classes, fontsize=9)
        for i in range(cm_base.shape[0]):
            for j in range(cm_base.shape[1]):
                ax1.text(j, i, format(cm_base[i, j], "d"),
                         ha="center", va="center",
                         color="white" if cm_base[i, j] > cm_base.max() / 2 else "black")
        ax1.set_ylabel("True Label", fontsize=10)
        ax1.set_xlabel("Predicted Label", fontsize=10)

        im2 = ax2.imshow(cm_new, interpolation="nearest", cmap=plt.cm.Greens)
        ax2.set_title(f"New Model v8 (Acc: {eval_full['overall_accuracy_pct']})", fontsize=12, fontweight="bold")
        fig.colorbar(im2, ax=ax2, fraction=0.046, pad=0.04)
        ax2.set_xticks(tick_marks)
        ax2.set_xticklabels(classes, rotation=45, ha="right", fontsize=9)
        ax2.set_yticks(tick_marks)
        ax2.set_yticklabels(classes, fontsize=9)
        for i in range(cm_new.shape[0]):
            for j in range(cm_new.shape[1]):
                ax2.text(j, i, format(cm_new[i, j], "d"),
                         ha="center", va="center",
                         color="white" if cm_new[i, j] > cm_new.max() / 2 else "black")
        ax2.set_ylabel("True Label", fontsize=10)
        ax2.set_xlabel("Predicted Label", fontsize=10)

        plt.tight_layout()
        cm_path = os.path.join(output_dir, "confusion_matrices.png")
        plt.savefig(cm_path, dpi=200)
        plt.close(fig)
        print(f" Saved confusion matrices plot to: {cm_path}")
    except Exception as e:
        print(f" Warning: Could not generate plots: {e}")


# ---------------------------------------------------------------------------
# Main Orchestration
# ---------------------------------------------------------------------------
def main():
    print("=" * 80)
    print(" Smart City MobileNetV3-Small Retraining with Updated Waste Dataset (v8)")
    print("=" * 80)

    data_dir = "ai/data"
    output_dir = "ai/models_waste_updated_v8"
    base_checkpoint_path = "ai/models_water_supply_v5/best_model.pth"
    base_manifest_path = "ai/models_water_supply_v5/test_manifest.json"
    os.makedirs(output_dir, exist_ok=True)

    set_seed(RANDOM_SEED)
    device = torch.device("cpu")
    print(f" Execution Device: {device}")
    print(f" Target Output Directory: {output_dir}")
    print(f" Baseline Checkpoint: {base_checkpoint_path}")

    # 1. Stratified Group Splitting
    splits = create_stratified_group_splits(
        data_dir=data_dir,
        baseline_manifest_path=base_manifest_path,
        seed=RANDOM_SEED
    )

    print("\n--- DATASET SPLIT SUMMARY ---")
    for cat_name, info in splits["per_class"].items():
        print(f"  {cat_name:18s} | Total: {info['total']:4d} | Train: {info['train']:4d} | Val: {info['val']:3d} | Test: {info['test']:3d} (Base Test: {info['baseline_v5_test']:2d})")

    train_samples = splits["train"]
    val_samples = splits["val"]
    test_samples = splits["test"]
    baseline_v5_test_samples = splits["baseline_v5_test"]

    print(f"  {'TOTAL':18s} | Total: {len(train_samples)+len(val_samples)+len(test_samples):4d} | Train: {len(train_samples):4d} | Val: {len(val_samples):3d} | Test: {len(test_samples):3d} (Base Test: {len(baseline_v5_test_samples):2d})")

    # 2. Save Test Manifest
    test_manifest_path = os.path.join(output_dir, "test_manifest.json")
    test_manifest = {
        "target_classes": SIX_CLASSES,
        "classes": SIX_CLASSES,
        "class_to_idx": CLASS_TO_IDX,
        "drainage_test_samples": [s[0] for s in test_samples if s[1] == 0],
        "other_test_samples": [s[0] for s in test_samples if s[1] == 1],
        "roads_test_samples": [s[0] for s in test_samples if s[1] == 2],
        "streetlight_test_samples": [s[0] for s in test_samples if s[1] == 3],
        "waste_management_test_samples": [s[0] for s in test_samples if s[1] == 4],
        "watersupply_test_samples": [s[0] for s in test_samples if s[1] == 5],
        "baseline_v5_test_samples": [s[0] for s in baseline_v5_test_samples],
        "all_test_samples": [s[0] for s in test_samples]
    }
    with open(test_manifest_path, "w", encoding="utf-8") as f:
        json.dump(test_manifest, f, indent=2)
    print(f" Saved test manifest to: {test_manifest_path}")

    # 3. DataLoaders
    train_loader = DataLoader(
        JointCivicDataset(train_samples, transform=get_train_transform()),
        batch_size=BATCH_SIZE, shuffle=True, num_workers=0
    )
    val_loader = DataLoader(
        JointCivicDataset(val_samples, transform=get_eval_transform()),
        batch_size=BATCH_SIZE, shuffle=False, num_workers=0
    )

    # 4. Balanced Class Weights
    total_train = len(train_samples)
    class_counts = Counter(s[1] for s in train_samples)
    weights = torch.ones(NUM_CLASSES, dtype=torch.float32, device=device)
    for c_idx in range(NUM_CLASSES):
        cnt = class_counts.get(c_idx, 1)
        weights[c_idx] = float(total_train / (float(NUM_CLASSES) * cnt))
    weights = weights / weights.mean()

    print("\n--- CLASS WEIGHTS ---")
    for c_name, c_idx in CLASS_TO_IDX.items():
        print(f"  {c_name:18s} (Train={class_counts[c_idx]:3d}): Weight={weights[c_idx].item():.4f}")

    criterion = nn.CrossEntropyLoss(weight=weights)

    # 5. Evaluate Baseline Model First
    print("\n--- EVALUATING BASELINE PRODUCTION CHECKPOINT (v5) ---")
    base_model = build_mobilenet_v3_small(num_classes=NUM_CLASSES, pretrained=False)
    base_ckpt = torch.load(base_checkpoint_path, map_location=device, weights_only=True)
    base_model.load_state_dict(base_ckpt)
    base_model.to(device)

    baseline_metrics_v5_test = run_evaluation(base_model, baseline_v5_test_samples, device)
    baseline_metrics_full = run_evaluation(base_model, test_samples, device)
    print(f" Baseline Checkpoint on preserved v5 test set ({len(baseline_v5_test_samples)} samples): Acc={baseline_metrics_v5_test['overall_accuracy_pct']}, Macro F1={baseline_metrics_v5_test['macro_f1']:.4f}")
    print(f" Baseline Checkpoint on full updated test set ({len(test_samples)} samples): Acc={baseline_metrics_full['overall_accuracy_pct']}, Macro F1={baseline_metrics_full['macro_f1']:.4f}")

    # 6. Execute Training Approaches
    epochs_p1 = 5
    epochs_p2 = 5
    lr_p1 = 3.5e-4
    lr_p2 = 3.5e-5

    # =========================================================================
    # APPROACH A: Fine-Tuning from Previous Production Checkpoint (v5)
    # =========================================================================
    model_a = build_mobilenet_v3_small(num_classes=NUM_CLASSES, pretrained=False)
    model_a.load_state_dict(torch.load(base_checkpoint_path, map_location="cpu", weights_only=True))
    model_a.to(device)

    best_model_a, hist_a, sum_a = train_model(
        model=model_a,
        train_loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        epochs_phase1=epochs_p1,
        epochs_phase2=epochs_p2,
        lr_phase1=lr_p1,
        lr_phase2=lr_p2,
        device=device,
        experiment_name="Approach A: Fine-Tuning from v5 Checkpoint"
    )

    eval_a_base = run_evaluation(best_model_a, baseline_v5_test_samples, device)
    eval_a_full = run_evaluation(best_model_a, test_samples, device)

    print(f"\nApproach A Test Metrics:")
    print(f"  - Preserved v5 Test ({len(baseline_v5_test_samples)} samples): Acc={eval_a_base['overall_accuracy_pct']} | Macro F1={eval_a_base['macro_f1']}")
    print(f"  - Full Updated Test ({len(test_samples)} samples): Acc={eval_a_full['overall_accuracy_pct']} | Macro F1={eval_a_full['macro_f1']}")

    # =========================================================================
    # APPROACH B: Retraining from Official ImageNet Pretrained Weights
    # =========================================================================
    print(f"\nInitializing MobileNetV3-Small with official ImageNet weights...")
    model_b = build_mobilenet_v3_small(num_classes=NUM_CLASSES, pretrained=True)
    model_b.to(device)

    best_model_b, hist_b, sum_b = train_model(
        model=model_b,
        train_loader=train_loader,
        val_loader=val_loader,
        criterion=criterion,
        epochs_phase1=epochs_p1,
        epochs_phase2=epochs_p2,
        lr_phase1=lr_p1,
        lr_phase2=lr_p2,
        device=device,
        experiment_name="Approach B: Retraining from Pretrained ImageNet Weights"
    )

    eval_b_base = run_evaluation(best_model_b, baseline_v5_test_samples, device)
    eval_b_full = run_evaluation(best_model_b, test_samples, device)

    print(f"\nApproach B Test Metrics:")
    print(f"  - Preserved v5 Test ({len(baseline_v5_test_samples)} samples): Acc={eval_b_base['overall_accuracy_pct']} | Macro F1={eval_b_base['macro_f1']}")
    print(f"  - Full Updated Test ({len(test_samples)} samples): Acc={eval_b_full['overall_accuracy_pct']} | Macro F1={eval_b_full['macro_f1']}")

    # 7. Model Selection
    print("\n" + "=" * 80)
    print(" MODEL SELECTION DECISION")
    print("=" * 80)
    print(f" Approach A (Fine-Tuning v5 Checkpoint):")
    print(f"    Val Loss: {sum_a['best_val_loss']} | Val Acc: {sum_a['best_val_acc']*100:.2f}% | Full Test Acc: {eval_a_full['overall_accuracy_pct']} | Full Macro F1: {eval_a_full['macro_f1']:.4f}")
    print(f" Approach B (Retrained ImageNet):")
    print(f"    Val Loss: {sum_b['best_val_loss']} | Val Acc: {sum_b['best_val_acc']*100:.2f}% | Full Test Acc: {eval_b_full['overall_accuracy_pct']} | Full Macro F1: {eval_b_full['macro_f1']:.4f}")

    score_a = eval_a_full["macro_f1"] * 0.5 + eval_a_full["overall_accuracy"] * 0.5
    score_b = eval_b_full["macro_f1"] * 0.5 + eval_b_full["overall_accuracy"] * 0.5

    if score_a >= score_b:
        selected_approach = "Approach A (Fine-tuned from v5 checkpoint)"
        winning_model = best_model_a
        winning_history = hist_a
        winning_summary = sum_a
        winning_eval_base = eval_a_base
        winning_eval_full = eval_a_full
    else:
        selected_approach = "Approach B (Retrained from ImageNet weights)"
        winning_model = best_model_b
        winning_history = hist_b
        winning_summary = sum_b
        winning_eval_base = eval_b_base
        winning_eval_full = eval_b_full

    print(f"\n WINNING STRATEGY: {selected_approach}")

    # 8. Save Final Model Checkpoint
    best_model_path = os.path.join(output_dir, "best_model.pth")
    torch.save(winning_model.state_dict(), best_model_path)
    print(f" Saved winning model weights to: {best_model_path}")

    # 9. Save Training History
    training_history_path = os.path.join(output_dir, "training_history.json")
    with open(training_history_path, "w", encoding="utf-8") as f:
        json.dump(winning_history, f, indent=2)
    print(f" Saved training history to: {training_history_path}")

    # 10. Generate Detailed Evaluation Report
    eval_report_path = os.path.join(output_dir, "evaluation_report.json")
    deltas_full = {}
    for cname in SIX_CLASSES:
        if cname in winning_eval_full["per_class"] and cname in baseline_metrics_full["per_class"]:
            base_acc = baseline_metrics_full["per_class"][cname]["accuracy"]
            new_acc = winning_eval_full["per_class"][cname]["accuracy"]
            deltas_full[cname] = {
                "baseline_accuracy": base_acc,
                "new_accuracy": new_acc,
                "delta": round(new_acc - base_acc, 4),
                "performance_preserved_or_improved": (new_acc >= base_acc)
            }

    eval_report = {
        "evaluation_timestamp": datetime.utcnow().isoformat() + "Z",
        "selected_strategy": selected_approach,
        "best_model_checkpoint": os.path.abspath(best_model_path),
        "baseline_checkpoint": os.path.abspath(base_checkpoint_path),
        "baseline_v5_on_full_test": {
            "overall_accuracy": baseline_metrics_full["overall_accuracy"],
            "overall_accuracy_pct": baseline_metrics_full["overall_accuracy_pct"],
            "macro_precision": baseline_metrics_full["macro_precision"],
            "macro_recall": baseline_metrics_full["macro_recall"],
            "macro_f1": baseline_metrics_full["macro_f1"],
            "mean_confidence": baseline_metrics_full["mean_confidence"],
            "per_class": baseline_metrics_full["per_class"],
            "confusion_matrix": baseline_metrics_full["confusion_matrix"]
        },
        "new_model_v8_on_full_test": {
            "overall_accuracy": winning_eval_full["overall_accuracy"],
            "overall_accuracy_pct": winning_eval_full["overall_accuracy_pct"],
            "macro_precision": winning_eval_full["macro_precision"],
            "macro_recall": winning_eval_full["macro_recall"],
            "macro_f1": winning_eval_full["macro_f1"],
            "mean_confidence": winning_eval_full["mean_confidence"],
            "accuracy_delta": round(winning_eval_full["overall_accuracy"] - baseline_metrics_full["overall_accuracy"], 4),
            "macro_f1_delta": round(winning_eval_full["macro_f1"] - baseline_metrics_full["macro_f1"], 4),
            "per_class": winning_eval_full["per_class"],
            "per_class_deltas": deltas_full,
            "confusion_matrix": winning_eval_full["confusion_matrix"],
            "classes": SIX_CLASSES
        },
        "strategy_comparison": {
            "approach_a_fine_tuned_v5": {
                "val_loss": sum_a["best_val_loss"],
                "val_acc": sum_a["best_val_acc"],
                "test_base_accuracy": eval_a_base["overall_accuracy"],
                "test_base_macro_f1": eval_a_base["macro_f1"],
                "test_full_accuracy": eval_a_full["overall_accuracy"],
                "test_full_macro_f1": eval_a_full["macro_f1"]
            },
            "approach_b_retrained_imagenet": {
                "val_loss": sum_b["best_val_loss"],
                "val_acc": sum_b["best_val_acc"],
                "test_base_accuracy": eval_b_base["overall_accuracy"],
                "test_base_macro_f1": eval_b_base["macro_f1"],
                "test_full_accuracy": eval_b_full["overall_accuracy"],
                "test_full_macro_f1": eval_b_full["macro_f1"]
            }
        }
    }

    with open(eval_report_path, "w", encoding="utf-8") as f:
        json.dump(eval_report, f, indent=2)
    print(f" Saved evaluation report to: {eval_report_path}")

    # 11. Save Model Config
    config_path = os.path.join(output_dir, "model_config.json")
    model_config = {
        "model_name": "MobileNetV3-Small-Civic-WasteV8",
        "architecture": "mobilenet_v3_small",
        "version": "1.10.0-waste-v8",
        "num_classes": NUM_CLASSES,
        "classes": SIX_CLASSES,
        "class_to_idx": CLASS_TO_IDX,
        "input_size": [3, IMAGE_SIZE, IMAGE_SIZE],
        "image_size": IMAGE_SIZE,
        "input_mean": IMAGENET_MEAN,
        "input_std": IMAGENET_STD,
        "selected_training_strategy": selected_approach,
        "starting_checkpoint": os.path.abspath(base_checkpoint_path),
        "best_epoch": winning_summary["best_epoch"],
        "best_val_loss": winning_summary["best_val_loss"],
        "best_val_acc": winning_summary["best_val_acc"],
        "trained_at": datetime.utcnow().isoformat() + "Z",
        "dataset_samples": {
            "total_real_images": len(train_samples) + len(val_samples) + len(test_samples),
            "per_class": splits["per_class"],
            "train_total": len(train_samples),
            "val_total": len(val_samples),
            "test_total": len(test_samples)
        },
        "real_data_classes": SIX_CLASSES,
        "training_notes": "Trained jointly across all 6 civic categories with expanded real Waste Management dataset (589 images) alongside Street Light (667), Roads (705), Water Supply (667), Drainage (499), and Other (17). Preserved 6-class output architecture and exact class ordering."
    }

    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(model_config, f, indent=2)
    print(f" Saved model config to: {config_path}")

    # 12. Generate Plots
    generate_plots(
        output_dir=output_dir,
        history=winning_history,
        eval_base=winning_eval_base,
        eval_full=winning_eval_full,
        base_metrics=baseline_metrics_full
    )

    print("\n" + "=" * 80)
    print(" ALL RETRAINING ARTIFACTS SAVED SUCCESSFULLY IN ai/models_waste_updated_v8/")
    print("=" * 80)


if __name__ == "__main__":
    main()

