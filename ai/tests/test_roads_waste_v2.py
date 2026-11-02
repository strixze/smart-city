"""
Comprehensive Automated Test Suite for Roads & Waste Management MobileNetV3 (v2)
Validates:
1. All artifacts in ai/models_roads_waste_v2/ exist and are valid.
2. Exact 6-class output architecture and index mapping preservation:
   [0] Drainage, [1] Other, [2] Roads, [3] Street Light, [4] Waste Management, [5] Water Supply.
3. Model output tensor shape (1, 6) and verify_model_architecture compatibility.
4. Accuracy and prediction on real held-out Roads images.
5. Accuracy and prediction on real held-out Waste Management images.
6. Integrity of original checkpoints (ai/models/ and ai/models_real_data_experiment/ untouched).
7. Active resolution in MobileNetV3ModelLoader and Flask AI service (/health and /analyze).
8. Graceful heuristic vision fallback for categories without real training data.
"""

import os
import sys
import json
import hashlib
import unittest
import torch

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.dirname(CURRENT_DIR)
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from classifier import (
    MobileNetV3ModelLoader,
    MOBILENET_LOADER,
    verify_model_architecture,
    classify_complaint,
    get_model_status
)

EXPECTED_6_CLASSES = [
    "Drainage",
    "Other",
    "Roads",
    "Street Light",
    "Waste Management",
    "Water Supply"
]

EXPECTED_PROD_SHA256 = "fd08cc370382b69b0345e6a6678f7a758bb9703aba9d68d07e3384b15a16c1fd"
EXPECTED_EXP_SHA256 = "e4c2a7e17db12eacc9ba58fe4c27fdbcc721572da72e977806b49725827f846e"


