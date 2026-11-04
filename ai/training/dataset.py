"""
Dataset loader, transformations, and stratified splitting for SmartCity civic images.
Implements official MobileNetV3 transforms, robust image validation, and error guards.
"""

import os
from typing import List, Tuple, Dict, Optional, Callable
from PIL import Image, UnidentifiedImageError
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from torchvision.transforms import InterpolationMode
from sklearn.model_selection import train_test_split

# Official ImageNet normalization parameters used by MobileNetV3
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]
IMAGE_SIZE = 224
RESIZE_SIZE = 256

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def get_training_transforms(image_size: int = IMAGE_SIZE) -> transforms.Compose:
    """
    Data augmentation transforms for training:
    - Random resized crop to preserve scale invariance
    - Random horizontal flip
    - Color jitter and subtle rotation for civic lighting/angle variability
    - ImageNet normalization
    """
    return transforms.Compose([
        transforms.Resize((RESIZE_SIZE, RESIZE_SIZE), interpolation=InterpolationMode.BILINEAR),
        transforms.RandomResizedCrop(image_size, scale=(0.75, 1.0), interpolation=InterpolationMode.BILINEAR),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_inference_transforms(image_size: int = IMAGE_SIZE) -> transforms.Compose:
    """
    Standard deterministic evaluation & inference transforms:
    - Resize to 256x256
    - Center crop to 224x224
    - Convert to Tensor
    - ImageNet normalization
    """
    return transforms.Compose([
        transforms.Resize((RESIZE_SIZE, RESIZE_SIZE), interpolation=InterpolationMode.BILINEAR),
        transforms.CenterCrop(image_size),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ])


def get_accessible_path(path: str) -> str:
    """Returns path with \\\\?\\ prefix on Windows to support paths longer than 260 chars."""
    if not path:
        return path
    abs_path = os.path.abspath(path)
    if os.name == "nt" and not abs_path.startswith("\\\\?\\"):
        return "\\\\?\\" + abs_path
    return abs_path


def load_and_validate_image(image_path: str) -> Optional[Image.Image]:
    """
    Safely opens and validates an image file.
    - Validates file existence and non-zero size
    - Handles Windows long paths gracefully
    - Converts RGBA, CMYK, Palette, and Grayscale to 3-channel RGB
    - Catches corrupt, truncated, or unidentifiable image files
    """
    if not image_path:
        return None

    acc_path = get_accessible_path(image_path)
    if not os.path.exists(acc_path):
        return None

    try:
        if os.path.getsize(acc_path) == 0:
            return None

        with Image.open(acc_path) as img:
            # Force decode pixels to verify integrity
            img.verify()

        # Reopen after verify() closes/invalidates the handle
        with Image.open(acc_path) as img:
            return img.convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as err:
        print(f"[Dataset Warning] Skipping corrupt image: {image_path} ({err})")
        return None


class CivicComplaintDataset(Dataset):
    """
    PyTorch Dataset for civic complaints, supporting in-memory sample tuples (path, label).
    """

    def __init__(
        self,
        samples: List[Tuple[str, int]],
        transform: Optional[Callable] = None
    ):
        """
        Args:
            samples: List of (image_path, class_idx)
            transform: Torchvision transform pipeline
        """
        self.samples = samples
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        img_path, label = self.samples[idx]
        img = load_and_validate_image(img_path)

        if img is None:
            # Fallback to an empty blank tensor if corrupted during runtime
            img = Image.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color=(128, 128, 128))

        if self.transform:
            tensor = self.transform(img)
        else:
            tensor = transforms.ToTensor()(img)

        return tensor, label


def discover_dataset(
    data_dir: str,
    target_classes: Optional[List[str]] = None
) -> Tuple[List[Tuple[str, int]], List[str], Dict[str, int]]:
    """
    Scans a directory organized by class subfolders:
      data_dir/
        class_1/
          img1.jpg
        class_2/
          img2.jpg
          
    Returns:
        samples: List of (image_path, class_idx)
        class_names: List of class names sorted or matched
        class_to_idx: Dict mapping class_name -> int index
    """
    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"Data directory '{data_dir}' does not exist.")

    # Determine classes from directory or target list
    subdirs = [
        d for d in os.listdir(data_dir)
        if os.path.isdir(os.path.join(data_dir, d)) and not d.startswith(".")
    ]

    if target_classes:
        class_names = [c for c in target_classes if c in subdirs]
        # Include any remaining subdirs
        for d in subdirs:
            if d not in class_names:
                class_names.append(d)
    else:
        class_names = sorted(subdirs)

    class_to_idx = {name: idx for idx, name in enumerate(class_names)}
    samples: List[Tuple[str, int]] = []

    for name in class_names:
        class_dir = os.path.join(data_dir, name)
        if not os.path.isdir(class_dir):
            continue
        c_idx = class_to_idx[name]
        for fname in os.listdir(class_dir):
            ext = os.path.splitext(fname)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                fpath = os.path.join(class_dir, fname)
                samples.append((fpath, c_idx))

    return samples, class_names, class_to_idx


