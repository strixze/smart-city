"""
Dataset Audit Script for Smart City 6-Category MobileNetV3.
Inspects all 6 category folders in ai/data:
- Drainage
- Other
- Roads
- Street Light
- Waste Management
- Water Supply
"""

import os
import sys
import hashlib
import json
from collections import Counter, defaultdict
from PIL import Image

SIX_CLASSES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}

def get_accessible_path(path: str) -> str:
    abs_path = os.path.abspath(path)
    if os.name == 'nt' and not abs_path.startswith('\\\\?\\'):
        return '\\\\?\\' + abs_path
    return abs_path

def compute_md5(filepath: str) -> str:
    hasher = hashlib.md5()
    acc_path = get_accessible_path(filepath)
    with open(acc_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def audit(data_dir: str = "ai/data", v4_manifest_path: str = "ai/models_water_supply_v4/test_manifest.json"):
    results = {}
    print(f"=== AUDITING DATASET IN: {data_dir} ===")

    # Load baseline manifest if available to identify original images
    original_drainage_files = set()
    if os.path.exists(v4_manifest_path):
        with open(v4_manifest_path, "r", encoding="utf-8") as f:
            v4_manifest = json.load(f)
            # Check if all original drainage files can be found or if we check v4 model config
            print(f"Loaded v4 test manifest with target classes: {v4_manifest.get('target_classes')}")

    # Also let's check train_water_supply_v4.py or train_drainage_v3.py for original drainage files
    # In models_water_supply_v4/model_config.json: drainage total was 202.

    all_hashes = defaultdict(list)
    category_summary = {}

    for cat in SIX_CLASSES:
        cat_dir = os.path.join(data_dir, cat)
        if not os.path.exists(cat_dir):
            print(f"WARNING: Directory not found: {cat_dir}")
            continue

        cat_files = []
        for root, dirs, filenames in os.walk(cat_dir):
            for fn in filenames:
                full_p = os.path.join(root, fn)
                rel_p = os.path.relpath(full_p, data_dir)
                cat_files.append((full_p, rel_p, fn))

        extensions = Counter()
        corrupted = []
        modes = Counter()
        dimensions = []
        valid_images = []

        for full_p, rel_p, fn in cat_files:
            ext = os.path.splitext(fn)[1].lower()
            extensions[ext] += 1

            if ext not in SUPPORTED_EXTENSIONS:
                corrupted.append((rel_p, f"Unsupported extension: {ext}"))
                continue

            acc_p = get_accessible_path(full_p)
            try:
                with Image.open(acc_p) as img:
                    img.verify()  # verify integrity
                # Reopen to get mode and size (verify closes or invalidates file)
                with Image.open(acc_p) as img:
                    modes[img.mode] += 1
                    dimensions.append(img.size)
                    file_hash = compute_md5(acc_p)
                    all_hashes[file_hash].append((cat, rel_p))
                    valid_images.append((full_p, rel_p, fn, file_hash, img.size, img.mode))
            except Exception as e:
                corrupted.append((rel_p, f"Corrupted/unreadable: {str(e)}"))

        category_summary[cat] = {
            "total_files": len(cat_files),
            "valid_images": len(valid_images),
            "extensions": dict(extensions),
            "modes": dict(modes),
            "corrupted": corrupted,
            "min_dim": min(dimensions, key=lambda d: d[0]*d[1]) if dimensions else None,
            "max_dim": max(dimensions, key=lambda d: d[0]*d[1]) if dimensions else None,
            "valid_list": valid_images
        }

    # Duplicate analysis
    exact_duplicates = {}
    for h, file_list in all_hashes.items():
        if len(file_list) > 1:
            exact_duplicates[h] = file_list

    # Separate intra-category vs inter-category duplicates
    intra_cat_duplicates = defaultdict(list)
    inter_cat_duplicates = []
    for h, file_list in exact_duplicates.items():
        cats = set(item[0] for item in file_list)
        if len(cats) > 1:
            inter_cat_duplicates.append(file_list)
        else:
            cat = file_list[0][0]
            intra_cat_duplicates[cat].append([item[1] for item in file_list])

    # Report
    print("\n--- CATEGORY IMAGE COUNTS & FORMATS ---")
    total_valid = 0
    for cat, info in category_summary.items():
        total_valid += info["valid_images"]
        print(f"Category: {cat:20s} | Total files: {info['total_files']:4d} | Valid images: {info['valid_images']:4d} | Extensions: {info['extensions']} | Modes: {info['modes']}")
        if info["corrupted"]:
            print(f"  [!] Corrupted/Unreadable in {cat}:")
            for c in info["corrupted"]:
                print(f"      - {c[0]}: {c[1]}")

    print(f"\nTotal Valid Images across all categories: {total_valid}")

    # Drainage specifically
    drainage_info = category_summary["Drainage"]
    print("\n--- DRAINAGE DEEP DIVE ---")
    print(f"Total Drainage files: {drainage_info['total_files']}")
    print(f"Valid Drainage images: {drainage_info['valid_images']}")

    # Let's inspect Drainage filenames
    drainage_filenames = [item[2] for item in drainage_info["valid_list"]]
    print(f"Sample Drainage filenames: {drainage_filenames[:5]} ... {drainage_filenames[-5:]}")

    # Check duplicates
    print("\n--- DUPLICATE ANALYSIS ---")
    print(f"Total duplicate hash sets: {len(exact_duplicates)}")
    if inter_cat_duplicates:
        print(f"WARNING: Inter-category duplicates ({len(inter_cat_duplicates)}):")
        for dup in inter_cat_duplicates:
            print(f"  - {dup}")
    else:
        print("No inter-category duplicates found.")

    for cat in SIX_CLASSES:
        dups = intra_cat_duplicates.get(cat, [])
        print(f"Intra-category duplicates in '{cat}': {len(dups)}")
        if dups:
            for d in dups[:5]:
                print(f"    Set: {d}")
            if len(dups) > 5:
                print(f"    ... and {len(dups) - 5} more sets")

    # Class imbalance analysis
    print("\n--- CLASS IMBALANCE ANALYSIS ---")
    counts = {cat: category_summary[cat]["valid_images"] for cat in SIX_CLASSES}
    total = sum(counts.values())
    for cat, c in counts.items():
        pct = (c / total * 100) if total > 0 else 0
        print(f"{cat:20s}: {c:4d} ({pct:5.2f}%)")

    return category_summary, exact_duplicates, inter_cat_duplicates, intra_cat_duplicates

if __name__ == "__main__":
    audit()