class TestRoadsWasteV2(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.v2_dir = os.path.join(AI_DIR, "models_roads_waste_v2")
        cls.weights_path = os.path.join(cls.v2_dir, "best_model.pth")
        cls.config_path = os.path.join(cls.v2_dir, "model_config.json")
        cls.history_path = os.path.join(cls.v2_dir, "training_history.json")
        cls.manifest_path = os.path.join(cls.v2_dir, "test_manifest.json")
        cls.report_path = os.path.join(cls.v2_dir, "evaluation_report.json")

        cls.prod_weights = os.path.join(AI_DIR, "models", "best_model.pth")
        cls.exp_weights = os.path.join(AI_DIR, "models_real_data_experiment", "best_model.pth")

    def test_01_all_v2_artifacts_exist(self):
        """Verify all 5 required artifacts exist in ai/models_roads_waste_v2/."""
        self.assertTrue(os.path.isdir(self.v2_dir), "models_roads_waste_v2 directory must exist")
        self.assertTrue(os.path.exists(self.weights_path), "best_model.pth must exist")
        self.assertTrue(os.path.exists(self.config_path), "model_config.json must exist")
        self.assertTrue(os.path.exists(self.history_path), "training_history.json must exist")
        self.assertTrue(os.path.exists(self.manifest_path), "test_manifest.json must exist")
        self.assertTrue(os.path.exists(self.report_path), "evaluation_report.json must exist")

    def test_02_config_preserves_6_class_architecture(self):
        """Verify model_config.json preserves exact 6 classes and index mappings."""
        with open(self.config_path, "r", encoding="utf-8") as f:
            config = json.load(f)

        self.assertEqual(config["num_classes"], 6)
        self.assertEqual(config["classes"], EXPECTED_6_CLASSES)
        self.assertEqual(config["class_to_idx"]["Roads"], 2)
        self.assertEqual(config["class_to_idx"]["Waste Management"], 4)
        self.assertEqual(config["real_data_classes"], ["Waste Management", "Roads"])
        self.assertEqual(config["version"], "1.2.0-roads-waste-v2")

    def test_03_weights_shape_and_forward_pass(self):
        """Verify model checkpoint output shape is exactly (1, 6)."""
        loader = MobileNetV3ModelLoader(models_dir=self.v2_dir)
        self.assertTrue(loader.is_loaded, f"Failed to load: {loader.load_error}")
        self.assertEqual(loader.num_classes, 6)
        self.assertEqual(loader.classes, EXPECTED_6_CLASSES)

        state_dict = torch.load(self.weights_path, map_location="cpu", weights_only=True)
        self.assertEqual(state_dict["classifier.3.weight"].shape, torch.Size([6, 1024]))
        self.assertEqual(state_dict["classifier.3.bias"].shape, torch.Size([6]))

        is_valid = verify_model_architecture(loader.model, expected_classes=6, image_size=224)
        self.assertTrue(is_valid, "Forward pass verification must succeed for 6 classes")

    def test_04_previous_checkpoints_untouched(self):
        """Verify original production and experimental models were NOT modified (SHA256 check)."""
        with open(self.prod_weights, "rb") as f:
            prod_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(prod_sha, EXPECTED_PROD_SHA256, "Production best_model.pth was altered!")

        with open(self.exp_weights, "rb") as f:
            exp_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(exp_sha, EXPECTED_EXP_SHA256, "Experimental best_model.pth was altered!")

    def test_05_unseen_real_roads_images_classified_as_roads(self):
        """Verify unseen real held-out road damage images are classified as Roads."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        roads_samples = manifest["roads_test_samples"]
        self.assertGreater(len(roads_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.v2_dir)
        correct = 0
        for p in roads_samples[:10]:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Roads":
                correct += 1
            self.assertGreater(conf, 0.5)

        # High accuracy on sample subset
        self.assertGreaterEqual(correct / 10, 0.8)

    def test_06_unseen_real_waste_images_classified_as_waste(self):
        """Verify unseen real held-out waste images continue to be classified as Waste Management."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        wm_samples = manifest["waste_management_test_samples"]
        self.assertGreater(len(wm_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.v2_dir)
        correct = 0
        for p in wm_samples[:10]:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Waste Management":
                correct += 1
            self.assertGreater(conf, 0.5)

        self.assertGreaterEqual(correct / 10, 0.8)

    def test_07_active_resolution_in_global_loader(self):
        """Verify global MOBILENET_LOADER is loaded and supports Roads & Waste Management."""
        self.assertTrue(MOBILENET_LOADER.is_loaded)
        self.assertIn(os.path.normcase(MOBILENET_LOADER.models_dir), [
            os.path.normcase(self.v2_dir),
            os.path.normcase(os.path.join(AI_DIR, "models_streetlight_roads_waste_v3")),
            os.path.normcase(os.path.join(AI_DIR, "models_drainage_v3")),
            os.path.normcase(os.path.join(AI_DIR, "models_water_supply_v4"))
        ])
        self.assertIn(MOBILENET_LOADER.version, ["1.2.0-roads-waste-v2", "1.3.0-streetlight-roads-waste-v3", "1.4.0-drainage-v3", "1.5.0-water-supply-v4"])
        self.assertIn("Roads", MOBILENET_LOADER.real_data_classes)
        self.assertIn("Waste Management", MOBILENET_LOADER.real_data_classes)

        # Also verify dedicated v2 loader
        v2_loader = MobileNetV3ModelLoader(models_dir=self.v2_dir)
        self.assertTrue(v2_loader.is_loaded)
        self.assertEqual(v2_loader.version, "1.2.0-roads-waste-v2")

    def test_08_e2e_classify_complaint_roads_and_waste(self):
        """Verify end-to-end classification returns correct departments and categories."""
        # 1. Pothole / Road complaint
        road_img = os.path.join(AI_DIR, "data", "Roads", "philadelphia-damaged-road-1.webp")
        res_road = classify_complaint(
            image_path=road_img,
            description="Damaged asphalt road with severe potholes",
            request_id="test-e2e-road"
        )
        self.assertEqual(res_road["predictedCategory"], "Roads")
        self.assertEqual(res_road["predictionSource"], "mobilenet")
        self.assertEqual(res_road["department"], "Public Works Department (PWD) - Roads & Bridges")
        self.assertFalse(res_road["isFallback"])

        # 2. Waste complaint
        waste_img = os.path.join(AI_DIR, "data", "Waste Management", "people-dropping-their-garbage-bag-to-van-during-the-lockdown-due-to-the-covid-19-virus-corona.webp")
        res_waste = classify_complaint(
            image_path=waste_img,
            description="Municipal garbage truck waste collection",
            request_id="test-e2e-waste"
        )
        self.assertEqual(res_waste["predictedCategory"], "Waste Management")
        self.assertEqual(res_waste["predictionSource"], "mobilenet")
        self.assertEqual(res_waste["department"], "Department of Solid Waste Management & Sanitation")
        self.assertFalse(res_waste["isFallback"])

    def test_09_untrained_classes_route_to_fallback(self):
        """Verify categories without real data (Other) route to heuristic vision fallback."""
        sample_path = os.path.join(AI_DIR, "data", "Other", "other_sample.jpg")
        if not os.path.exists(sample_path):
            os.makedirs(os.path.dirname(sample_path), exist_ok=True)
            from PIL import Image
            Image.new("RGB", (224, 224), (128, 128, 128)).save(sample_path)

        res = classify_complaint(
            image_path=sample_path,
            description="General civic inquiry regarding property tax assessment office hours",
            request_id="test-fallback-other"
        )
        self.assertEqual(res["predictedCategory"], "Other")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertTrue(res["isFallback"])
        self.assertTrue(res["fallbackUsed"])

    def test_10_flask_health_and_analyze_endpoints(self):
        """Verify Flask API endpoints /health and /analyze."""
        import app as flask_app
        client = flask_app.app.test_client()

        # Health
        res_health = client.get("/health")
        self.assertEqual(res_health.status_code, 200)
        hdata = res_health.get_json()
        self.assertIn(hdata["modelVersion"], ["1.2.0-roads-waste-v2", "1.3.0-streetlight-roads-waste-v3", "1.4.0-drainage-v3", "1.5.0-water-supply-v4"])
        self.assertIn("Roads", hdata["realDataClasses"])
        self.assertIn("Waste Management", hdata["realDataClasses"])

        # Analyze POST
        road_img = os.path.join(AI_DIR, "data", "Roads", "philadelphia-damaged-road-1.webp")
        with open(road_img, "rb") as f:
            data = {
                "image": (f, "philadelphia-damaged-road-1.webp"),
                "description": "Damaged asphalt surface"
            }
            res_post = client.post("/analyze", data=data, content_type="multipart/form-data")
        self.assertEqual(res_post.status_code, 200)
        pdata = res_post.get_json()
        self.assertEqual(pdata["predictedCategory"], "Roads")
        self.assertEqual(pdata["predictionSource"], "mobilenet")


if __name__ == "__main__":
    unittest.main()