def split_dataset_stratified(
    samples: List[Tuple[str, int]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42
) -> Tuple[List[Tuple[str, int]], List[Tuple[str, int]], List[Tuple[str, int]]]:
    """
    Splits samples into Train, Validation, and Test partitions using stratified sampling.
    Guarantees that test data is strictly isolated.
    """
    assert abs(train_ratio + val_ratio + test_ratio - 1.0) < 1e-5, "Ratios must sum to 1.0"
    if not samples:
        return [], [], []

    paths = [s[0] for s in samples]
    labels = [s[1] for s in samples]

    # Check minimum class counts for stratified splitting
    from collections import Counter
    counts = Counter(labels)
    min_count = min(counts.values()) if counts else 0

    if min_count < 2:
        # Fall back to random non-stratified split if extreme imbalance or single example
        import random
        rng = random.Random(seed)
        shuffled = list(samples)
        rng.shuffle(shuffled)
        n = len(shuffled)
        n_train = int(n * train_ratio)
        n_val = int(n * val_ratio)
        return shuffled[:n_train], shuffled[n_train:n_train + n_val], shuffled[n_train + n_val:]

    # First split off the test set
    val_test_ratio = val_ratio + test_ratio
    train_paths, test_val_paths, train_labels, test_val_labels = train_test_split(
        paths, labels, test_size=val_test_ratio, stratify=labels, random_state=seed
    )

    # Then split test_val into validation and test sets
    test_portion_of_remainder = test_ratio / val_test_ratio
    val_counts = Counter(test_val_labels)
    can_stratify_val = min(val_counts.values()) >= 2

    if can_stratify_val:
        val_paths, test_paths, val_labels, test_labels = train_test_split(
            test_val_paths, test_val_labels,
            test_size=test_portion_of_remainder,
            stratify=test_val_labels,
            random_state=seed
        )
    else:
        val_paths, test_paths, val_labels, test_labels = train_test_split(
            test_val_paths, test_val_labels,
            test_size=test_portion_of_remainder,
            random_state=seed
        )

    train_samples = list(zip(train_paths, train_labels))
    val_samples = list(zip(val_paths, val_labels))
    test_samples = list(zip(test_paths, test_labels))

    return train_samples, val_samples, test_samples


def create_dataloaders(
    train_samples: List[Tuple[str, int]],
    val_samples: List[Tuple[str, int]],
    test_samples: List[Tuple[str, int]],
    batch_size: int = 16,
    num_workers: int = 0
) -> Tuple[DataLoader, DataLoader, DataLoader]:
    """
    Creates PyTorch DataLoaders for train, val, and test partitions.
    Uses num_workers=0 by default for reliable execution on Windows CPU and Colab.
    """
    train_dataset = CivicComplaintDataset(train_samples, transform=get_training_transforms())
    val_dataset = CivicComplaintDataset(val_samples, transform=get_inference_transforms())
    test_dataset = CivicComplaintDataset(test_samples, transform=get_inference_transforms())

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available()
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available()
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available()
    )

    return train_loader, val_loader, test_loader
