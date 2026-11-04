"""
Dataset audit script for Street Light v7 retraining.
Inspects all 6 civic categories:
- Drainage
- Other
- Roads
- Street Light
- Waste Management
- Water Supply
Reports counts, formats, readability, duplicates, and grouping prefixes.
"""

import os
import sys
import hashlib
from collections import defaultdict

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.dirname(CURRENT_DIR)
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from utils import get_accessible_path, safe_load_image

DATA_DIR = os.path.join(AI_DIR, "data")
CATEGORIES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def compute_file_hash(filepath: str) -> str:
    acc_path = get_accessible_path(filepath)
    hasher = hashlib.md5()
    with open(acc_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def audit():
    print("=" * 80)
    print(" AUDITING CIVIC DATASET FOR STREET LIGHT v7 RETRAINING")
    print("=" * 80)

    category_stats = {}
    all_hashes = defaultdict(list)
    corrupted_images = []
    format_counts = defaultdict(lambda: defaultdict(int))
    group_prefixes = defaultdict(lambda: defaultdict(list))

    total_images_all = 0

    for cat in CATEGORIES:
        cat_dir = os.path.join(DATA_DIR, cat)
        if not os.path.isdir(cat_dir):
            print(f"Directory not found: {cat_dir}")
            continue

        files = []
        for root, _, filenames in os.walk(cat_dir):
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext in VALID_EXTENSIONS:
                    files.append(os.path.join(root, fname))

        cat_total = len(files)
        total_images_all += cat_total
        readable_count = 0

        for fpath in files:
            ext = os.path.splitext(fpath)[1].lower()
            format_counts[cat][ext] += 1

            # Test readability
            img, err, dims, fmt = safe_load_image(fpath)
            if err or img is None:
                corrupted_images.append((fpath, err))
            else:
                readable_count += 1
                # Hash check
                fhash = compute_file_hash(fpath)
                all_hashes[fhash].append((cat, fpath))

                # Group detection
                bname = os.path.basename(fpath)
                if "_jpg.rf." in bname:
                    p = bname.split("_jpg.rf.")[0]
                    group_prefixes[cat][p].append(fpath)
                elif "_png.rf." in bname:
                    p = bname.split("_png.rf.")[0]
                    group_prefixes[cat][p].append(fpath)
                elif "_" in bname:
                    p = bname.split("_")[0]
                    if len(p) >= 3 and p.lower() not in {"other", "image", "images", "img", "photo", "360", "frame", "video", "drainage", "roads", "waste", "water", "street"}:
                        group_prefixes[cat][p].append(fpath)

        category_stats[cat] = {
            "total_files": cat_total,
            "readable_files": readable_count,
            "formats": dict(format_counts[cat])
        }

    print("\n--- CATEGORY IMAGE COUNTS & FORMATS ---")
    for cat in CATEGORIES:
        stats = category_stats.get(cat, {})
        fmt_str = ", ".join([f"{k}: {v}" for k, v in stats.get("formats", {}).items()])
        print(f"  {cat:18s} : {stats.get('total_files', 0):4d} valid images | Formats: [{fmt_str}]")
    print(f"  {'TOTAL':18s} : {total_images_all:4d} valid images across 6 classes")

    # Cross-category duplicates
    cross_duplicates = []
    intra_duplicates = []
    for fhash, occurrences in all_hashes.items():
        if len(occurrences) > 1:
            cats = set(c for c, _ in occurrences)
            if len(cats) > 1:
                cross_duplicates.append(occurrences)
            else:
                intra_duplicates.append(occurrences)

    print("\n--- DUPLICATE & INTEGRITY ANALYSIS ---")
    print(f"  Corrupted / Unreadable Images: {len(corrupted_images)}")
    if corrupted_images:
        for p, err in corrupted_images[:5]:
            print(f"    - {p}: {err}")
    print(f"  Cross-Category Exact Duplicates: {len(cross_duplicates)}")
    if cross_duplicates:
        for dups in cross_duplicates[:3]:
            print(f"    - Conflict: {[d[1] for d in dups]}")
    print(f"  Intra-Category Exact Duplicates: {len(intra_duplicates)}")

    print("\n--- MULTI-INSTANCE / VIDEO PREFIX GROUPS ---")
    for cat in CATEGORIES:
        multi_groups = {k: v for k, v in group_prefixes[cat].items() if len(v) > 1}
        print(f"  {cat:18s} : {len(multi_groups)} multi-image prefix groups detected")

    print("\n" + "=" * 80)
    print(" AUDIT COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    audit()

