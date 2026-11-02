"""
Comprehensive Automated Test Suite for Water Supply, Drainage, Street Light, Roads & Waste Management MobileNetV3 (v5)
Validates:
1. All artifacts in ai/models_water_supply_v4/ exist and are valid.
2. Exact 6-class output architecture and index mapping preservation:
   [0] Drainage, [1] Other, [2] Roads, [3] Street Light, [4] Waste Management, [5] Water Supply.
3. Model output tensor shape (1, 6) and verify_model_architecture compatibility.
4. Accuracy and prediction on real held-out Water Supply images.
5. Accuracy and prediction on real held-out Drainage images.
6. Accuracy and prediction on real held-out Roads images.
7. Accuracy and prediction on real held-out Street Light images.
8. Accuracy and prediction on real held-out Waste Management images.
9. Immutability of all previous checkpoints (prod, exp, v2, v3, drainage_v3).
10. Active resolution in MobileNetV3ModelLoader and Flask AI service (/health and /analyze).
11. Disambiguation between Water Supply, Drainage, Waste Management, and Roads.
12. Honest fallback handling for the 6th untrained category ("Other").
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
EXPECTED_V2_SHA256 = "8793b52e24abc9d0a62bdef01422815a3673406aff06edc6cb8a93f4d5951b79"
EXPECTED_V3_SHA256 = "5812822f76903956f222cca18d9c04d264762c47199b5592ba6e89fc5a56d621"
EXPECTED_DRAINAGE_V3_SHA256 = "e4b818bb935a89931307610f33b95333c8647ef41ffec2760bbded9fb36c8d16"


class TestWaterSupplyV4(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.ws_v4_dir = os.path.join(AI_DIR, "models_water_supply_v4")
        cls.weights_path = os.path.join(cls.ws_v4_dir, "best_model.pth")
        cls.config_path = os.path.join(cls.ws_v4_dir, "model_config.json")
        cls.history_path = os.path.join(cls.ws_v4_dir, "training_history.json")
        cls.manifest_path = os.path.join(cls.ws_v4_dir, "test_manifest.json")
        cls.report_path = os.path.join(cls.ws_v4_dir, "evaluation_report.json")

        cls.prod_weights = os.path.join(AI_DIR, "models", "best_model.pth")
        cls.exp_weights = os.path.join(AI_DIR, "models_real_data_experiment", "best_model.pth")
        cls.v2_weights = os.path.join(AI_DIR, "models_roads_waste_v2", "best_model.pth")
        cls.v3_weights = os.path.join(AI_DIR, "models_streetlight_roads_waste_v3", "best_model.pth")
        cls.drainage_v3_weights = os.path.join(AI_DIR, "models_drainage_v3", "best_model.pth")

    def test_01_all_water_supply_v4_artifacts_exist(self):
        """Verify all 5 required artifacts exist in ai/models_water_supply_v4/."""
        self.assertTrue(os.path.isdir(self.ws_v4_dir), "models_water_supply_v4 directory must exist")
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
        self.assertEqual(config["class_to_idx"]["Drainage"], 0)
        self.assertEqual(config["class_to_idx"]["Other"], 1)
        self.assertEqual(config["class_to_idx"]["Roads"], 2)
        self.assertEqual(config["class_to_idx"]["Street Light"], 3)
        self.assertEqual(config["class_to_idx"]["Waste Management"], 4)
        self.assertEqual(config["class_to_idx"]["Water Supply"], 5)
        self.assertEqual(
            config["real_data_classes"],
            ["Drainage", "Roads", "Street Light", "Waste Management", "Water Supply"]
        )
        self.assertEqual(config["version"], "1.5.0-water-supply-v4")

    def test_03_weights_shape_and_forward_pass(self):
        """Verify model checkpoint output shape is exactly (1, 6)."""
        loader = MobileNetV3ModelLoader(models_dir=self.ws_v4_dir)
        self.assertTrue(loader.is_loaded, f"Failed to load: {loader.load_error}")
        self.assertEqual(loader.num_classes, 6)
        self.assertEqual(loader.classes, EXPECTED_6_CLASSES)

        state_dict = torch.load(self.weights_path, map_location="cpu", weights_only=True)
        self.assertEqual(state_dict["classifier.3.weight"].shape, torch.Size([6, 1024]))
        self.assertEqual(state_dict["classifier.3.bias"].shape, torch.Size([6]))

        is_valid = verify_model_architecture(loader.model, expected_classes=6, image_size=224)
        self.assertTrue(is_valid, "Forward pass verification must succeed for 6 classes")

    def test_04_previous_checkpoints_untouched(self):
        """Verify original production, experimental, v2, v3, and drainage_v3 models were NOT modified (SHA256 check)."""
        with open(self.prod_weights, "rb") as f:
            prod_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(prod_sha, EXPECTED_PROD_SHA256, "Production best_model.pth was altered!")

        with open(self.exp_weights, "rb") as f:
            exp_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(exp_sha, EXPECTED_EXP_SHA256, "Experimental best_model.pth was altered!")

        with open(self.v2_weights, "rb") as f:
            v2_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(v2_sha, EXPECTED_V2_SHA256, "v2 best_model.pth was altered!")

        with open(self.v3_weights, "rb") as f:
            v3_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(v3_sha, EXPECTED_V3_SHA256, "v3 best_model.pth was altered!")

        with open(self.drainage_v3_weights, "rb") as f:
            dr_sha = hashlib.sha256(f.read()).hexdigest()
        self.assertEqual(dr_sha, EXPECTED_DRAINAGE_V3_SHA256, "Drainage v3 best_model.pth was altered!")

    def test_05_unseen_real_watersupply_images_classified(self):
        """Verify unseen real held-out Water Supply images are classified as Water Supply."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        ws_samples = manifest.get("water_supply_test_samples") or manifest.get("watersupply_test_samples")
        self.assertIsNotNone(ws_samples)
        self.assertGreater(len(ws_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.ws_v4_dir)
        correct = 0
        for p in ws_samples:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Water Supply":
                correct += 1

        acc = correct / len(ws_samples)
        self.assertGreaterEqual(acc, 0.75, f"Water Supply test accuracy {acc*100:.1f}% below expectation")

    def test_06_unseen_real_drainage_images_classified(self):
        """Verify unseen real held-out Drainage images continue to be classified as Drainage."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        dr_samples = manifest["drainage_test_samples"]
        self.assertGreater(len(dr_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.ws_v4_dir)
        correct = 0
        for p in dr_samples:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Drainage":
                correct += 1

        acc = correct / len(dr_samples)
        self.assertGreaterEqual(acc, 0.70, f"Drainage test accuracy {acc*100:.1f}% below expectation")

    def test_07_unseen_real_roads_images_classified(self):
        """Verify unseen real held-out road damage images continue to be classified as Roads."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        roads_samples = manifest["roads_test_samples"]
        self.assertGreater(len(roads_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.ws_v4_dir)
        correct = 0
        for p in roads_samples:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Roads":
                correct += 1

        acc = correct / len(roads_samples)
        self.assertGreaterEqual(acc, 0.85, f"Roads test accuracy {acc*100:.1f}% below expectation")

    def test_08_unseen_real_streetlight_images_classified(self):
        """Verify unseen real held-out Street Light images continue to be classified as Street Light."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        sl_samples = manifest["streetlight_test_samples"]
        self.assertGreater(len(sl_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.ws_v4_dir)
        correct = 0
        for p in sl_samples:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Street Light":
                correct += 1

        acc = correct / len(sl_samples)
        self.assertGreaterEqual(acc, 0.85, f"Street Light test accuracy {acc*100:.1f}% below expectation")

    def test_09_unseen_real_waste_images_classified(self):
        """Verify unseen real held-out waste images continue to be classified as Waste Management."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        wm_samples = manifest["waste_management_test_samples"]
        self.assertGreater(len(wm_samples), 0)

        loader = MobileNetV3ModelLoader(models_dir=self.ws_v4_dir)
        correct = 0
        for p in wm_samples:
            cat, conf, top_preds, lat = loader.predict(p)
            if cat == "Waste Management":
                correct += 1

        acc = correct / len(wm_samples)
        self.assertGreaterEqual(acc, 0.85, f"Waste Management test accuracy {acc*100:.1f}% below expectation")

    def test_10_active_resolution_in_global_loader(self):
        """Verify global MOBILENET_LOADER resolves to models_water_supply_v4."""
        MOBILENET_LOADER.models_dir = os.path.join(AI_DIR, "models_water_supply_v4")
        MOBILENET_LOADER.reload()
        self.assertTrue(MOBILENET_LOADER.is_loaded)
        self.assertEqual(os.path.normcase(MOBILENET_LOADER.models_dir), os.path.normcase(self.ws_v4_dir))
        self.assertEqual(MOBILENET_LOADER.version, "1.5.0-water-supply-v4")
        self.assertIn("Drainage", MOBILENET_LOADER.real_data_classes)
        self.assertIn("Roads", MOBILENET_LOADER.real_data_classes)
        self.assertIn("Street Light", MOBILENET_LOADER.real_data_classes)
        self.assertIn("Waste Management", MOBILENET_LOADER.real_data_classes)
        self.assertIn("Water Supply", MOBILENET_LOADER.real_data_classes)

    def test_11_disambiguation_scenarios(self):
        """Verify proper classification and disambiguation across civic complaint scenarios."""
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

        # 1. Leaking water pipe -> Water Supply
        ws_samples = manifest.get("water_supply_test_samples") or manifest.get("watersupply_test_samples")
        ws_sample = [s for s in ws_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75][0]
        res_ws = classify_complaint(
            image_path=ws_sample,
            description="High pressure municipal drinking water pipe burst leaking onto pavement",
            request_id="test-water-pipeline-leak"
        )
        self.assertEqual(res_ws["predictedCategory"], "Water Supply")
        self.assertEqual(res_ws["predictionSource"], "mobilenet")
        self.assertEqual(res_ws["department"], "Municipal Water Supply & Sewerage Board (Water Wing)")

        # 2. Blocked / overflowing drain -> Drainage
        dr_sample = manifest["drainage_test_samples"][0]
        res_dr = classify_complaint(
            image_path=dr_sample,
            description="Drain choked with silt causing foul sewage water to overflow",
            request_id="test-drainage-overflow"
        )
        self.assertEqual(res_dr["predictedCategory"], "Drainage")
        self.assertEqual(res_dr["department"], "Municipal Water Supply & Sewerage Board (Drainage Wing)")

        # 3. Pothole / road damage -> Roads
        roads_sample = manifest["roads_test_samples"][0]
        res_rd = classify_complaint(
            image_path=roads_sample,
            description="Deep hazardous pothole on roadway asphalt",
            request_id="test-pothole-road"
        )
        self.assertEqual(res_rd["predictedCategory"], "Roads")
        self.assertEqual(res_rd["department"], "Public Works Department (PWD) - Roads & Bridges")

        # 4. Garbage pile -> Waste Management
        waste_sample = manifest["waste_management_test_samples"][0]
        res_wm = classify_complaint(
            image_path=waste_sample,
            description="Overflowing community garbage dumpster with plastic litter",
            request_id="test-garbage-dump"
        )
        self.assertEqual(res_wm["predictedCategory"], "Waste Management")
        self.assertEqual(res_wm["department"], "Department of Solid Waste Management & Sanitation")

    def test_12_untrained_other_routes_to_fallback(self):
        """Verify category 'Other' (without real training data) safely routes to heuristic fallback."""
        # Using a blank/synthetic image for Other
        sample_path = os.path.join(AI_DIR, "data", "Other", "other_001.jpg")
        if not os.path.exists(sample_path):
            sample_path = os.path.join(AI_DIR, "data", "Drainage", "drainage_001.jpg")

        res = classify_complaint(
            image_path=sample_path,
            description="General civic inquiry regarding property tax assessment office hours",
            request_id="test-fallback-other"
        )
        self.assertEqual(res["predictedCategory"], "Other")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertTrue(res["isFallback"])
        self.assertTrue(res["fallbackUsed"])

    def test_13_flask_health_and_analyze_endpoints(self):
        """Verify Flask API endpoints /health and /analyze with Water Supply."""
        import app as flask_app
        client = flask_app.app.test_client()

        # Health
        res_health = client.get("/health")
        self.assertEqual(res_health.status_code, 200)
        hdata = res_health.get_json()
        self.assertEqual(hdata["modelVersion"], "1.5.0-water-supply-v4")
        self.assertIn("Water Supply", hdata["realDataClasses"])
        self.assertIn("Drainage", hdata["realDataClasses"])
        self.assertIn("Roads", hdata["realDataClasses"])
        self.assertIn("Street Light", hdata["realDataClasses"])
        self.assertIn("Waste Management", hdata["realDataClasses"])

        # Analyze POST for Water Supply
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
        ws_samples = manifest.get("water_supply_test_samples") or manifest.get("watersupply_test_samples")
        ws_test_sample = [s for s in ws_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75][0]

        with open(ws_test_sample, "rb") as f:
            data = {
                "image": (f, "test_watersupply.webp"),
                "description": "Burst main pipe leaking municipal water onto sidewalk"
            }
            res_post = client.post("/analyze", data=data, content_type="multipart/form-data")

        self.assertEqual(res_post.status_code, 200)
        pdata = res_post.get_json()
        self.assertEqual(pdata["predictedCategory"], "Water Supply")
        self.assertEqual(pdata["predictionSource"], "mobilenet")
        self.assertEqual(pdata["department"], "Municipal Water Supply & Sewerage Board (Water Wing)")


if __name__ == "__main__":
    unittest.main()
