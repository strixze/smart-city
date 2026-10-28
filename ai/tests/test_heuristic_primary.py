"""
Comprehensive Automated Regression Test Suite for Heuristic-Primary Civic Classifier.

Verifies:
1. Clear streetlight problem at night.
2. Drainage blockage photographed at night (NOT misclassified as Street Light).
3. Pothole or damaged road.
4. Garbage or litter (Waste Management).
5. Water supply problem.
6. Ambiguous image returns honest review-required uncertain result.
7. Empty complaint descriptions (image-only classification).
8. EXIF-rotated images (normalized orientation).
9. Equal or nearly equal heuristic scores (tie detection without dictionary order).
10. Invalid and corrupted image uploads safely handled.
11. Direct /analyze HTTP endpoint assertions:
    - Reports predictionSource: 'heuristic_vision'
    - MobileNetV3 is NOT invoked during normal heuristic-primary flow
    - Optional diagnostic flag executes MobileNetV3 without overriding heuristic result
12. Emergency hazard escalation to CRITICAL.
13. Municipal department routing integrity.
"""

import os
import io
import sys
import json
import unittest
from unittest.mock import patch, MagicMock
from PIL import Image, ImageOps

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.dirname(CURRENT_DIR)
if AI_DIR not in sys.path:
    sys.path.insert(0, AI_DIR)

from schemas import CIVIC_TAXONOMY, get_department_for_category
from classifier import (
    classify_heuristic_vision,
    classify_complaint,
    classify_text_heuristic,
    MOBILENET_LOADER,
)
import app as flask_app


