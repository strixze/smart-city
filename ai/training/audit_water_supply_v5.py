"""
Dataset Audit Script for Smart City 6-Category MobileNetV3 Retraining (v5).
Focuses on Water Supply dataset update (+500 images) alongside all 6 categories.
"""

import os
import sys
import hashlib
import json
from collections import Counter, defaultdict
from PIL import Image

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dataset import get_accessible_path, SUPPORTED_EXTENSIONS

data_dir = "ai/data"
categories = ["Drainage", "Other", "Roads", "Street Light", "Waste Management", "Water Supply"]

def compute_md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def run_audit():
    all_hashes = defaultdict(list)
    cat_stats = {}

    for cat in categories:
        cdir = os.path.join(data_dir, cat)
        files = []
        for r, d, fns in os.walk(cdir):
            for fn in fns:
                files.append(os.path.join(r, fn))
        
        valid = []
        corrupted = []
        exts = Counter()
        modes = Counter()
        
        for fp in files:
            fn = os.path.basename(fp)
            ext = os.path.splitext(fn)[1].lower()
            exts[ext] += 1
            
            acc_p = get_accessible_path(fp)
            try:
                with Image.open(acc_p) as img:
                    img.verify()
                with Image.open(acc_p) as img:
                    modes[img.mode] += 1
                    md5 = compute_md5(acc_p)
                    all_hashes[md5].append((cat, fn, fp))
                    valid.append((fn, fp, md5, img.size, img.mode))
            except Exception as e:
                corrupted.append((fn, str(e)))
                
        cat_stats[cat] = {
            "total_files": len(files),
            "valid": len(valid),
            "corrupted": corrupted,
            "extensions": dict(exts),
            "modes": dict(modes),
            "valid_list": valid
        }

    print("=== DATASET AUDIT SUMMARY ===")
    total_valid = 0
    for cat in categories:
        s = cat_stats[cat]
        total_valid += s["valid"]
        print(f"{cat:18s} | Total: {s['total_files']:4d} | Valid: {s['valid']:4d} | Corrupted: {len(s['corrupted']):2d} | Exts: {s['extensions']} | Modes: {s['modes']}")
        if s["corrupted"]:
            print("  Corrupted files:", s["corrupted"][:5])

    print(f"\nTotal Valid Images Across All 6 Categories: {total_valid}")

    # Duplicate analysis
    exact_dups = {h: flist for h, flist in all_hashes.items() if len(flist) > 1}
    print(f"\nTotal duplicate hash sets across entire dataset: {len(exact_dups)}")
    inter_cat = []
    intra_cat = defaultdict(list)
    for h, flist in exact_dups.items():
        cats = set(item[0] for item in flist)
        if len(cats) > 1:
            inter_cat.append(flist)
        else:
            intra_cat[flist[0][0]].append([item[1] for item in flist])

    print(f"Inter-category duplicate sets: {len(inter_cat)}")
    for ic in inter_cat:
        print("  Inter-cat collision:", ic)

    for cat in categories:
        print(f"Intra-category duplicates in '{cat}': {len(intra_cat[cat])}")
        if intra_cat[cat]:
            for d in intra_cat[cat][:5]:
                print(f"  {cat} dup set: {d}")

    # Inspect Water Supply specifically
    print("\n=== WATER SUPPLY DEEP DIVE ===")
    ws_valid = cat_stats["Water Supply"]["valid_list"]
    print(f"Total valid Water Supply images: {len(ws_valid)}")

    # Check baseline manifest to see how many were original v4 images
    v4_manifest_path = "ai/models_water_supply_v4/test_manifest.json"
    orig_ws_files = set()
    if os.path.exists(v4_manifest_path):
        with open(v4_manifest_path, "r", encoding="utf-8") as f:
            v4_manifest = json.load(f)
        orig_ws_test = [os.path.basename(p) for p in v4_manifest.get("watersupply_test_samples", [])]
        print(f"Preserved baseline Water Supply test images from v4: {len(orig_ws_test)}")
        missing_test = [f for f in orig_ws_test if f not in set(item[0] for item in ws_valid)]
        print(f"Missing baseline test images in current folder: {len(missing_test)}")

    # Identify new Water Supply images
    # Previously in v4, there were 150 Water Supply images (all .webp).
    # Let's inspect the extensions and filenames of the new images.
    ws_files = [item[0] for item in ws_valid]
    ws_webps = [f for f in ws_files if f.endswith(".webp")]
    ws_jpgs = [f for f in ws_files if f.endswith(".jpg") or f.endswith(".jpeg")]
    ws_pngs = [f for f in ws_files if f.endswith(".png")]
    print(f"Water Supply formats: .webp={len(ws_webps)}, .jpg/.jpeg={len(ws_jpgs)}, .png={len(ws_pngs)}")
    print(f"Sample new Water Supply images (first 10 non-webp or new):")
    non_webp_ws = [f for f in ws_files if not f.endswith(".webp")]
    for f in non_webp_ws[:10]:
        print(f"  - {f}")

    # Check naming patterns / burst sequences in Water Supply
    ws_prefixes = Counter()
    for f in ws_files:
        if "_jpg.rf." in f:
            base = f.split("_jpg.rf.")[0]
            ws_prefixes[f"rf_{base}"] += 1
        elif f.startswith("360_F_"):
            parts = f.split("_")
            ws_prefixes[f"adobe_{parts[2]}" if len(parts) > 2 else "adobe_360"] += 1
        elif f.startswith("photo-"):
            ws_prefixes[f[:15]] += 1
        elif "-" in f:
            ws_prefixes[f.split("-")[0]] += 1
        else:
            ws_prefixes[f[:8]] += 1

    repeated_ws_prefixes = {k: v for k, v in ws_prefixes.items() if v > 1}
    print(f"\nUnique Water Supply group prefixes: {len(ws_prefixes)}, prefixes with multiple instances: {len(repeated_ws_prefixes)}")
    for k, v in list(repeated_ws_prefixes.items())[:10]:
        print(f"  {k}: {v} instances")

    # Class Imbalance Analysis
    print("\n=== CLASS DISTRIBUTION ACROSS ALL 6 CATEGORIES ===")
    total = sum(cat_stats[c]["valid"] for c in categories)
    for c in categories:
        count = cat_stats[c]["valid"]
        pct = (count / total * 100) if total > 0 else 0
        print(f"  {c:18s}: {count:4d} ({pct:5.2f}%)")

if __name__ == "__main__":
    run_audit()

