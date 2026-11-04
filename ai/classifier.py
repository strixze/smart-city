"""
Smart City Civic AI Classifier
Core classification engine integrating fine-tuned PyTorch MobileNetV3 Small computer vision,
safety hazard detection, natural language processing, and optional Gemini LLM intelligence.
"""

import os
import re
import json
import time
from typing import Optional, Dict, Any, List, Tuple

from schemas import (
    CIVIC_TAXONOMY,
    SUPPORTED_CIVIC_CATEGORIES,
    PRIORITY_CRITICAL,
    PRIORITY_HIGH,
    PRIORITY_MEDIUM,
    PRIORITY_LOW,
    ClassificationResult,
    get_department_for_category,
    validate_category,
    validate_subcategory
)
from utils import (
    clean_text,
    detect_hazard_keywords,
    extract_image_features,
    safe_load_image,
    get_git_commit_id,
    encode_image_to_base64,
    get_accessible_path
)
from prompt import build_civic_analysis_prompt

# Optional PyTorch & Torchvision imports for fine-tuned MobileNetV3
try:
    import torch
    import torch.nn as nn
    from torchvision import transforms
    from torchvision.transforms import InterpolationMode
    from PIL import Image
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Try importing google-genai for optional LLM reasoning if configured
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


def verify_model_architecture(model: Any, expected_classes: int = 6, image_size: int = 224, device: str = "cpu") -> bool:
    """
    Validates model forward pass and verifies output classes match expectations.
    Returns True if valid, False if dimensions mismatch or forward pass fails.
    """
    if not TORCH_AVAILABLE or model is None:
        return False
    try:
        dummy_input = torch.zeros(1, 3, image_size, image_size, device=device)
        with torch.no_grad():
            dummy_output = model(dummy_input)
        return dummy_output.shape == (1, expected_classes)
    except Exception as e:
        print(f"[Model Verification Failure] {e}")
        return False


def resolve_active_models_dir() -> str:
    """
    Resolves the directory containing the active MobileNetV3 model checkpoint and configuration.
    Priority:
    1. MOBILENET_MODEL_DIR environment variable if specified and directory exists.
    2. ai/models_drainage_v3/ if best_model.pth and model_config.json exist.
    3. ai/models_streetlight_roads_waste_v3/ if best_model.pth and model_config.json exist.
    4. ai/models_roads_waste_v2/ as fallback.
    5. ai/models_real_data_experiment/ as fallback.
    6. ai/models/ as production fallback.
    """
    env_dir = os.environ.get("MOBILENET_MODEL_DIR")
    if env_dir and os.path.isdir(env_dir):
        return env_dir

    ws_v5_dir = os.path.join(os.path.dirname(__file__), "models_water_supply_v5")
    if (os.path.exists(os.path.join(ws_v5_dir, "best_model.pth")) and
            os.path.exists(os.path.join(ws_v5_dir, "model_config.json"))):
        return ws_v5_dir

    ws_v4_dir = os.path.join(os.path.dirname(__file__), "models_water_supply_v4")
    if (os.path.exists(os.path.join(ws_v4_dir, "best_model.pth")) and
            os.path.exists(os.path.join(ws_v4_dir, "model_config.json"))):
        return ws_v4_dir

    drainage_v3_dir = os.path.join(os.path.dirname(__file__), "models_drainage_v3")
    if (os.path.exists(os.path.join(drainage_v3_dir, "best_model.pth")) and
            os.path.exists(os.path.join(drainage_v3_dir, "model_config.json"))):
        return drainage_v3_dir

    v3_dir = os.path.join(os.path.dirname(__file__), "models_streetlight_roads_waste_v3")
    if (os.path.exists(os.path.join(v3_dir, "best_model.pth")) and
            os.path.exists(os.path.join(v3_dir, "model_config.json"))):
        return v3_dir

    v2_dir = os.path.join(os.path.dirname(__file__), "models_roads_waste_v2")
    if (os.path.exists(os.path.join(v2_dir, "best_model.pth")) and
            os.path.exists(os.path.join(v2_dir, "model_config.json"))):
        return v2_dir

    exp_dir = os.path.join(os.path.dirname(__file__), "models_real_data_experiment")
    if (os.path.exists(os.path.join(exp_dir, "best_model.pth")) and
            os.path.exists(os.path.join(exp_dir, "model_config.json"))):
        return exp_dir

    return os.path.join(os.path.dirname(__file__), "models")



