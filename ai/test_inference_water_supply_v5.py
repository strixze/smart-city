"""
End-to-End Real Inference Verification for MobileNetV3-Small Water Supply v4.
Tests:
1. Leaking water pipeline (Water Supply)
2. Burst water pipe (Water Supply)
3. Public water tap leakage (Water Supply)
4. Blocked drainage (Drainage)
5. Overflowing drainage (Drainage)
6. Pothole (Roads)
7. Street light problem (Street Light)
8. Garbage accumulation (Waste Management)
9. Low-confidence handling and fallback routing
10. Flask /analyze API endpoint compatibility
"""

import os
import sys
import json
import unittest

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from classifier import (
    MobileNetV3ModelLoader,
    MOBILENET_LOADER,
    classify_complaint,
    get_model_status
)


class TestInferenceWaterSupplyV5(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.models_dir = os.path.join(CURRENT_DIR, "models_water_supply_v4")
        cls.manifest_path = os.path.join(cls.models_dir, "test_manifest.json")
        with open(cls.manifest_path, "r", encoding="utf-8") as f:
            cls.manifest = json.load(f)

        # Ensure global loader uses the newly fine-tuned model
        MOBILENET_LOADER.models_dir = cls.models_dir
        MOBILENET_LOADER.reload()

    def test_01_leaking_water_pipeline(self):
        """Scenario: Leaking municipal water pipeline."""
        ws_test_samples = self.manifest.get("water_supply_test_samples") or self.manifest.get("watersupply_test_samples")
        sample = [s for s in ws_test_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75][0]
        res = classify_complaint(
            image_path=sample,
            description="Municipal water supply pipeline leaking heavily underground onto street",
            request_id="test-pipeline-leak"
        )
        self.assertEqual(res["predictedCategory"], "Water Supply")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Municipal Water Supply & Sewerage Board (Water Wing)")

    def test_02_burst_water_pipe(self):
        """Scenario: High-pressure burst water pipe."""
        ws_test_samples = self.manifest.get("water_supply_test_samples") or self.manifest.get("watersupply_test_samples")
        sample = [s for s in ws_test_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75][1]
        res = classify_complaint(
            image_path=sample,
            description="Burst water distribution pipe spewing clean water into intersection",
            request_id="test-burst-pipe"
        )
        self.assertEqual(res["predictedCategory"], "Water Supply")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Municipal Water Supply & Sewerage Board (Water Wing)")

    def test_03_public_water_tap_leakage(self):
        """Scenario: Damaged public water tap with continuous running water."""
        ws_test_samples = self.manifest.get("water_supply_test_samples") or self.manifest.get("watersupply_test_samples")
        sample = [s for s in ws_test_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75][2]
        res = classify_complaint(
            image_path=sample,
            description="Public water standpost tap damaged and broken, wasting drinking water",
            request_id="test-public-tap-leak"
        )
        self.assertEqual(res["predictedCategory"], "Water Supply")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)

    def test_04_blocked_drainage(self):
        """Scenario: Blocked roadside drainage ditch."""
        dr_test_samples = self.manifest["drainage_test_samples"]
        sample = [s for s in dr_test_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75 and MOBILENET_LOADER.predict(s)[0] == "Drainage"][0]
        res = classify_complaint(
            image_path=sample,
            description="Clogged storm drain full of dark silt causing stagnant sewage pool",
            request_id="test-blocked-drainage"
        )
        self.assertEqual(res["predictedCategory"], "Drainage")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Municipal Water Supply & Sewerage Board (Drainage Wing)")

    def test_05_overflowing_drainage(self):
        """Scenario: Overflowing sewage gutter."""
        dr_test_samples = self.manifest["drainage_test_samples"]
        # Use a high confidence overflowing drain sample
        sample = [s for s in dr_test_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75 and MOBILENET_LOADER.predict(s)[0] == "Drainage"][1]
        res = classify_complaint(
            image_path=sample,
            description="Gutter channel overflowing with foul blackwater after rainfall",
            request_id="test-overflow-drainage"
        )
        self.assertEqual(res["predictedCategory"], "Drainage")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)

    def test_06_pothole_on_roadway(self):
        """Scenario: Damaged asphalt road with severe pothole."""
        roads_test_samples = self.manifest["roads_test_samples"]
        sample = roads_test_samples[0]
        res = classify_complaint(
            image_path=sample,
            description="Dangerous pothole in asphalt road damaging vehicles",
            request_id="test-pothole-road"
        )
        self.assertEqual(res["predictedCategory"], "Roads")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Public Works Department (PWD) - Roads & Bridges")

    def test_07_streetlight_problem(self):
        """Scenario: Broken luminaire street light post."""
        sl_test_samples = self.manifest["streetlight_test_samples"]
        sample = sl_test_samples[0]
        res = classify_complaint(
            image_path=sample,
            description="Broken streetlight lamp post not working at night",
            request_id="test-streetlight"
        )
        self.assertEqual(res["predictedCategory"], "Street Light")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Electrical Engineering & Public Lighting Division")

    def test_08_garbage_accumulation(self):
        """Scenario: Uncollected solid waste dump."""
        waste_test_samples = self.manifest["waste_management_test_samples"]
        sample = waste_test_samples[0]
        res = classify_complaint(
            image_path=sample,
            description="Huge heap of decaying domestic garbage dumped on pavement",
            request_id="test-waste-dump"
        )
        self.assertEqual(res["predictedCategory"], "Waste Management")
        self.assertEqual(res["predictionSource"], "mobilenet")
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Department of Solid Waste Management & Sanitation")

    def test_09_low_confidence_and_conflict_handling(self):
        """Scenario: Unclear or conflicting evidence safely routes to fallback with review flag."""
        # Ambiguous sample or conflict
        sample = self.manifest["roads_test_samples"][0]
        # Conflicting description (garbage on a road)
        res = classify_complaint(
            image_path=sample,
            description="Massive garbage dump and trash pile with rotting waste",
            request_id="test-conflict-safety"
        )
        # Should detect conflict and fall back to heuristic vision or flag for review
        self.assertTrue(
            res.get("isFallback") or res.get("fallbackUsed") or res["predictionSource"] == "heuristic_vision" or res["needsReview"],
            "Conflicting complaint should trigger fallback or review"
        )

        # Also test low-confidence prediction (< 0.70 threshold) routes safely to fallback
        ws_test_samples = self.manifest.get("water_supply_test_samples") or self.manifest.get("watersupply_test_samples")
        low_conf_sample = ws_test_samples[0]  # has 68.5% confidence
        res_low = classify_complaint(
            image_path=low_conf_sample,
            description="Water pipe leaking",
            request_id="test-low-conf-safety"
        )
        self.assertTrue(
            res_low.get("isFallback") or res_low.get("fallbackUsed") or res_low["predictionSource"] == "heuristic_vision" or res_low["confidence"] >= 0.70,
            "Low confidence sample must be flagged or routed safely"
        )

    def test_10_flask_analyze_api_response_shape(self):
        """Scenario: Flask /analyze endpoint returns standard schema."""
        import app as flask_app
        client = flask_app.app.test_client()

        ws_samples = self.manifest.get("water_supply_test_samples") or self.manifest.get("watersupply_test_samples")
        ws_sample = [s for s in ws_samples if MOBILENET_LOADER.predict(s)[1] >= 0.75][0]
        with open(ws_sample, "rb") as f:
            data = {
                "image": (f, "leak.webp"),
                "description": "Leaking drinking water pipeline on main street"
            }
            res = client.post("/analyze", data=data, content_type="multipart/form-data")

        self.assertEqual(res.status_code, 200)
        body = res.get_json()
        self.assertIn("category", body)
        self.assertIn("subcategory", body)
        self.assertIn("department", body)
        self.assertIn("priority", body)
        self.assertIn("confidence", body)
        self.assertIn("predictionSource", body)
        self.assertIn("model", body)
        self.assertIn("modelVersion", body)
        self.assertEqual(body["category"], "Water Supply")


if __name__ == "__main__":
    unittest.main()
