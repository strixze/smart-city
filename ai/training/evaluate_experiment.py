"""
Honest Evaluation and Comparative Analysis:
Evaluates Experimental Model vs Baseline Production Model on Held-out Real Waste Management Test Images.
Computes Accuracy, Recall, Mean Confidence, Prediction Distribution, and saves evaluation_comparison.json.
"""

import os
import sys
import json
from typing import Dict, List, Tuple
from datetime import datetime

import numpy as np
import torch
import torch.nn as nn
from PIL import Image

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from model import build_mobilenet_v3_small
from dataset import (
    load_and_validate_image,
    get_inference_transforms,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD
)

SIX_CLASSES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]
WASTE_CLASS_IDX = 4


def evaluate_checkpoint_on_manifest(
    checkpoint_path: str,
    manifest_path: str,
    device: torch.device
) -> Dict:
    """Evaluates a 6-class checkpoint on test samples in manifest."""
    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    test_paths = manifest.get("test_samples", [])
    if not test_paths:
        raise ValueError(f"No test samples found in {manifest_path}")

    # Build model
    model = build_mobilenet_v3_small(num_classes=6, pretrained=False)
    state_dict = torch.load(checkpoint_path, map_location=device, weights_only=True)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    transform = get_inference_transforms()
    softmax = nn.Softmax(dim=1)

    predictions = []
    confidences = []
    top_preds_list = []
    pred_counts = {c: 0 for c in SIX_CLASSES}
    correct_count = 0

    with torch.no_grad():
        for path in test_paths:
            img = load_and_validate_image(path)
            if img is None:
                img = Image.new("RGB", (IMAGE_SIZE, IMAGE_SIZE), color=(128, 128, 128))
            tensor = transform(img).unsqueeze(0).to(device)
            logits = model(tensor)
            probs = softmax(logits)[0]
            top_prob, top_idx = torch.max(probs, dim=0)

            pred_class = SIX_CLASSES[top_idx.item()]
            pred_conf = float(top_prob.item())

            predictions.append(pred_class)
            confidences.append(pred_conf)
            pred_counts[pred_class] += 1

            if top_idx.item() == WASTE_CLASS_IDX:
                correct_count += 1

            # Top 3
            k_probs, k_indices = torch.topk(probs, k=3)
            top_preds_list.append([
                {"class": SIX_CLASSES[idx.item()], "prob": round(float(p.item()), 4)}
                for p, idx in zip(k_probs, k_indices)
            ])

    n_total = len(test_paths)
    accuracy_recall = correct_count / n_total if n_total > 0 else 0.0
    mean_conf = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "total_test_samples": n_total,
        "correct_predictions": correct_count,
        "accuracy_recall": round(accuracy_recall, 4),
        "mean_confidence": round(mean_conf, 4),
        "prediction_distribution": pred_counts,
        "predictions": predictions,
        "confidences": [round(c, 4) for c in confidences]
    }


def run_comparative_evaluation(
    exp_dir: str,
    baseline_dir: str
) -> Dict:
    manifest_path = os.path.join(exp_dir, "test_manifest.json")
    exp_checkpoint = os.path.join(exp_dir, "best_model.pth")
    baseline_checkpoint = os.path.join(baseline_dir, "best_model.pth")

    device = torch.device("cpu")

    print("\n" + "=" * 70)
    print(" Running Honest Evaluation on Held-Out Real Waste Management Test Images")
    print("=" * 70)
    print(f" Test Manifest: {manifest_path}")

    # 1. Evaluate baseline production model
    print(f"\n[1/2] Evaluating Baseline Production Model ({baseline_checkpoint})...")
    baseline_res = evaluate_checkpoint_on_manifest(baseline_checkpoint, manifest_path, device)
    print(f"  Baseline Accuracy / Recall: {baseline_res['accuracy_recall']*100:.2f}% "
          f"({baseline_res['correct_predictions']}/{baseline_res['total_test_samples']})")
    print(f"  Baseline Mean Confidence: {baseline_res['mean_confidence']:.4f}")
    print(f"  Baseline Distribution: {baseline_res['prediction_distribution']}")

    # 2. Evaluate experimental model
    print(f"\n[2/2] Evaluating Experimental Model ({exp_checkpoint})...")
    exp_res = evaluate_checkpoint_on_manifest(exp_checkpoint, manifest_path, device)
    print(f"  Experimental Accuracy / Recall: {exp_res['accuracy_recall']*100:.2f}% "
          f"({exp_res['correct_predictions']}/{exp_res['total_test_samples']})")
    print(f"  Experimental Mean Confidence: {exp_res['mean_confidence']:.4f}")
    print(f"  Experimental Distribution: {exp_res['prediction_distribution']}")

    # Formulate comparison
    delta_acc = exp_res['accuracy_recall'] - baseline_res['accuracy_recall']
    delta_conf = exp_res['mean_confidence'] - baseline_res['mean_confidence']

    comparison = {
        "evaluation_timestamp": datetime.utcnow().isoformat() + "Z",
        "held_out_test_set_size": exp_res['total_test_samples'],
        "target_class": "Waste Management",
        "baseline_model": {
            "checkpoint": baseline_checkpoint,
            "correct_waste_predictions": baseline_res['correct_predictions'],
            "accuracy_recall_on_real_waste": baseline_res['accuracy_recall'],
            "mean_confidence": baseline_res['mean_confidence'],
            "predictions_breakdown": baseline_res['prediction_distribution']
        },
        "experimental_model": {
            "checkpoint": exp_checkpoint,
            "correct_waste_predictions": exp_res['correct_predictions'],
            "accuracy_recall_on_real_waste": exp_res['accuracy_recall'],
            "mean_confidence": exp_res['mean_confidence'],
            "predictions_breakdown": exp_res['prediction_distribution']
        },
        "comparison_summary": {
            "recall_improvement": round(delta_acc, 4),
            "recall_improvement_pct": f"{delta_acc * 100:+.2f}%",
            "confidence_delta": round(delta_conf, 4)
        },
        "methodological_limitations": (
            "Because real labeled images are currently available only for Waste Management, "
            "this evaluation strictly measures Waste Management recall and classification sensitivity "
            "on held-out real data. It cannot validate full 6-class precision, false positive rates, "
            "or macro-F1 across Drainage, Other, Roads, Street Light, and Water Supply until real labeled "
            "datasets for those 5 categories are added."
        )
    }

    report_path = os.path.join(exp_dir, "evaluation_comparison.json")
    with open(report_path, "w") as f:
        json.dump(comparison, f, indent=2)

    print("\n" + "=" * 70)
    print(" Comparative Evaluation Complete!")
    print(f" Recall Delta on Real Images: {comparison['comparison_summary']['recall_improvement_pct']}")
    print(f" Full Report Saved: {report_path}")
    print("=" * 70)

    return comparison


if __name__ == "__main__":
    ai_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    exp_dir = os.path.join(ai_dir, "models_real_data_experiment")
    baseline_dir = os.path.join(ai_dir, "models")
    run_comparative_evaluation(exp_dir, baseline_dir)
