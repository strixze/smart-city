"""
Smart City Civic AI Utilities
Helper functions for robust image processing, EXIF orientation normalization,
sensory feature extraction, text cleaning, emergency hazard detection, and base64 handling.
"""

import os
import re
import base64
import subprocess
from typing import Tuple, List, Optional, Dict, Any
from schemas import ImageFeatures, EMERGENCY_KEYWORDS

try:
    from PIL import Image, ImageStat, ImageOps
    import numpy as np
    from scipy import ndimage
    CV_AVAILABLE = True
except ImportError:
    CV_AVAILABLE = False


def get_git_commit_id() -> str:
    """
    Retrieves the current git commit or build identifier.
    Supports Render deployment environment variables as well as local git repository.
    """
    for env_var in ["RENDER_GIT_COMMIT", "GIT_COMMIT", "COMMIT_SHA", "RENDER_BUILD_ID"]:
        val = os.environ.get(env_var)
        if val:
            return val[:8]
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
            timeout=2
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
    except Exception:
        pass
    return "dev-local"


def clean_text(text: Optional[str]) -> str:
    """
    Normalizes input text: strips leading/trailing spaces, lowercases,
    and condenses multiple spaces into a single space.
    """
    if not text:
        return ""
    text = text.strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def detect_hazard_keywords(text: str) -> Tuple[bool, str, List[str]]:
    """
    Detects public safety emergency/hazard terms in text.
    Returns:
        (is_hazard: bool, recommended_priority: str, matched_terms: List[str])
    """
    matched = []
    text_lower = text.lower()

    for term in EMERGENCY_KEYWORDS:
        pattern = r"\b" + re.escape(term) + r"\b"
        if re.search(pattern, text_lower):
            matched.append(term)

    if not matched:
        return False, "MEDIUM", []

    # Highest hazard checks
    critical_triggers = [
        "accident", "open manhole", "live wire", "electric shock",
        "sparking", "pipeline burst", "burst", "flood", "collapse",
        "explosion", "fire", "death hazard", "fatal", "electrocution"
    ]
    if any(item in matched for item in critical_triggers):
        return True, "CRITICAL", matched

    return True, "HIGH", matched


def normalize_image_orientation(img: "Image.Image") -> "Image.Image":
    """
    Normalizes image orientation using EXIF metadata.
    Handles images with or without EXIF, safely stripping rotation tags.
    """
    try:
        return ImageOps.exif_transpose(img)
    except Exception:
        return img


def safe_load_image(image_path: Optional[str]) -> Tuple[Optional["Image.Image"], Optional[str], Tuple[int, int], Optional[str]]:
    """
    Safely opens and validates an image from disk.
    Applies EXIF normalization, verifies dimensions, and handles corrupted/invalid images.
    Returns:
        (image_rgb, error_message, (width, height), format)
    """
    if not image_path or not os.path.exists(image_path):
        return None, "Image file not found on disk", (0, 0), None

    if os.path.getsize(image_path) == 0:
        return None, "Image file is empty (0 bytes)", (0, 0), None

    if not CV_AVAILABLE:
        return None, "Pillow/NumPy not available in environment", (0, 0), None

    try:
        with Image.open(image_path) as raw_img:
            img_format = raw_img.format or "UNKNOWN"
            # Normalize EXIF orientation
            normalized = normalize_image_orientation(raw_img)
            # Ensure in-memory copy before closing file context
            rgb_img = normalized.convert("RGB")
            width, height = rgb_img.size

            rgb_img.format = img_format
            if width < 10 or height < 10:
                return rgb_img, f"Image dimensions too small ({width}x{height})", (width, height), img_format

            return rgb_img, None, (width, height), img_format

    except (Image.DecompressionBombError, Image.UnidentifiedImageError) as e:
        return None, f"Invalid or corrupted image format: {str(e)[:120]}", (0, 0), None
    except Exception as e:
        return None, f"Failed to decode image: {str(e)[:120]}", (0, 0), None


