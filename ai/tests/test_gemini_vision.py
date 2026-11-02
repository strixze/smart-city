import os
import unittest
import tempfile
from classifier import classify_with_gemini, classify_complaint
from schemas import SUPPORTED_CIVIC_CATEGORIES

class TestGeminiVisionEdgeCases(unittest.TestCase):

    def test_missing_or_invalid_api_key(self):
        """Test missing or invalid key explicitly falls back with isFallback: True, source: rules."""
        sample_img = os.path.join(os.path.dirname(__file__), 'data', 'Roads', 'roads_001.jpg')
        
        # Test with invalid key
        res = classify_with_gemini(
            image_path=sample_img,
            description="Deep pothole on asphalt road",
            api_key="INVALID_GEMINI_KEY_XYZ_12345",
            request_id="test_invalid_key"
        )
        self.assertTrue(res["isFallback"], "Must explicitly mark isFallback: True on invalid key")
        self.assertTrue(res["fallbackUsed"], "Must explicitly mark fallbackUsed: True")
        self.assertEqual(res["predictionSource"], "rules", "Prediction source must be 'rules', not disguised as gemini")
        self.assertEqual(res["source"], "rules")
        self.assertTrue(res["needsReview"], "Must set needsReview: True on fallback")
        self.assertIn("Roads", res["category"])

    def test_invalid_or_corrupt_image(self):
        """Test corrupt/empty image handling."""
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
            f.write(b"NOT_AN_IMAGE_RANDOM_CORRUPT_BYTES")
            corrupt_path = f.name

        try:
            res = classify_complaint(
                image_path=corrupt_path,
                description="Street light flickering on main avenue",
                request_id="test_corrupt_img"
            )
            # Gemini or fallback handles it gracefully
            self.assertIn(res["category"], SUPPORTED_CIVIC_CATEGORIES)
            self.assertIn("predictionSource", res)
        finally:
            if os.path.exists(corrupt_path):
                os.remove(corrupt_path)

    def test_text_only_request(self):
        """Test pure text complaint analysis."""
        res = classify_complaint(
            image_path=None,
            description="Sewage water overflowing into residential driveway from choked drain",
            request_id="test_text_only"
        )
        self.assertIn(res["category"], SUPPORTED_CIVIC_CATEGORIES)
        self.assertEqual(res["category"], "Drainage")
        self.assertIn("department", res)

    def test_strict_category_enforcement(self):
        """Ensure all returned categories are strictly one of the 6 supported civic categories."""
        sample_img = os.path.join(os.path.dirname(__file__), 'data', 'Drainage', 'drainage_001.jpg')
        res = classify_complaint(
            image_path=sample_img,
            description="Sewage overflow from open gutter",
            request_id="test_enforcement"
        )
        self.assertIn(res["category"], SUPPORTED_CIVIC_CATEGORIES)
        self.assertIn("Drainage", res["category"])
        self.assertIn("needsReview", res)
        self.assertIn("description", res)

if __name__ == '__main__':
    unittest.main()
