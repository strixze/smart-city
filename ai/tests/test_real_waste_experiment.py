"""
Unit & Integration Test Suite for Real Waste Management MobileNetV3 Experiment
Validates:
1. Checkpoint loading from ai/models_real_data_experiment/ via MobileNetV3ModelLoader.
2. Exact 6-class index order preservation:
   [Drainage, Other, Roads, Street Light, Waste Management, Water Supply]
3. Model output tensor shape (1, 6) and verify_model_architecture compatibility.
4. Prediction accuracy and confidence on held-out real Waste Management images.
5. Production model integrity and non-interference verification (SHA256 check).
"""

import os
import sys
import json
import hashlib
import unittest
import torch

# Ensure ai directory is on python path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.dirname(CURRENT_DIR)
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from classifier import MobileNetV3ModelLoader, verify_model_architecture

EXPECTED_6_CLASSES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]

EXPECTED_PRODUCTION_SHA256 = "fd08cc370382b69b0345e6a6678f7a758bb9703aba9d68d07e3384b15a16c1fd"


class TestRealWasteExperiment(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.exp_dir = os.path.join(AI_DIR, "models_real_data_experiment")
        cls.exp_weights = os.path.join(cls.exp_dir, "best_model.pth")
        cls.exp_config = os.path.join(cls.exp_dir, "model_config.json")
        cls.test_manifest = os.path.join(cls.exp_dir, "test_manifest.json")

        cls.prod_dir = os.path.join(AI_DIR, "models")
        cls.prod_weights = os.path.join(cls.prod_dir, "best_model.pth")
        cls.prod_backup = os.path.join(cls.prod_dir, "best_model_production_backup.pth")

    def test_01_experimental_artifacts_exist(self):
        """Verify all experimental artifacts and manifest files exist."""
        self.assertTrue(os.path.isdir(self.exp_dir), "Experimental directory must exist")
        self.assertTrue(os.path.exists(self.exp_weights), "Experimental best_model.pth must exist")
        self.assertTrue(os.path.exists(self.exp_config), "Experimental model_config.json must exist")
        self.assertTrue(os.path.exists(self.test_manifest), "test_manifest.json must exist")

    def test_02_class_index_order_preservation(self):
        """Verify that the 6-class order is identical to the production contract."""
        with open(self.exp_config, "r", encoding="utf-8") as f:
            config = json.load(f)

        classes = config.get("classes", [])
        self.assertEqual(len(classes), 6, "Experiment must maintain exactly 6 classes")
        self.assertEqual(classes, EXPECTED_6_CLASSES, "Class list and order must match 6-class contract")
        self.assertEqual(classes[4], "Waste Management", "Waste Management must remain at index 4")

    def test_03_experimental_checkpoint_loading_and_architecture(self):
        """Verify that MobileNetV3ModelLoader loads the experimental model and verifies architecture."""
        loader = MobileNetV3ModelLoader(models_dir=self.exp_dir)
        self.assertTrue(loader.is_loaded, f"Experimental model failed to load: {loader.load_error}")
        self.assertIsNone(loader.load_error)
        self.assertEqual(loader.num_classes, 6)
        self.assertEqual(loader.classes, EXPECTED_6_CLASSES)

        # Verify forward pass tensor dimensions (1, 6)
        is_valid = verify_model_architecture(loader.model, expected_classes=6, image_size=224)
        self.assertTrue(is_valid, "Architecture verification must pass for (1, 6) output tensor")

        # Verify weight layer shapes
        state_dict = torch.load(self.exp_weights, map_location="cpu", weights_only=True)
        self.assertIn("classifier.3.weight", state_dict)
        self.assertEqual(state_dict["classifier.3.weight"].shape, torch.Size([6, 1024]))
        self.assertEqual(state_dict["classifier.3.bias"].shape, torch.Size([6]))

    def test_04_inference_on_held_out_real_images(self):
        """Verify high accuracy and confidence on held-out real Waste Management test images."""
        loader = MobileNetV3ModelLoader(models_dir=self.exp_dir)
        self.assertTrue(loader.is_loaded)

        with open(self.test_manifest, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        test_files = manifest.get("test_samples", [])
        self.assertEqual(len(test_files), 29, "Must have exactly 29 held-out test images")

        correct = 0
        confidences = []

        # Test first 10 held-out images for fast test execution
        subset_to_test = test_files[:10]
        for img_path in subset_to_test:
            self.assertTrue(os.path.exists(img_path), f"Test image missing: {img_path}")
            category, conf, top_preds, latency = loader.predict(img_path)
            if category == "Waste Management":
                correct += 1
            confidences.append(conf)
            self.assertEqual(len(top_preds), 3, "top_k=3 must return 3 predictions")
            self.assertGreater(latency, 0.0, "Latency must be positive")

        self.assertEqual(correct, len(subset_to_test), "All tested held-out real images must classify as Waste Management")
        avg_conf = sum(confidences) / len(confidences)
        self.assertGreater(avg_conf, 0.95, f"Expected >95% mean confidence, got {avg_conf:.4f}")

    def test_05_production_model_intact(self):
        """Verify production model best_model.pth was NOT overwritten and backup exists."""
        self.assertTrue(os.path.exists(self.prod_weights), "Production best_model.pth must exist")
        self.assertTrue(os.path.exists(self.prod_backup), "Production backup must exist")

        with open(self.prod_weights, "rb") as f:
            current_prod_sha = hashlib.sha256(f.read()).hexdigest()

        with open(self.prod_backup, "rb") as f:
            backup_sha = hashlib.sha256(f.read()).hexdigest()

        self.assertEqual(current_prod_sha, EXPECTED_PRODUCTION_SHA256,
                         "Production checkpoint SHA256 was altered! Must remain original.")
        self.assertEqual(backup_sha, EXPECTED_PRODUCTION_SHA256,
                         "Production backup SHA256 must match original production model.")

    def test_06_production_loader_remains_operational(self):
        """Verify production loader pointing to default models_dir loads successfully."""
        prod_loader = MobileNetV3ModelLoader(models_dir=self.prod_dir)
        self.assertTrue(prod_loader.is_loaded, f"Production loader failed: {prod_loader.load_error}")
        self.assertEqual(prod_loader.num_classes, 6)
        self.assertEqual(prod_loader.classes, EXPECTED_6_CLASSES)

    def test_07_global_loader_loads_experimental_checkpoint(self):
        """Verify the loader loads checkpoint and metadata successfully."""
        loader = MobileNetV3ModelLoader(models_dir=self.exp_dir)
        self.assertTrue(loader.is_loaded, "Loader must be loaded")
        self.assertEqual(os.path.normcase(loader.models_dir), os.path.normcase(self.exp_dir))
        self.assertEqual(loader.version, "1.1.0-experiment")
        self.assertEqual(loader.real_data_classes, ["Waste Management"])
        status = loader.get_status()
        self.assertTrue(status["is_single_class_real_trained"])
        self.assertEqual(status["real_data_classes"], ["Waste Management"])

    def test_08_classify_complaint_mobilenet_primary_real_waste(self):
        """Verify MobileNetV3 is attempted first and accepts verified Waste Management images."""
        from classifier import classify_complaint
        with open(self.test_manifest, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        real_waste_path = manifest["test_samples"][0]
        self.assertTrue(os.path.exists(real_waste_path))

        res = classify_complaint(
            image_path=real_waste_path,
            description="Overflowing garbage bin with waste debris",
            request_id="test-exp-waste-01"
        )
        self.assertEqual(res["predictedCategory"], "Waste Management")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertEqual(res["source"], "mobilenet")
        self.assertFalse(res["isFallback"])
        self.assertFalse(res["fallbackUsed"])
        self.assertGreaterEqual(res["confidence"], 0.85)

    def test_09_classify_complaint_falls_back_for_unverified_categories(self):
        """Verify heuristic vision fallback executes when an image has no real training data in checkpoint."""
        from classifier import classify_complaint
        categories_to_test = [
            ("Drainage", "drainage_001.jpg", "Choked sewer drain overflowing"),
            ("Water Supply", "water_supply_001.jpg", "Burst pipeline drinking water leakage")
        ]

        for cat, img_name, desc in categories_to_test:
            sample_path = os.path.join(AI_DIR, "data", cat, img_name)
            self.assertTrue(os.path.exists(sample_path), f"Sample {sample_path} must exist")

            res = classify_complaint(
                image_path=sample_path,
                description=desc,
                request_id=f"test-fallback-{cat.lower()}"
            )
            self.assertEqual(res["predictionSource"], "heuristic_vision")
            self.assertEqual(res["source"], "heuristic_vision")
            self.assertTrue(res["isFallback"])
            self.assertTrue(res["fallbackUsed"])
            self.assertEqual(res["primaryModelAttempted"], "mobilenet_v3")
            self.assertIn("MobileNetV3", res["fallbackReason"])

    def test_10_safe_handling_when_model_disabled(self):
        """Verify graceful fallback to heuristic vision when model is forced or unavailable."""
        from classifier import classify_complaint
        sample_path = os.path.join(AI_DIR, "data", "Street Light", "street_light_001.jpg")

        res = classify_complaint(
            image_path=sample_path,
            description="Street light pole flickering",
            force_heuristic=True,
            request_id="test-force-heuristic"
        )
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertTrue(res["isFallback"])

    def test_11_gemini_not_invoked_by_default(self):
        """Verify Gemini is NEVER invoked unless explicitly requested."""
        from classifier import classify_complaint
        from unittest.mock import patch

        with open(self.test_manifest, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        real_waste_path = manifest["test_samples"][0]

        with patch("classifier.classify_with_gemini") as mock_gemini:
            res = classify_complaint(
                image_path=real_waste_path,
                description="Garbage bags on street",
                request_id="test-no-gemini"
            )
            self.assertEqual(mock_gemini.call_count, 0, "Gemini must NOT be invoked in standard flow!")
            self.assertEqual(res["predictionSource"], "mobilenet")

    def test_12_analyze_endpoint_e2e_real_waste(self):
        """Verify POST /analyze endpoint runs MobileNetV3 as primary on real waste images."""
        import app as flask_app
        client = flask_app.app.test_client()

        with open(self.test_manifest, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        real_waste_path = manifest["test_samples"][0]

        with open(real_waste_path, "rb") as f:
            data = {
                "image": (f, os.path.basename(real_waste_path)),
                "description": "Overflowing dumpster full of trash"
            }
            res = client.post("/analyze", data=data, content_type="multipart/form-data")

        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()
        self.assertEqual(res_json["predictionSource"], "mobilenet")
        self.assertEqual(res_json["source"], "mobilenet")
        self.assertEqual(res_json["predictedCategory"], "Waste Management")
        self.assertFalse(res_json["fallbackUsed"])

    def test_13_health_endpoint_reflects_active_checkpoint(self):
        """Verify GET /health reports mobilenet_v3 primary and active checkpoint."""
        import app as flask_app
        client = flask_app.app.test_client()

        res = client.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["primaryClassifier"], "mobilenet_v3")
        self.assertEqual(data["fallbackClassifier"], "heuristic_vision")
        self.assertIn(data["modelVersion"], ["1.1.0-experiment", "1.2.0-roads-waste-v2", "1.3.0-streetlight-roads-waste-v3"])
        self.assertIn("Waste Management", data["realDataClasses"])


if __name__ == "__main__":
    unittest.main()