def extract_image_features(image_path: Optional[str], preloaded_img: Optional["Image.Image"] = None) -> ImageFeatures:
    """
    Extracts computer vision and statistical color/brightness/texture features from an image.
    Works entirely locally on CPU with zero paid APIs.
    """
    features = ImageFeatures(valid=False)

    if not CV_AVAILABLE:
        return features

    img = preloaded_img
    img_format = None
    if img is None:
        if not image_path or not os.path.exists(image_path):
            return features
        loaded_img, err, (w, h), fmt = safe_load_image(image_path)
        if err and loaded_img is None:
            return features
        img = loaded_img
        img_format = fmt

    try:
        features.valid = True
        width, height = img.size
        features.width = width
        features.height = height
        features.format = img_format or getattr(img, "format", "RGB")
        features.aspect_ratio = round(width / max(height, 1), 2)

        # Flag tiny images
        if width < 20 or height < 20:
            features.is_tiny = True

        # Standardized 128x128 resolution for consistent metric extraction
        thumb = img.resize((128, 128), Image.Resampling.BILINEAR)
        arr = np.array(thumb, dtype=np.float32)
        gray = np.array(thumb.convert("L"), dtype=np.float32)
        hsv = np.array(thumb.convert("HSV"), dtype=np.float32)

        b_mean = float(np.mean(gray))
        b_std = float(np.std(gray))
        features.brightness = round(b_mean, 2)
        features.brightness_std = round(b_std, 2)
        features.contrast = round(b_std, 2)

        top_b = float(np.mean(gray[:64, :]))
        bot_b = float(np.mean(gray[64:, :]))

        p10 = float(np.percentile(gray, 10))
        p90 = float(np.percentile(gray, 90))
        p99 = float(np.percentile(gray, 99))
        dyn_range = p99 - p10
        hotspot_ratio = p99 / max(p10, 1.0)

        features.p10 = round(p10, 2)
        features.p99 = round(p99, 2)
        features.dynamic_range = round(dyn_range, 2)
        features.hotspot_ratio = round(hotspot_ratio, 2)

        # Laplacian edge variance (sharpness and visual clutter)
        lap = ndimage.laplace(gray)
        sharp = float(np.var(lap))
        features.sharpness = round(sharp, 2)

        # Color channels and divergence
        sat_mean = float(np.mean(hsv[:, :, 1]))
        features.saturation_mean = round(sat_mean, 2)

        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        avg_r = float(np.mean(r))
        avg_g = float(np.mean(g))
        avg_b = float(np.mean(b))
        grey_diff = float(np.mean(np.abs(r - g) + np.abs(g - b) + np.abs(r - b)))
        features.color_divergence = round(grey_diff, 2)

        # Blurry / Flat detection
        if b_std < 1.0:
            features.is_flat = True
        if sharp < 8.0 and not (b_mean < 75 and dyn_range < 35):
            features.is_blurry = True

        # 1. Dark night scene
        if b_mean < 60:
            features.is_dark = True

        # 2. Localized light source (Street Light / Luminaire)
        # Low background brightness + sharp localized high-brightness point
        if (
            b_mean < 75 and dyn_range > 75 and p99 > 120 and
            hotspot_ratio > 2.5 and grey_diff < 65 and sat_mean < 135
        ):
            features.has_localized_light_source = True

        # 3. Drainage / Murky stagnant water / Sludge
        # Dark, low dynamic range, low sharpness, damp mud tones, lacking luminaires
        if (
            b_mean < 75 and dyn_range < 35 and not features.has_localized_light_source and
            (sat_mean > 35 or grey_diff > 20) and grey_diff < 55
        ):
            features.is_murky_liquid = True
            features.is_wet_blue = True

        # 4. Greyish asphalt / Road pavement surface
        # Achromatic, low saturation, low grey diff, moderate brightness
        if (
            grey_diff < 22 and sat_mean < 32 and
            20 <= b_mean <= 125 and dyn_range < 40 and not features.is_murky_liquid
        ):
            features.is_asphalt = True
            features.is_greyish = True

        # 5. Waste Management / High clutter & variegated debris
        if sharp > 1200 or (sharp > 400 and grey_diff > 35 and dyn_range > 45 and not features.has_localized_light_source):
            features.is_high_clutter = True

        # 6. Water Supply / High-saturation pipes, clean flow, bright plumbing fixtures
        if (sat_mean > 130 and grey_diff > 140) or (sat_mean > 110 and grey_diff > 100 and sharp > 120 and not features.has_localized_light_source):
            features.is_water_pipe = True
            features.is_wet_blue = True

        # 7. Greenery / Foliage
        if avg_g > avg_r + 14 and avg_g > avg_b + 14:
            features.is_greenish = True

    except Exception as e:
        print(f"[SmartCity AI Utils] Feature extraction error: {e}")
        features.valid = False

    return features


def encode_image_to_base64(image_path: str) -> Optional[str]:
    """Reads an image file and converts it into a base64 encoded string."""
    if not image_path or not os.path.exists(image_path):
        return None
    try:
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        print(f"[SmartCity AI Utils] Base64 encoding error: {e}")
        return None


def cleanup_temp_file(file_path: Optional[str]) -> None:
    """Safely removes a temporary file from disk."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
