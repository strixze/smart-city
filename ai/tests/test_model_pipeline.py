"""
Automated Test Suite for Smart City AI Microservice & MobileNetV3 Pipeline
Covers:
1. Model checkpoint output classes & Street Light mapping.
2. Incompatible checkpoint detection & graceful disabling.
3. Street Light image classification via fine-tuned MobileNetV3.
4. Correct predictionSource reporting ('mobilenet', 'gemini_vision', 'rules').
5. Explicit fallback metadata on model/vision unavailability.
6. Verification that all pre-existing categories continue working.
"""

import os
import sys
import json
import torch
import unittest
from PIL import Image

# Ensure ai directory is on python path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.dirname(CURRENT_DIR)
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from schemas import CIVIC_TAXONOMY
from classifier import (
    MOBILENET_LOADER,
    classify_local,
    classify_complaint,
    verify_model_architecture
)

class TestAiModelPipeline(unittest.TestCase):

    def setUp(self):
        self.model_dir = os.path.join(AI_DIR, "models")
        self.checkpoint_path = os.path.join(self.model_dir, "best_model.pth")
        self.config_path = os.path.join(self.model_dir, "model_config.json")

    def test_checkpoint_classes_and_street_light_mapping(self):
        """Test 1 & 7: Checkpoint output dimensions and Street Light mapping."""
        self.assertTrue(os.path.exists(self.checkpoint_path), "best_model.pth must exist")
        self.assertTrue(os.path.exists(self.config_path), "model_config.json must exist")

        with open(self.config_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        classes = config.get("classes", [])
        self.assertEqual(len(classes), 6, "Model config must define exactly 6 classes")
        self.assertIn("Street Light", classes, "Street Light must be in model classes")
        self.assertEqual(classes[3], "Street Light", "Street Light must be at index 3")

        # Load weights and verify classifier layer shape
        state_dict = torch.load(self.checkpoint_path, map_location="cpu", weights_only=True)
        # MobileNetV3 small linear classifier is classifier[3]
        weight_key = "classifier.3.weight"
        self.assertIn(weight_key, state_dict, f"State dict must contain {weight_key}")
        weight_shape = state_dict[weight_key].shape
        self.assertEqual(weight_shape[0], 6, "Classifier output classes must equal 6")
        self.assertEqual(weight_shape[1], 1024, "Classifier input features must equal 1024")

    def test_incompatible_checkpoint_fails_safely(self):
        """Test 7: Incompatible checkpoint produces clear error / disabled status."""
        import torchvision.models as tv_models
        # Create an incompatible model with 99 classes
        dummy_model = tv_models.mobilenet_v3_small(weights=None)
        in_features = dummy_model.classifier[3].in_features
        dummy_model.classifier[3] = torch.nn.Linear(in_features, 99)

        # verify_model_architecture should fail expected 6 classes
        is_valid = verify_model_architecture(dummy_model, expected_classes=6)
        self.assertFalse(is_valid, "Architecture verification must reject 99-class model when expecting 6")

    def test_street_light_image_classification(self):
        """Test 3 & 4: Classification of a Street Light image reports 'mobilenet'."""
        sample_img_path = os.path.join(AI_DIR, "data", "Street Light", "street_light_001.jpg")
        self.assertTrue(os.path.exists(sample_img_path), f"Sample image {sample_img_path} must exist")

        result = classify_complaint(image_path=sample_img_path, request_id="test-req-001")
        self.assertIsNotNone(result, "classify_complaint must return a valid dict")
        self.assertEqual(result["predictedCategory"], "Street Light", "Sample must predict Street Light")
        self.assertEqual(result["predictionSource"], "mobilenet", "Prediction source must be 'mobilenet'")
        self.assertTrue(result["modelLoaded"], "modelLoaded must be True")
        self.assertFalse(result["fallbackUsed"], "fallbackUsed must be False on successful model inference")
        self.assertGreater(result["confidence"], 0.5, "Confidence must be reasonable for trained sample")
        self.assertEqual(result["requestId"], "test-req-001", "requestId must match")

    def test_rule_based_fallback_metadata(self):
        """Test 5 & 6: Explicit fallback metadata when model is unavailable or bypassed."""
        text = "The street light pole is broken and flickering in the dark"
        result = classify_local(
            description=text,
            fallback_reason="PyTorch model unavailable",
            request_id="test-fallback-002"
        )

        self.assertEqual(result["predictedCategory"], "Street Light")
        self.assertEqual(result["predictionSource"], "rules")
        self.assertTrue(result["fallbackUsed"])
        self.assertEqual(result["fallbackReason"], "PyTorch model unavailable")
        self.assertEqual(result["requestId"], "test-fallback-002")
        self.assertIn(result["predictedSubcategory"], [
            "Street Light Not Working",
            "Street Light Damaged",
            "Street Light Missing",
            "Street Light Flickering",
            "Street Light Pole Damaged",
            "Multiple Street Lights Not Working"
        ])

    def test_existing_categories_continue_working(self):
        """Test 8: Existing categories continue working without regression."""
        expected_categories = [
            "Waste Management",
            "Roads",
            "Drainage",
            "Water Supply",
            "Street Light",
            "Other"
        ]

        for cat in expected_categories:
            self.assertIn(cat, CIVIC_TAXONOMY, f"{cat} must exist in CIVIC_TAXONOMY")
            self.assertGreater(len(CIVIC_TAXONOMY[cat]["subcategories"]), 0, f"{cat} must have subcategories")

        # Test rule-based categorization for other categories
        drainage_result = classify_local(description="Severe sewage overflow and blocked drainage pipe", request_id="test-drainage")
        self.assertEqual(drainage_result["predictedCategory"], "Drainage")

        roads_result = classify_local(description="Dangerous pothole on the main road", request_id="test-roads")
        self.assertEqual(roads_result["predictedCategory"], "Roads")

        waste_result = classify_local(description="Garbage dump overflowing with trash", request_id="test-waste")
        self.assertEqual(waste_result["predictedCategory"], "Waste Management")

        water_result = classify_local(description="Drinking water supply pipeline burst and leakage leaving residents with no water", request_id="test-water")
        self.assertEqual(water_result["predictedCategory"], "Water Supply")

if __name__ == "__main__":
    unittest.main()