class MobileNetV3ModelLoader:
    """
    Singleton loader for the fine-tuned MobileNetV3 Small civic classification model.
    Loads weights once at service startup and performs thread-safe, fast CPU inference.
    """

    def __init__(self, models_dir: Optional[str] = None):
        self.models_dir = models_dir or resolve_active_models_dir()
        self.weights_path = os.path.join(self.models_dir, "best_model.pth")
        self.config_path = os.path.join(self.models_dir, "model_config.json")
        self.is_loaded = False
        self.model = None
        self.config: Dict[str, Any] = {}
        self.classes: List[str] = []
        self.real_data_classes: List[str] = []
        self.num_classes: int = 0
        self.load_error: Optional[str] = None
        self.load_time_ms: float = 0.0
        self.device = torch.device("cpu") if TORCH_AVAILABLE else None
        self.transform = None
        self.softmax = None
        self.model_name = "MobileNetV3-Small"
        self.version = "1.0.0"

        self._load()

    def _load(self) -> None:
        if not TORCH_AVAILABLE:
            self.load_error = "PyTorch or Torchvision is not installed in the Python environment."
            print(f"[MobileNetV3 Loader Warning] {self.load_error}")
            return

        if not os.path.exists(self.weights_path):
            self.load_error = f"Model weights not found at: {self.weights_path}"
            print(f"[MobileNetV3 Loader Info] {self.load_error}")
            return

        if not os.path.exists(self.config_path):
            self.load_error = f"Model configuration not found at: {self.config_path}"
            print(f"[MobileNetV3 Loader Info] {self.load_error}")
            return

        t0 = time.perf_counter()
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)

            self.classes = self.config.get("classes", [])
            self.real_data_classes = self.config.get("real_data_classes", ["Waste Management"])
            self.model_name = self.config.get("model_name", "MobileNetV3-Small-Civic")
            self.version = self.config.get("version", "1.1.0-experiment")
            self.num_classes = len(self.classes)
            image_size = self.config.get("image_size", 224)
            mean = self.config.get("input_mean", [0.485, 0.456, 0.406])
            std = self.config.get("input_std", [0.229, 0.224, 0.225])

            print("[MODEL] Loading MobileNetV3-Small")
            print(f"[MODEL] Model version: {self.version}")
            print(f"[MODEL] Checkpoint path: {self.weights_path}")

            # Build MobileNetV3 Small architecture
            from torchvision.models import mobilenet_v3_small
            model = mobilenet_v3_small(weights=None)
            in_features = model.classifier[3].in_features
            model.classifier[2] = nn.Dropout(p=0.2, inplace=True)
            model.classifier[3] = nn.Linear(in_features=in_features, out_features=self.num_classes)

            # Load trained weights state_dict
            state_dict = torch.load(self.weights_path, map_location=self.device)
            model.load_state_dict(state_dict)
            model.eval()

            # Architecture verification: ensure forward pass works and matches class dimensions
            dummy_input = torch.zeros(1, 3, image_size, image_size, device=self.device)
            with torch.no_grad():
                dummy_output = model(dummy_input)
            if dummy_output.shape != (1, self.num_classes):
                raise ValueError(
                    f"Model output dimension mismatch: expected (1, {self.num_classes}), got {dummy_output.shape}"
                )

            self.model = model.to(self.device)

            self.transform = transforms.Compose([
                transforms.Resize((256, 256), interpolation=InterpolationMode.BILINEAR),
                transforms.CenterCrop(image_size),
                transforms.ToTensor(),
                transforms.Normalize(mean=mean, std=std),
            ])
            self.softmax = nn.Softmax(dim=1)
            self.is_loaded = True
            self.load_error = None
            self.load_time_ms = round((time.perf_counter() - t0) * 1000, 2)
            print("[MODEL] Checkpoint loaded successfully")
            print(f"[MODEL] Device: {str(self.device).upper() if self.device else 'CPU'}")
            print(f"[MODEL] Classes: {', '.join(self.classes)}")
            print(f"[MobileNetV3 Loader] Successfully loaded active checkpoint: '{self.weights_path}' "
                  f"(version: '{self.version}', name: '{self.model_name}') with {self.num_classes} classes in {self.load_time_ms} ms on {self.device}. "
                  f"Real-data verified classes: {self.real_data_classes}.")

        except Exception as e:
            self.is_loaded = False
            self.model = None
            self.load_error = f"Error during model loading or verification: {str(e)}"
            print(f"[MobileNetV3 Loader Error] {self.load_error}")

    def reload(self, new_models_dir: Optional[str] = None) -> Dict[str, Any]:
        """Reloads configuration and checkpoint weights from disk."""
        if new_models_dir:
            self.models_dir = new_models_dir
            self.weights_path = os.path.join(self.models_dir, "best_model.pth")
            self.config_path = os.path.join(self.models_dir, "model_config.json")
        self._load()
        return self.get_status()

    @torch.inference_mode()
    def predict(self, image_path: str, top_k: int = 3) -> Tuple[Optional[str], float, List[Dict[str, Any]], float]:
        """
        Runs CPU inference on an input image.
        Returns:
            (predicted_category, confidence, top_predictions, latency_ms)
        """
        if not self.is_loaded or self.model is None:
            raise RuntimeError(f"MobileNetV3 model is not loaded: {self.load_error}")

        image_path = get_accessible_path(image_path)
        if not image_path or not os.path.exists(image_path) or os.path.getsize(image_path) == 0:
            raise ValueError(f"Invalid or empty image file: {image_path}")

        t0 = time.perf_counter()
        from PIL import ImageOps
        with Image.open(image_path) as img:
            trans = ImageOps.exif_transpose(img)
            img_rgb = (trans if trans is not None else img).convert("RGB")
            tensor = self.transform(img_rgb).unsqueeze(0).to(self.device)

        with torch.inference_mode():
            logits = self.model(tensor)
            probs = self.softmax(logits)[0]

            k = min(top_k, self.num_classes)
            top_probs, top_indices = torch.topk(probs, k=k)

        top_preds = []
        for p, idx in zip(top_probs.cpu().numpy(), top_indices.cpu().numpy()):
            top_preds.append({
                "category": self.classes[idx],
                "confidence": round(float(p), 4)
            })

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        best_cat = top_preds[0]["category"]
        best_conf = top_preds[0]["confidence"]

        return best_cat, best_conf, top_preds, latency_ms

    def get_status(self) -> Dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model_name": self.model_name if self.is_loaded else None,
            "architecture": "mobilenet_v3_small",
            "version": self.version if self.is_loaded else None,
            "weights_path": self.weights_path,
            "models_dir": self.models_dir,
            "device": str(self.device) if self.device else None,
            "classes": self.classes,
            "real_data_classes": self.real_data_classes,
            "is_single_class_real_trained": len(self.real_data_classes) == 1,
            "num_classes": self.num_classes,
            "load_time_ms": self.load_time_ms,
            "error": self.load_error,
            "verified": self.is_loaded and (self.model is not None)
        }


# Initialize model loader once during module import
MOBILENET_LOADER = MobileNetV3ModelLoader()


def get_model_status() -> Dict[str, Any]:
    """Exposes current model loading status and diagnostics for the health check."""
    return MOBILENET_LOADER.get_status()


def reload_model(new_models_dir: Optional[str] = None) -> Dict[str, Any]:
    """Reloads the model weights and config from disk."""
    return MOBILENET_LOADER.reload(new_models_dir)


def normalize_category_name(raw_cat: str) -> str:
    """Maps raw or variant category strings to one of the 6 supported civic categories."""
    if not raw_cat:
        return "Other"
    clean = raw_cat.strip()
    if clean in SUPPORTED_CIVIC_CATEGORIES:
        return clean

    low = clean.lower()
    if any(k in low for k in ["drain", "sewer", "sewage", "gutter", "waterlogging", "stormwater", "गटार", "नाले", "सांडपाणी", "ड्रेनेज"]):
        return "Drainage"
    if any(k in low for k in ["road", "pothole", "asphalt", "footpath", "sidewalk", "pavement", "crater", "खड्डा", "खड्डे", "रस्ता", "रस्त्यावर", "फुटपाथ"]):
        return "Roads"
    if any(k in low for k in ["street light", "streetlight", "lamp post", "street lamp", "luminaire", "lighting", "पथदिवा", "पथदिवे", "लाईट", "लाइट", "खांब"]):
        return "Street Light"
    if any(k in low for k in ["waste", "garbage", "trash", "dustbin", "litter", "rubbish", "dump", "debris", "sanitation", "कचरा", "कचऱ्याचा", "कचराकुंडी"]):
        return "Waste Management"
    if any(k in low for k in ["water supply", "drinking water", "pipeline", "pipe leak", "water pipe", "burst pipe", "पाणीपुरवठा", "पाणी", "पाईप", "गळती"]):
        return "Water Supply"
    if "infrastructure" in low:
        return "Street Light"
    return "Other"