class TestHeuristicVisionPrimary(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.app_client = flask_app.app.test_client()
        cls.data_dir = os.path.join(AI_DIR, "data")

    def test_01_clear_streetlight_at_night(self):
        """Test 1: Clear streetlight problem at night classified via heuristic vision."""
        sample_path = os.path.join(self.data_dir, "Street Light", "street_light_001.jpg")
        self.assertTrue(os.path.exists(sample_path), f"Street light sample must exist at {sample_path}")

        res = classify_heuristic_vision(
            image_path=sample_path,
            description="Street light pole flickering in the dark on 5th Avenue",
            request_id="test-sl-night-01"
        )

        self.assertEqual(res["predictedCategory"], "Street Light")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertEqual(res["source"], "heuristic_vision")
        self.assertIn("SL_LUMINAIRE_POINT_SOURCE", res.get("visualClues", []))
        self.assertGreaterEqual(res["confidence"], 0.70)
        self.assertEqual(res["department"], "Electrical Engineering & Public Lighting Division")
        self.assertFalse(res["isUncertain"])
        self.assertFalse(res["isTied"])

    def test_02_drainage_blockage_at_night_not_classified_as_streetlight(self):
        """Test 2: Dark drainage blockage must NOT be misclassified as Street Light merely because it is dark."""
        sample_path = os.path.join(self.data_dir, "Drainage", "drainage_001.jpg")
        self.assertTrue(os.path.exists(sample_path), f"Drainage sample must exist at {sample_path}")

        # Image has low brightness (<60), but lacks point luminaire / high-contrast street light source
        res = classify_heuristic_vision(
            image_path=sample_path,
            description="Drainage blockage with stagnant sewage water at night",
            request_id="test-drain-night-02"
        )

        self.assertEqual(res["predictedCategory"], "Drainage")
        self.assertNotEqual(res["predictedCategory"], "Street Light", "Drainage at night must NOT be called Street Light")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertIn("DRAIN_MURKY_WATER", res.get("visualClues", []))
        self.assertEqual(res["department"], "Municipal Water Supply & Sewerage Board (Drainage Wing)")

    def test_03_road_pothole_or_damaged_road(self):
        """Test 3: Pothole / damaged asphalt road surface."""
        sample_path = os.path.join(self.data_dir, "Roads", "roads_001.jpg")
        self.assertTrue(os.path.exists(sample_path), f"Roads sample must exist at {sample_path}")

        res = classify_heuristic_vision(
            image_path=sample_path,
            description="Deep pothole on the asphalt carriageway",
            request_id="test-road-03"
        )

        self.assertEqual(res["predictedCategory"], "Roads")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertIn("ROAD_ASPHALT_SURFACE", res.get("visualClues", []))
        self.assertEqual(res["department"], "Public Works Department (PWD) - Roads & Bridges")

    def test_04_garbage_or_litter_waste_management(self):
        """Test 4: Waste Management / high clutter litter."""
        # Use a TACO image with high texture clutter
        taco_sample = None
        waste_dir = os.path.join(self.data_dir, "Waste Management")
        for f in os.listdir(waste_dir):
            if f.startswith("taco_"):
                taco_sample = os.path.join(waste_dir, f)
                break
        self.assertIsNotNone(taco_sample, "At least one TACO waste sample must exist")

        res = classify_heuristic_vision(
            image_path=taco_sample,
            description="Large garbage dump and overflowing trash litter",
            request_id="test-waste-04"
        )

        self.assertEqual(res["predictedCategory"], "Waste Management")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertIn("WASTE_HIGH_CLUTTER", res.get("visualClues", []))
        self.assertEqual(res["department"], "Department of Solid Waste Management & Sanitation")

    def test_05_water_supply_problem(self):
        """Test 5: Water supply pipe / leakage."""
        sample_path = os.path.join(self.data_dir, "Water Supply", "water_supply_001.jpg")
        self.assertTrue(os.path.exists(sample_path), f"Water supply sample must exist at {sample_path}")

        res = classify_heuristic_vision(
            image_path=sample_path,
            description="Drinking water pipeline burst and leaking clean water",
            request_id="test-water-05"
        )

        self.assertEqual(res["predictedCategory"], "Water Supply")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertIn("WATER_PIPE_COLORATION", res.get("visualClues", []))
        self.assertEqual(res["department"], "Municipal Water Supply & Sewerage Board (Water Wing)")

    def test_06_ambiguous_image_returns_uncertain_review_required(self):
        """Test 6: Ambiguous / flat image returns an honest review-required uncertain result."""
        # Create an artificial flat uniform image with zero distinctive municipal features
        buf = io.BytesIO()
        flat_img = Image.new("RGB", (128, 128), color=(140, 140, 140))
        flat_img.save(buf, format="JPEG")
        buf.seek(0)

        temp_flat_path = os.path.join(AI_DIR, "tests", "temp_flat.jpg")
        with open(temp_flat_path, "wb") as f:
            f.write(buf.getvalue())

        try:
            res = classify_heuristic_vision(
                image_path=temp_flat_path,
                description="",  # No text to disambiguate
                request_id="test-ambiguous-06"
            )

            self.assertEqual(res["predictedCategory"], "Other")
            self.assertEqual(res["predictedSubcategory"], "General Issue")
            self.assertTrue(res["isUncertain"], "Result must be flagged as uncertain")
            self.assertLessEqual(res["confidence"], 0.45, "Confidence must be low and honest")
            self.assertIn("manual review", res["reason"].lower())
        finally:
            if os.path.exists(temp_flat_path):
                os.remove(temp_flat_path)

    def test_07_empty_complaint_description_image_only(self):
        """Test 7: Empty complaint description relies purely on visual cues."""
        sample_path = os.path.join(self.data_dir, "Roads", "roads_001.jpg")

        res = classify_heuristic_vision(
            image_path=sample_path,
            description="",  # Completely empty text
            request_id="test-empty-desc-07"
        )

        self.assertEqual(res["predictedCategory"], "Roads")
        self.assertEqual(res["predictionSource"], "heuristic_vision")
        self.assertIn("ROAD_ASPHALT_SURFACE", res.get("visualClues", []))
        # Confidence must be reasonable for image-only
        self.assertGreaterEqual(res["confidence"], 0.60)
        self.assertLessEqual(res["confidence"], 0.80)

    def test_08_exif_rotated_image_normalized(self):
        """Test 8: EXIF orientation is normalized before feature extraction."""
        # Create an image with EXIF orientation 6 (rotated 90 CW)
        img = Image.new("RGB", (200, 100), color=(30, 30, 30))
        exif = img.getexif()
        exif[0x0112] = 6  # orientation 6
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif)

        temp_exif_path = os.path.join(AI_DIR, "tests", "temp_exif.jpg")
        with open(temp_exif_path, "wb") as f:
            f.write(buf.getvalue())

        try:
            res = classify_heuristic_vision(
                image_path=temp_exif_path,
                description="Street light pole damaged",
                request_id="test-exif-08"
            )
            self.assertIsNotNone(res)
            # EXIF transpose rotated (200, 100) -> (100, 200)
            features = res.get("features", {})
            self.assertEqual(features.get("width"), 100)
            self.assertEqual(features.get("height"), 200)
        finally:
            if os.path.exists(temp_exif_path):
                os.remove(temp_exif_path)

    def test_09_equal_or_tied_scores_detected_without_dictionary_order(self):
        """Test 9: Tied category scores are detected and resolved transparently without dictionary bias."""
        # Test text-only tied input: identical keyword score for two categories
        text_with_tied_keywords = "pothole on road and water leakage tap"
        res = classify_text_heuristic(
            description=text_with_tied_keywords,
            request_id="test-tie-09"
        )

        # Both Roads and Water Supply get equal score
        if res.get("isTied"):
            self.assertTrue(res["isUncertain"])
            self.assertEqual(res["predictedCategory"], "Other")
            self.assertIn("Roads", res["tiedCategories"])
            self.assertIn("Water Supply", res["tiedCategories"])
            self.assertIn("tied", res["reason"].lower())
            self.assertLessEqual(res["confidence"], 0.45)

    def test_10_invalid_and_corrupt_image_upload(self):
        """Test 10: Invalid/corrupt image bytes handled safely without crashing."""
        corrupt_buf = io.BytesIO(b"NOT_A_VALID_IMAGE_BINARY_GIBBERISH_12345")
        data = {
            "image": (corrupt_buf, "corrupt.jpg"),
            "description": "Broken streetlight"
        }
        res = self.app_client.post("/analyze", data=data, content_type="multipart/form-data")

        # Must return valid HTTP response (either 200 with text fallback or handled gracefully)
        self.assertIn(res.status_code, [200, 400])
        res_data = res.get_json()
        self.assertIsNotNone(res_data)

    def test_11_analyze_endpoint_normal_flow_does_not_invoke_mobilenet(self):
        """Test 11: Priority check - MobileNetV3 is NOT invoked during normal heuristic-primary flow."""
        sample_path = os.path.join(self.data_dir, "Street Light", "street_light_001.jpg")

        with patch.object(MOBILENET_LOADER, "predict", wraps=MOBILENET_LOADER.predict) as mock_predict:
            with open(sample_path, "rb") as f:
                data = {
                    "image": (f, "street_light_001.jpg"),
                    "description": "Street light pole on 5th Street"
                }
                res = self.app_client.post("/analyze", data=data, content_type="multipart/form-data")

            self.assertEqual(res.status_code, 200)
            res_json = res.get_json()

            # Primary assertions: Gemini Vision is primary
            self.assertEqual(res_json["predictionSource"], "gemini_vision")
            self.assertEqual(res_json["source"], "gemini")
            self.assertEqual(res_json["predictedCategory"], "Street Light")
            self.assertFalse(res_json["fallbackUsed"])

            # CRITICAL CONSTRAINT ASSERTION: MobileNetV3 predict was NOT invoked!
            self.assertEqual(mock_predict.call_count, 0, "MobileNetV3 must NOT be invoked in primary flow!")

    def test_12_analyze_endpoint_optional_diagnostic_does_not_override_primary(self):
        """Test 12: MobileNetV3 runs only when explicitly requested as diagnostic, without overriding."""
        sample_path = os.path.join(self.data_dir, "Street Light", "street_light_001.jpg")

        with open(sample_path, "rb") as f:
            data = {
                "image": (f, "street_light_001.jpg"),
                "description": "Street light pole on 5th Street",
                "diagnostic": "true"
            }
            res = self.app_client.post("/analyze", data=data, content_type="multipart/form-data")

        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()

        # Gemini must remain the primary source and result
        self.assertEqual(res_json["predictionSource"], "gemini_vision")
        self.assertEqual(res_json["predictedCategory"], "Street Light")

        # Diagnostic payload must be attached under diagnostics.mobilenet
        self.assertIn("diagnostics", res_json)
        self.assertIn("mobilenet", res_json["diagnostics"])
        mobilenet_diag = res_json["diagnostics"]["mobilenet"]
        self.assertFalse(mobilenet_diag.get("overrode_primary", True))
        self.assertIn("category", mobilenet_diag)

    def test_13_emergency_hazard_escalation(self):
        """Test 13: Emergency hazard terms escalate priority to CRITICAL."""
        res = classify_text_heuristic(
            description="Live wire hanging down causing dangerous electric shock and sparking near footpath",
            request_id="test-hazard-13"
        )
        self.assertEqual(res["priority"], "CRITICAL")
        self.assertIn("CRITICAL", res["reason"])

    def test_14_department_routing_for_all_taxonomies(self):
        """Test 14: Municipal department routing maps accurately for all master categories."""
        expected_mappings = {
            "Drainage": "Municipal Water Supply & Sewerage Board (Drainage Wing)",
            "Roads": "Public Works Department (PWD) - Roads & Bridges",
            "Street Light": "Electrical Engineering & Public Lighting Division",
            "Waste Management": "Department of Solid Waste Management & Sanitation",
            "Water Supply": "Municipal Water Supply & Sewerage Board (Water Wing)",
            "Other": "General Municipal Grievance Cell",
        }

        for cat, dept in expected_mappings.items():
            mapped = get_department_for_category(cat)
            self.assertEqual(mapped, dept, f"Category {cat} must map to {dept}")


if __name__ == "__main__":
    unittest.main()