def _build_explicit_fallback(
    description: str = "",
    request_id: Optional[str] = None,
    error_msg: str = "",
    latency_ms: float = 0.0
) -> Dict[str, Any]:
    """
    Constructs an explicit fallback classification result when Gemini Vision fails.
    Never disguises a fallback as a Gemini prediction.
    """
    text_res = classify_text_heuristic(
        description=description,
        request_id=request_id,
        fallback_reason=f"Gemini Vision classification failed ({error_msg}); rule-based fallback applied"
    )
    text_res["source"] = "rules"
    text_res["predictionSource"] = "rules"
    text_res["isFallback"] = True
    text_res["fallbackUsed"] = True
    text_res["fallbackReason"] = error_msg
    text_res["needsReview"] = True
    text_res["model"] = "CivicClassifier-Fallback"
    text_res["modelVersion"] = None
    text_res["latency_ms"] = latency_ms
    return text_res


def classify_with_gemini(
    image_path: Optional[str] = None,
    description: str = "",
    api_key: Optional[str] = None,
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Primary civic complaint classification engine using Gemini Vision AI.
    Sends uploaded image bytes and structured prompt instructions to Gemini.
    Returns structured JSON with category, subcategory, department, priority,
    description, reason, and needsReview.
    Explicitly handles errors and returns an explicit fallback without masking failures.
    """
    t0 = time.perf_counter()
    key = api_key or os.environ.get("GEMINI_API_KEY")

    if not key:
        err_msg = "GEMINI_API_KEY environment variable is not configured."
        print(f"[SmartCity Classifier Error] {err_msg}")
        return _build_explicit_fallback(
            description=description,
            request_id=request_id,
            error_msg=err_msg,
            latency_ms=round((time.perf_counter() - t0) * 1000, 2)
        )

    if not GENAI_AVAILABLE:
        err_msg = "google-genai package is not installed in the Python environment."
        print(f"[SmartCity Classifier Error] {err_msg}")
        return _build_explicit_fallback(
            description=description,
            request_id=request_id,
            error_msg=err_msg,
            latency_ms=round((time.perf_counter() - t0) * 1000, 2)
        )

    if image_path:
        image_path = get_accessible_path(image_path)
    has_image = bool(image_path and os.path.exists(image_path) and os.path.getsize(image_path) > 0)
    prompt_text = build_civic_analysis_prompt(description=description, has_image=has_image)
    contents = [prompt_text]

    if has_image:
        try:
            with open(image_path, "rb") as f:
                img_bytes = f.read()

            ext = os.path.splitext(image_path)[1].lower()
            mime_map = {
                ".png": "image/png",
                ".webp": "image/webp",
                ".bmp": "image/bmp",
                ".gif": "image/gif",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg"
            }
            mime = mime_map.get(ext, "image/jpeg")

            contents.append(
                genai.types.Part.from_bytes(data=img_bytes, mime_type=mime)
            )
        except Exception as img_err:
            err_msg = f"Failed to read image bytes: {img_err}"
            print(f"[SmartCity Classifier Error] {err_msg}")
            return _build_explicit_fallback(
                description=description,
                request_id=request_id,
                error_msg=err_msg,
                latency_ms=round((time.perf_counter() - t0) * 1000, 2)
            )

    candidate_models = [
        os.environ.get("GEMINI_MODEL"),
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-flash-latest"
    ]
    candidate_models = [m for m in candidate_models if m]

    client = genai.Client(api_key=key, http_options={"timeout": 15000})
    response = None
    model_used = None
    last_error = None

    for model_name in candidate_models:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config={"response_mime_type": "application/json"}
            )
            if response and response.text:
                model_used = model_name
                break
        except Exception as api_err:
            last_error = api_err
            print(f"[SmartCity Classifier] Model '{model_name}' failed: {api_err}")
            continue

    if not response or not response.text:
        err_msg = f"Gemini API returned no content or failed across candidate models: {last_error}"
        print(f"[SmartCity Classifier Error] {err_msg}")
        return _build_explicit_fallback(
            description=description,
            request_id=request_id,
            error_msg=err_msg,
            latency_ms=round((time.perf_counter() - t0) * 1000, 2)
        )

    try:
        data = json.loads(response.text)
    except Exception as parse_err:
        err_msg = f"Failed to parse Gemini response as JSON: {parse_err}. Response snippet: {response.text[:200]}"
        print(f"[SmartCity Classifier Error] {err_msg}")
        return _build_explicit_fallback(
            description=description,
            request_id=request_id,
            error_msg=err_msg,
            latency_ms=round((time.perf_counter() - t0) * 1000, 2)
        )

    # 1. Validate & normalize category strictly against 6 supported civic categories
    raw_cat = str(data.get("category", "")).strip()
    cat = normalize_category_name(raw_cat)

    # 2. Validate subcategory
    raw_sub = str(data.get("subcategory", "")).strip()
    valid_subcats = CIVIC_TAXONOMY.get(cat, {}).get("subcategories", ["General Issue"])
    if raw_sub in valid_subcats:
        sub = raw_sub
    elif raw_sub:
        matched = next((s for s in valid_subcats if s.lower() == raw_sub.lower()), None)
        sub = matched if matched else raw_sub
    else:
        sub = valid_subcats[0]

    # 3. Validate priority
    raw_priority = str(data.get("priority", "")).strip().upper()
    if raw_priority in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]:
        priority = raw_priority
    else:
        priority = CIVIC_TAXONOMY.get(cat, {}).get("default_priority", "MEDIUM")

    # 4. Department
    dept = data.get("department") or get_department_for_category(cat)

    # 5. Needs review
    needs_review = bool(data.get("needsReview", False))
    if cat == "Other" and not needs_review:
        needs_review = True

    # 6. Confidence score
    try:
        conf = float(data.get("confidence", 0.95))
        conf = max(0.50, min(0.99, conf))
    except (ValueError, TypeError):
        conf = 0.92

    desc_text = data.get("description") or description or f"Reported {cat} civic grievance"
    reason = data.get("reason") or f"Identified as {cat} based on Gemini visual analysis"
    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "category": cat,
        "subcategory": sub,
        "predictedCategory": cat,
        "predictedSubcategory": sub,
        "priority": priority,
        "confidence": round(conf, 4),
        "description": desc_text,
        "reason": reason,
        "department": dept,
        "needsReview": needs_review,
        "model": "Gemini-Vision",
        "modelVersion": model_used,
        "isFallback": False,
        "fallbackUsed": False,
        "fallbackReason": None,
        "modelLoaded": True,
        "source": "gemini",
        "predictionSource": "gemini_vision",
        "requestId": request_id,
        "latency_ms": latency_ms
    }


def classify_heuristic_vision(
    image_path: Optional[str] = None,
    description: str = "",
    request_id: Optional[str] = None,
    include_diagnostics: bool = False,
    preloaded_img: Optional[Any] = None,
    fallback_reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Primary civic grievance classification engine.
    Applies calibrated computer vision heuristics, EXIF orientation normalization,
    and multimodal text correlation across the 6 master civic categories:
    1. Drainage
    2. Other
    3. Roads
    4. Street Light
    5. Waste Management
    6. Water Supply
    """
    t0 = time.perf_counter()
    commit_id = get_git_commit_id()
    text = clean_text(description)
    is_hazard, hazard_priority, matched_hazards = detect_hazard_keywords(text)

    # 1. Image loading and safety validation
    img = preloaded_img
    load_err = None
    img_dims = (0, 0)
    img_fmt = None
    if img is None and image_path:
        img, load_err, img_dims, img_fmt = safe_load_image(image_path)

    # Handle unreadable, corrupted, or missing image
    if img is None and load_err:
        if text:
            # Gracefully handle unreadable image with text keywords
            text_res = classify_text_heuristic(
                description=description,
                request_id=request_id,
                fallback_reason=f"Image decoding failed ({load_err}); text-only classification applied"
            )
            text_res["source"] = "heuristic_vision"
            text_res["predictionSource"] = "heuristic_vision"
            text_res["isFallback"] = True
            text_res["fallbackUsed"] = True
            text_res["fallbackReason"] = load_err
            return text_res

        cat_data = CIVIC_TAXONOMY["Other"]
        return ClassificationResult(
            category="Other",
            subcategory="General Issue",
            priority="MEDIUM",
            confidence=0.30,
            reason=f"Invalid or corrupted image: {load_err}. Flagged for manual inspection.",
            department=cat_data["department"],
            model="SmartCity-HeuristicVision-v1.0",
            source="heuristic_vision",
            predictionSource="heuristic_vision",
            isFallback=True,
            fallbackUsed=True,
            fallbackReason=load_err,
            requestId=request_id,
            is_uncertain=True,
            commit_id=commit_id,
        ).to_dict()

    # 2. Extract visual features
    features = extract_image_features(image_path=image_path, preloaded_img=img)
    if img_dims == (0, 0) and features.valid:
        img_dims = (features.width, features.height)
        img_fmt = features.format

    # 3. Assess image quality and evidence sufficiency
    is_insufficient = False
    insufficient_reason = ""
    if features.is_tiny:
        is_insufficient = True
        insufficient_reason = f"Image resolution too small ({features.width}x{features.height})"
    elif features.is_flat:
        is_insufficient = True
        insufficient_reason = "Image is completely uniform/flat (solid color with zero visual contrast)"
    elif features.is_blurry and not features.is_murky_liquid:
        is_insufficient = True
        insufficient_reason = "Image is severely blurry/out of focus"

    # Master taxonomy classes
    target_classes = ["Drainage", "Other", "Roads", "Street Light", "Waste Management", "Water Supply"]
    visual_scores: Dict[str, float] = {c: 0.0 for c in target_classes}
    text_scores: Dict[str, float] = {c: 0.0 for c in target_classes}
    visual_clues: List[str] = []
    text_clues: List[str] = []

    # 4. Heuristic visual evidence rules
    if features.valid and not is_insufficient:
        # A. Street Light
        # CRITICAL: Do NOT classify as Street Light merely because the photo is dark!
        # Requires localized point luminaire / high-contrast artificial lighting against night background
        if features.has_localized_light_source:
            visual_scores["Street Light"] += 5.0
            visual_clues.append("SL_LUMINAIRE_POINT_SOURCE")
            if features.sharpness > 200.0:
                visual_scores["Street Light"] += 2.0
                visual_clues.append("SL_NIGHT_HIGH_CONTRAST")

        # B. Drainage
        # Dark murky liquid / stagnant water / sewage sludge with low dynamic range
        # CRITICAL: Blue color cast alone does NOT trigger Drainage
        if features.is_murky_liquid:
            visual_scores["Drainage"] += 5.0
            visual_clues.append("DRAIN_MURKY_WATER")
            if features.sharpness < 70.0:
                visual_scores["Drainage"] += 2.0
                visual_clues.append("DRAIN_LOW_TEXTURE_STAGNANT")

        # C. Roads
        # Achromatic asphalt / pavement tones, clustered RGB, low saturation
        if features.is_asphalt:
            visual_scores["Roads"] += 5.0
            visual_clues.append("ROAD_ASPHALT_SURFACE")
            if features.color_divergence < 12.0 and features.saturation_mean < 15.0:
                visual_scores["Roads"] += 2.0
                visual_clues.append("ROAD_ACHROMATIC_NEUTRAL")

        # D. Waste Management
        # High visual clutter, packaging fragments, variegated textures
        if features.sharpness > 1200.0:
            visual_scores["Waste Management"] += 5.0
            visual_clues.append("WASTE_HIGH_CLUTTER")
        elif features.is_high_clutter:
            visual_scores["Waste Management"] += 3.5
            visual_clues.append("WASTE_VARIEGATED_TEXTURE")
        elif (
            55.0 <= features.brightness <= 175.0 and
            15.0 <= features.color_divergence <= 100.0 and
            features.sharpness > 25.0 and
            not features.is_asphalt and
            not features.is_murky_liquid and
            not features.has_localized_light_source and
            features.saturation_mean < 130.0
        ):
            visual_scores["Waste Management"] += 2.5
            visual_clues.append("WASTE_SURFACE_DEBRIS")

        # E. Water Supply
        # High saturation pipes, metal/PVC plumbing coloration, clean pressurized water
        # CRITICAL: Blue color cast alone does NOT trigger Water Supply
        if features.is_water_pipe:
            visual_scores["Water Supply"] += 5.5
            visual_clues.append("WATER_PIPE_COLORATION")
        elif (
            features.saturation_mean > 110.0 and
            features.color_divergence > 100.0 and
            features.sharpness > 120.0 and
            not features.has_localized_light_source
        ):
            visual_scores["Water Supply"] += 3.5
            visual_clues.append("WATER_FLOW_INFRASTRUCTURE")

        # F. Other
        if (
            80.0 <= features.brightness <= 165.0 and
            features.saturation_mean < 50.0 and
            features.sharpness < 65.0 and
            features.color_divergence < 42.0 and
            features.dynamic_range < 75.0 and
            not features.is_asphalt and
            not features.is_murky_liquid and
            not features.has_localized_light_source
        ):
            visual_scores["Other"] += 3.0
            visual_clues.append("OTHER_GENERAL_SCENE")

    # 5. Multimodal text integration (when text is provided)
    if text:
        for cat in target_classes:
            cat_data = CIVIC_TAXONOMY.get(cat, {})
            for kw in cat_data.get("keywords", []):
                pattern = r"\b" + re.escape(kw) + r"\b"
                if re.search(pattern, text):
                    text_scores[cat] += 4.0
                    text_clues.append(f"KW:{cat}:{kw}")
                elif kw in text:
                    text_scores[cat] += 1.5
                    text_clues.append(f"SUBKW:{cat}:{kw}")

            for h_kw in cat_data.get("hazard_keywords", []):
                if h_kw in text:
                    text_scores[cat] += 3.5
                    text_clues.append(f"HAZARD:{cat}:{h_kw}")

    # Combine visual and text scores
    total_scores = {c: visual_scores[c] + text_scores[c] for c in target_classes}

    # 6. Tie Detection and Non-Dictionary Resolution
    is_uncertain = False
    is_tied = False
    tied_categories: List[str] = []
    winning_cat = "Other"

    sorted_scores = sorted(total_scores.items(), key=lambda kv: kv[1], reverse=True)
    highest_score = sorted_scores[0][1]

    if is_insufficient:
        if text and max(text_scores.values()) > 0:
            winning_cat = max(text_scores, key=lambda c: text_scores[c])
            confidence = 0.65
            reason = f"Image lacks evidence ({insufficient_reason}); categorized by complaint description: {winning_cat}."
        else:
            winning_cat = "Other"
            is_uncertain = True
            confidence = 0.35
            reason = f"Insufficient visual evidence ({insufficient_reason}) and no description text. Flagged for manual review."

    elif highest_score <= 0.0:
        winning_cat = "Other"
        is_uncertain = True
        confidence = 0.35
        reason = "Neither image nor description provided sufficient municipal grievance indicators. Flagged for manual review."

    else:
        # Check for ties or conflicting scores within a 0.25 margin
        top_candidates = [c for c, s in sorted_scores if s >= highest_score - 0.25 and s > 0]
        if len(top_candidates) > 1:
            is_tied = True
            tied_categories = sorted(top_candidates)
            # Try to resolve tie using text keywords if text uniquely favors one candidate
            text_favored = [
                c for c in top_candidates
                if text_scores[c] > 0 and text_scores[c] == max(text_scores[cand] for cand in top_candidates)
            ]
            if len(text_favored) == 1 and text_scores[text_favored[0]] > 0:
                winning_cat = text_favored[0]
                is_uncertain = False
                confidence = 0.72
                reason = (
                    f"Visual tie detected between {', '.join(tied_categories)} (score: {highest_score:.1f}). "
                    f"Resolved by complaint description text in favor of {winning_cat}."
                )
            else:
                # Never resolve ties solely through Python dictionary insertion order!
                # Report an honest, review-required uncertain result
                winning_cat = "Other"
                is_uncertain = True
                confidence = 0.38
                reason = (
                    f"Conflicting / tied evidence detected between categories {', '.join(tied_categories)} "
                    f"(score: {highest_score:.1f}). Flagged for manual review."
                )
        else:
            winning_cat = sorted_scores[0][0]
            has_visual = visual_scores[winning_cat] > 0
            has_text = text_scores[winning_cat] > 0
            if has_visual and has_text:
                confidence = round(min(0.86, 0.74 + (highest_score * 0.015)), 2)
            elif has_visual and not text:
                confidence = round(min(0.76, 0.64 + (visual_scores[winning_cat] * 0.02)), 2)
            elif has_visual:
                confidence = round(min(0.72, 0.60 + (visual_scores[winning_cat] * 0.02)), 2)
            else:
                confidence = 0.65

            clues_str = ", ".join(visual_clues) if visual_clues else "general visual pattern"
            reason = f"Classified by heuristic vision engine: {winning_cat}. Triggered visual clues: [{clues_str}]."
            if text_clues:
                reason += f" Corroborating text clues: [{', '.join(text_clues[:3])}]."

    # 7. Subcategory mapping
    cat_data = CIVIC_TAXONOMY.get(winning_cat, CIVIC_TAXONOMY["Other"])
    selected_sub = cat_data["subcategories"][0]
    if text:
        for sub in cat_data["subcategories"]:
            sub_tokens = [w.lower() for w in re.findall(r"\w+", sub)]
            if any(w in text for w in sub_tokens if len(w) > 3):
                selected_sub = sub
                break
    else:
        # Default subcategories based on visual clues when description is empty
        if winning_cat == "Street Light":
            selected_sub = "Street Light Not Working"
        elif winning_cat == "Roads":
            selected_sub = "Damaged Road"
        elif winning_cat == "Drainage":
            selected_sub = "Blocked Drain"
        elif winning_cat == "Waste Management":
            selected_sub = "Garbage Dump"
        elif winning_cat == "Water Supply":
            selected_sub = "Water Leakage"
        elif winning_cat == "Other":
            selected_sub = "General Issue"

    # Priority calculation
    priority = hazard_priority if is_hazard else cat_data["default_priority"]
    if is_hazard:
        reason += f" Escalated to {priority} due to critical hazard indicators: [{', '.join(matched_hazards)}]."

    # 8. Optional Diagnostic: MobileNetV3 (MUST NOT override heuristic result)
    diagnostics = None
    if include_diagnostics and MOBILENET_LOADER.is_loaded and image_path and os.path.exists(image_path):
        try:
            mb_cat, mb_conf, mb_top, mb_ms = MOBILENET_LOADER.predict(image_path, top_k=3)
            diagnostics = {
                "mobilenet": {
                    "category": mb_cat,
                    "confidence": mb_conf,
                    "top_predictions": mb_top,
                    "inference_time_ms": mb_ms,
                    "overrode_heuristic": False,
                }
            }
        except Exception as e:
            diagnostics = {
                "mobilenet": {
                    "error": str(e),
                    "overrode_heuristic": False,
                }
            }

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    result = ClassificationResult(
        category=winning_cat,
        subcategory=selected_sub,
        priority=priority,
        confidence=confidence,
        reason=reason,
        department=get_department_for_category(winning_cat),
        model="SmartCity-HeuristicVision-v1.0",
        source="heuristic_vision",
        predictionSource="heuristic_vision",
        predictedCategory=winning_cat,
        predictedSubcategory=selected_sub,
        modelLoaded=MOBILENET_LOADER.is_loaded,
        modelVersion=None,
        isFallback=bool(fallback_reason),
        fallbackUsed=bool(fallback_reason),
        fallbackReason=fallback_reason,
        requestId=request_id,
        features=features.to_dict() if features.valid else None,
        is_uncertain=is_uncertain,
        is_tied=is_tied,
        tied_categories=tied_categories,
        visual_clues=visual_clues,
        category_scores=total_scores,
        commit_id=commit_id,
        diagnostics=diagnostics,
    )

    res_dict = result.to_dict()
    res_dict["latency_ms"] = latency_ms
    return res_dict


def classify_text_heuristic(
    description: str = "",
    request_id: Optional[str] = None,
    fallback_reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    Keyword and regex heuristic classifier for text-only complaints (no image attached).
    """
    t0 = time.perf_counter()
    text = clean_text(description)
    is_hazard, hazard_priority, matched_hazards = detect_hazard_keywords(text)
    commit_id = get_git_commit_id()

    scores: Dict[str, float] = {cat: 0.0 for cat in CIVIC_TAXONOMY}
    matched_kws = []

    for cat, data in CIVIC_TAXONOMY.items():
        score = 0.0
        for kw in data.get("keywords", []):
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, text):
                score += 3.5
                matched_kws.append(f"{cat}:{kw}")
            elif kw in text:
                score += 1.5

        for h_kw in data.get("hazard_keywords", []):
            if h_kw in text:
                score += 3.0

        scores[cat] = score

    sorted_scores = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    best_cat = sorted_scores[0][0]
    highest_score = sorted_scores[0][1]

    is_tied = False
    is_uncertain = False
    tied_cats: List[str] = []

    if highest_score <= 0:
        best_cat = "Other"
        confidence = 0.35
        is_uncertain = True
        reason = fallback_reason or "Text-only heuristic: no specific municipal keywords matched. Flagged for review."
    else:
        top_cats = [c for c, s in sorted_scores if s >= highest_score - 0.25 and s > 0]
        if len(top_cats) > 1:
            is_tied = True
            is_uncertain = True
            tied_cats = sorted(top_cats)
            best_cat = "Other"
            confidence = 0.38
            reason = f"Text-only heuristic: tied keywords between {', '.join(tied_cats)}. Flagged for manual review."
        else:
            confidence = round(min(0.85, 0.65 + (highest_score * 0.02)), 2)
            reason = fallback_reason or f"Text-only heuristic classification: {best_cat}."

    cat_data = CIVIC_TAXONOMY.get(best_cat, CIVIC_TAXONOMY["Other"])
    selected_sub = cat_data["subcategories"][0]
    for sub in cat_data["subcategories"]:
        sub_tokens = [w.lower() for w in re.findall(r"\w+", sub)]
        if any(w in text for w in sub_tokens if len(w) > 3):
            selected_sub = sub
            break

    priority = hazard_priority if is_hazard else cat_data["default_priority"]
    if is_hazard:
        reason += f" Escalated to {priority} due to hazard indicators: [{', '.join(matched_hazards)}]."

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    result = ClassificationResult(
        category=best_cat,
        subcategory=selected_sub,
        priority=priority,
        confidence=confidence,
        reason=reason,
        department=get_department_for_category(best_cat),
        model="Heuristic-Keyword-Classifier",
        source="rules",
        predictionSource="rules",
        predictedCategory=best_cat,
        predictedSubcategory=selected_sub,
        modelLoaded=MOBILENET_LOADER.is_loaded,
        modelVersion=None,
        fallbackUsed=True,
        fallbackReason=fallback_reason or "Text-only heuristic (no image provided)",
        requestId=request_id,
        is_uncertain=is_uncertain,
        is_tied=is_tied,
        tied_categories=tied_cats,
        category_scores=scores,
        commit_id=commit_id,
    )

    res_dict = result.to_dict()
    res_dict["latency_ms"] = latency_ms
    return res_dict


def classify_local(
    image_path: Optional[str] = None,
    description: str = "",
    fallback_reason: str = "Automated rule-based heuristic classification",
    request_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Backwards-compatible wrapper: delegates to classify_heuristic_vision when an image
    is provided, or classify_text_heuristic for text-only complaints.
    """
    if image_path:
        image_path = get_accessible_path(image_path)
    has_image = bool(image_path and os.path.exists(image_path) and os.path.getsize(image_path) > 0)
    if has_image:
        return classify_heuristic_vision(
            image_path=image_path,
            description=description,
            request_id=request_id,
        )
    return classify_text_heuristic(
        description=description,
        request_id=request_id,
        fallback_reason=fallback_reason,
    )


MOBILENET_REAL_DATA_CONFIDENCE_THRESHOLD = 0.70


def check_prediction_reliability(
    mb_cat: str,
    mb_conf: float,
    image_path: str,
    description: str,
    real_classes: List[str]
) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a MobileNetV3 prediction is reliable and supported by verified training data.
    Enforces requirements:
    1. The predicted category must be in real_classes (classes with verified real training data).
    2. Confidence must meet empirical threshold (0.70).
    3. Category-specific sanity check:
       Inspects description keywords and visual features for conflicting civic indicators.
       If clear conflicting evidence exists, the prediction is flagged for review and routed to fallback.
    """
    if mb_cat not in real_classes:
        return False, (
            f"MobileNetV3 predicted '{mb_cat}' (confidence: {mb_conf:.3f}), but model checkpoint "
            f"was trained on real data only for {real_classes}. Predictions for other classes cannot be certified without real training data."
        )

    if mb_conf < MOBILENET_REAL_DATA_CONFIDENCE_THRESHOLD:
        return False, (
            f"MobileNetV3 predicted '{mb_cat}', but confidence ({mb_conf:.3f}) was below "
            f"the reliability threshold ({MOBILENET_REAL_DATA_CONFIDENCE_THRESHOLD:.2f}). Flagged for review."
        )

    # Sanity check against conflicting indicators
    text_clean = clean_text(description).lower()

    has_streetlight_kw = any(w in text_clean for w in ["street light", "streetlight", "lamp post", "street lamp", "lighting", "dark street", "flickering light", "broken pole", "light pole"])
    has_road_kw = any(w in text_clean for w in ["pothole", "potholes", "crater", "craters", "damaged road", "asphalt", "broken road", "footpath", "sidewalk", "speed breaker"])
    has_waste_kw = any(w in text_clean for w in ["garbage", "trash", "waste", "dustbin", "litter", "rubbish", "dump", "debris", "plastic"])
    has_drain_kw = any(w in text_clean for w in ["drain", "drainage", "sewer", "sewage", "gutter", "waterlogging", "storm drain", "manhole"])
    has_water_kw = any(w in text_clean for w in ["pipeline", "pipe leak", "water pipe", "burst pipe", "water supply", "drinking water", "no water", "water leakage"])

    feats = extract_image_features(image_path)
    conflicts = []

    # Check for direct contradictions in user description
    if mb_cat == "Roads":
        if has_waste_kw:
            conflicts.append("Waste Management")
        if has_streetlight_kw:
            conflicts.append("Street Light")
        if has_drain_kw:
            conflicts.append("Drainage")
        if has_water_kw:
            conflicts.append("Water Supply")
    elif mb_cat == "Waste Management":
        if has_road_kw:
            conflicts.append("Roads")
        if has_streetlight_kw:
            conflicts.append("Street Light")
        # Pure drainage issue without garbage is a contradiction
        if has_drain_kw and not has_waste_kw:
            conflicts.append("Drainage")
        if has_water_kw:
            conflicts.append("Water Supply")
    elif mb_cat == "Street Light":
        if has_road_kw:
            conflicts.append("Roads")
        if has_waste_kw:
            conflicts.append("Waste Management")
        if has_drain_kw:
            conflicts.append("Drainage")
        if has_water_kw:
            conflicts.append("Water Supply")
    elif mb_cat == "Drainage":
        if has_streetlight_kw:
            conflicts.append("Street Light")
        # Road keywords only conflict if no water/flooding/drain context is present
        if has_road_kw and not any(w in text_clean for w in ["waterlogged", "waterlogging", "flood", "flooding", "drain", "water", "sewer", "gutter"]):
            conflicts.append("Roads")
        # Confusing case: garbage blocking a drain versus ordinary garbage accumulation.
        # If garbage is reported with drainage/water/gutter/overflow context, it is genuine drainage blockage.
        if has_waste_kw and not any(w in text_clean for w in ["drain", "drainage", "sewer", "gutter", "clog", "choke", "overflow", "water", "stagnant"]):
            conflicts.append("Waste Management")
        if has_water_kw and not any(w in text_clean for w in ["drain", "drainage", "sewer", "gutter", "clog", "overflow", "dirty water", "foul water"]):
            conflicts.append("Water Supply")
    elif mb_cat == "Water Supply":
        if has_streetlight_kw:
            conflicts.append("Street Light")
        # Road/pothole keywords conflict unless pipe leakage/water leak context is present
        if has_road_kw and not any(w in text_clean for w in ["pipe", "pipeline", "leak", "leakage", "water", "burst"]):
            conflicts.append("Roads")
        # Pure garbage accumulation without plumbing/water
        if has_waste_kw and not any(w in text_clean for w in ["pipe", "pipeline", "tap", "leak", "water", "supply"]):
            conflicts.append("Waste Management")
        # Sewage/foul drainage without clean/drinking water pipe context
        if has_drain_kw and not any(w in text_clean for w in ["clean water", "drinking water", "pipe", "pipeline", "supply", "tap"]):
            conflicts.append("Drainage")

    # Visual conflict check: night street lighting with luminaire fixture when predicting non-streetlight
    if mb_cat != "Street Light" and (has_streetlight_kw and feats.has_localized_light_source) and "Street Light" not in conflicts:
        conflicts.append("Street Light")

    if conflicts:
        return False, (
            f"MobileNetV3 predicted '{mb_cat}' (confidence: {mb_conf:.3f}), but input evidence "
            f"indicates conflicting civic indicators ({', '.join(conflicts)}). "
            f"Flagged for review; falling back to heuristic vision."
        )

    return True, None


def classify_complaint(
    image_path: Optional[str] = None,
    description: str = "",
    use_llm: bool = False,
    request_id: Optional[str] = None,
    run_diagnostic: bool = False,
    force_heuristic: bool = False,
    use_gemini: bool = False
) -> Dict[str, Any]:
    """
    Main civic classification orchestrator:
    Priority 1 (PRIMARY): Fine-tuned MobileNetV3 Small computer vision model.
    - Evaluated first for every image-based civic complaint.
    - Employs a strict reliability policy: predictions are accepted ONLY when:
      1) The predicted category is backed by verified real training data (Drainage, Waste Management, Roads, Street Light).
      2) The prediction confidence meets or exceeds the empirical threshold (0.70).
      3) 'Do not treat softmax confidence alone as proof of correctness':
         Image and description are sanity checked for conflicting non-category evidence.
    - If MobileNetV3 cannot provide a reliable prediction (or is unavailable),
      the system explicitly routes to Heuristic Vision as the secondary engine.

    Priority 2 (FALLBACK): Calibrated Heuristic Computer Vision.
    - Analyzes visual cues (asphalt textures, garbage clusters, water/sky color ratios, etc.).
    - If heuristic vision is uncertain or tied, returns an honest review-required payload.

    Priority 3 (OPTIONAL / DIAGNOSTIC): Gemini Vision.
    - NEVER invoked by default. Only called if explicitly requested via use_gemini=True.
    """
    if image_path:
        image_path = get_accessible_path(image_path)

    # 0. Explicit Gemini override (only when explicitly requested)
    if use_gemini and os.environ.get("GEMINI_API_KEY") and GENAI_AVAILABLE:
        return classify_with_gemini(
            image_path=image_path,
            description=description,
            request_id=request_id
        )

    if image_path:
        image_path = get_accessible_path(image_path)
    has_image = bool(image_path and os.path.exists(image_path) and os.path.getsize(image_path) > 0)

    if has_image:
        mb_cat = None
        mb_conf = 0.0
        top_preds = []
        mb_lat = 0.0
        fallback_reason = None
        real_classes = getattr(MOBILENET_LOADER, "real_data_classes", ["Drainage", "Waste Management", "Roads", "Street Light", "Water Supply"]) or ["Drainage", "Waste Management", "Roads", "Street Light", "Water Supply"]

        # Step 1: Attempt Primary MobileNetV3 Model
        if not force_heuristic and MOBILENET_LOADER.is_loaded and MOBILENET_LOADER.model is not None:
            try:
                mb_cat, mb_conf, top_preds, mb_lat = MOBILENET_LOADER.predict(image_path, top_k=6)

                # Reliability Policy Evaluation
                is_reliable, reject_reason = check_prediction_reliability(
                    mb_cat=mb_cat,
                    mb_conf=mb_conf,
                    image_path=image_path,
                    description=description,
                    real_classes=real_classes
                )

                if is_reliable:
                    # ACCEPTED: Supported by real training data, meets confidence threshold, no conflicts
                    clean_desc = clean_text(description)
                    cat_data = CIVIC_TAXONOMY.get(mb_cat, CIVIC_TAXONOMY.get("Waste Management", {}))
                    is_hazard, hazard_priority, matched_hazards = detect_hazard_keywords(clean_desc)
                    default_sub = (
                        "Water Leakage" if mb_cat == "Water Supply" else (
                            "Blocked Drain" if mb_cat == "Drainage" else (
                                "Street Light Damaged" if mb_cat == "Street Light" else (
                                    "Pothole" if mb_cat == "Roads" else (
                                        "Garbage Dump" if mb_cat == "Waste Management" else "Other"
                                    )
                                )
                            )
                        )
                    )

                    subcategories = cat_data.get("subcategories", [default_sub])
                    selected_sub = default_sub
                    if clean_desc:
                        for sub in subcategories:
                            sub_tokens = [w.lower() for w in re.findall(r"\w+", sub)]
                            if any(w in clean_desc for w in sub_tokens if len(w) > 3):
                                selected_sub = sub
                                break
                    else:
                        selected_sub = subcategories[0] if subcategories else default_sub

                    priority = hazard_priority if is_hazard else cat_data.get("default_priority", PRIORITY_MEDIUM)
                    reason = (
                        f"Classified as {mb_cat} with high confidence ({mb_conf * 100:.1f}%) "
                        f"by fine-tuned MobileNetV3 Small (trained on verified real imagery)."
                    )
                    if is_hazard:
                        reason += f" Priority escalated to {priority} due to critical hazard indicators: [{', '.join(matched_hazards)}]."

                    diag_payload = None
                    if run_diagnostic:
                        diag_payload = {
                            "mobilenet": {
                                "category": mb_cat,
                                "confidence": round(mb_conf, 4),
                                "top_predictions": top_preds,
                                "inference_time_ms": mb_lat,
                                "trained_on_real_data": True,
                                "real_data_classes": real_classes,
                                "checkpoint_path": MOBILENET_LOADER.weights_path,
                                "checkpoint_version": MOBILENET_LOADER.version
                            }
                        }

                    res = ClassificationResult(
                        category=mb_cat,
                        subcategory=selected_sub,
                        priority=priority,
                        confidence=round(mb_conf, 4),
                        reason=reason,
                        department=get_department_for_category(mb_cat),
                        description=description or f"Reported {mb_cat} issue",
                        needsReview=False,
                        model=MOBILENET_LOADER.model_name,
                        modelVersion=MOBILENET_LOADER.version,
                        source="mobilenet",
                        predictionSource="mobilenet",
                        predictedCategory=mb_cat,
                        predictedSubcategory=selected_sub,
                        modelLoaded=True,
                        isFallback=False,
                        fallbackUsed=False,
                        fallbackReason=None,
                        requestId=request_id,
                        commit_id=get_git_commit_id(),
                        diagnostics=diag_payload
                    )
                    res_dict = res.to_dict()
                    res_dict["latency_ms"] = mb_lat
                    res_dict["topPredictions"] = top_preds
                    return res_dict

                else:
                    fallback_reason = reject_reason
            except Exception as exc:
                fallback_reason = f"MobileNetV3 inference exception: {str(exc)}."
        else:
            fallback_reason = (
                f"MobileNetV3 model is not loaded: {MOBILENET_LOADER.load_error or 'Weights missing or unverified'}."
            )

        # Step 2: Fallback to Heuristic Vision
        heuristic_res = classify_heuristic_vision(
            image_path=image_path,
            description=description,
            request_id=request_id,
            include_diagnostics=run_diagnostic,
            fallback_reason=fallback_reason
        )
        heuristic_res["primaryModelAttempted"] = "mobilenet_v3"
        heuristic_res["primaryModelDiagnostics"] = {
            "predictedCategory": mb_cat,
            "confidence": round(mb_conf, 4) if mb_conf else 0.0,
            "topPredictions": top_preds,
            "realDataClasses": real_classes,
            "reason": fallback_reason
        }
        return heuristic_res

    # Step 3: Pure text complaint (no image)
    return classify_text_heuristic(
        description=description,
        request_id=request_id,
        fallback_reason="Text-only complaint classification (no image attached)"
    )


