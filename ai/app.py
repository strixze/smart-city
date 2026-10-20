
"""
Smart City Civic AI Microservice (Flask Web API)

Features:
- Civic issue classification using MobileNetV3 and optional LLM integration
- Health checks and model status
- Civic category and subcategory validation
- Live terminal logging for requests, predictions, timing, and errors
- Safe temporary image cleanup
"""

import os
import tempfile
import base64
import logging
import time
import uuid

from flask import Flask, request, jsonify, g

# --------------------------------------------------
# Logging configuration
# --------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)

logger = logging.getLogger("smartcity-ai")

# --------------------------------------------------
# Load environment variables
# --------------------------------------------------

try:
    from dotenv import load_dotenv

    load_dotenv()

    root_env = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "server",
        ".env",
    )

    if os.path.exists(root_env):
        load_dotenv(root_env)

except ImportError:
    logger.info("python-dotenv not installed; using existing environment variables")

# --------------------------------------------------
# Application imports
# --------------------------------------------------

from schemas import (
    CIVIC_TAXONOMY,
    validate_category,
    validate_subcategory,
)

from classifier import classify_complaint, get_model_status, reload_model
from utils import cleanup_temp_file

# --------------------------------------------------
# Flask application
# --------------------------------------------------

app = Flask(__name__)

ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
}

# --------------------------------------------------
# Request logging
# --------------------------------------------------

@app.before_request
def log_request():
    g.request_start_time = time.perf_counter()

    logger.info(
        "REQUEST | %s %s",
        request.method,
        request.path,
    )


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = (
        "Content-Type,Authorization,X-Request-Id"
    )
    response.headers["Access-Control-Allow-Methods"] = (
        "GET,POST,OPTIONS"
    )

    start_time = getattr(g, "request_start_time", None)

    if start_time is not None:
        duration_ms = (
            time.perf_counter() - start_time
        ) * 1000

        logger.info(
            "RESPONSE | %s %s | Status: %s | Duration: %.2f ms",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
        )

    return response


# --------------------------------------------------
# Health endpoint
# --------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    """Return service, architecture, and model health verification."""

    gemini_key = os.environ.get("GEMINI_API_KEY")
    model_status = get_model_status()

    is_model_loaded = bool(model_status.get("loaded", False))
    is_model_verified = bool(model_status.get("verified", False))

    logger.info(
        "HEALTH CHECK | Model loaded: %s | Verified: %s | Model: %s | Device: %s",
        is_model_loaded,
        is_model_verified,
        model_status.get("model_name"),
        model_status.get("device"),
    )

    return jsonify({
        "status": "online",
        "service": "Smart City Civic AI Microservice",
        "version": "1.0.0",
        "port": int(os.environ.get("AI_PORT", 8000)),
        "modelLoaded": is_model_loaded,
        "modelVerified": is_model_verified,
        "modelName": model_status.get("model_name"),
        "modelArchitecture": model_status.get("architecture", "mobilenet_v3_small"),
        "modelVersion": model_status.get("version"),
        "modelDevice": model_status.get("device"),
        "modelClasses": model_status.get("classes", []),
        "modelNumClasses": model_status.get("num_classes", 0),
        "modelLoadTimeMs": model_status.get("load_time_ms", 0.0),
        "modelError": model_status.get("error"),
        "supportedCategories": list(CIVIC_TAXONOMY.keys()),
        "visionApiConfigured": bool(gemini_key),
        "geminiConfigured": bool(gemini_key),
        "fallbackClassificationEnabled": True,
        "capabilities": [
            "mobilenet_v3_small_transfer_learning",
            "multimodal-vision-inspection",
            "civic-taxonomy-classification",
            "emergency-hazard-escalation",
            "department-routing",
            "dual-engine-local-and-gemini",
        ],
    }), 200


@app.route("/reload-model", methods=["POST"])
def reload_model_weights():
    """Reloads model weights and configuration from disk without restarting service."""
    status = reload_model()
    logger.info(
        "MODEL RELOAD | Loaded: %s | Classes: %s | Error: %s",
        status.get("loaded"),
        status.get("classes"),
        status.get("error"),
    )
    return jsonify({
        "message": "Model reloaded",
        "status": status
    }), 200


# --------------------------------------------------
# Categories endpoint
# --------------------------------------------------

@app.route("/categories", methods=["GET"])
def get_categories():
    """Return civic categories, departments, and subcategories."""

    summary = {}

    for category, info in CIVIC_TAXONOMY.items():
        summary[category] = {
            "department": info.get("department", ""),
            "subcategories": info.get("subcategories", []),
            "defaultPriority": info.get(
                "default_priority",
                "MEDIUM",
            ),
        }

    logger.info(
        "CATEGORIES | Returned %d civic categories",
        len(summary),
    )

    return jsonify({
        "categories": summary,
        "total": len(summary),
    }), 200


# --------------------------------------------------
# Category validation endpoint
# --------------------------------------------------

@app.route("/validate", methods=["POST"])
def validate_issue():
    """Validate a civic category and its subcategory."""

    data = request.get_json(silent=True) or {}

    category = data.get("category", "")
    subcategory = data.get("subcategory", "")

    category_valid = validate_category(category)

    subcategory_valid = (
        validate_subcategory(category, subcategory)
        if category_valid
        else False
    )

    is_valid = category_valid and (
        subcategory_valid or not subcategory
    )

    logger.info(
        "VALIDATION | Category valid: %s | "
        "Subcategory valid: %s | Overall valid: %s",
        category_valid,
        subcategory_valid,
        is_valid,
    )

    return jsonify({
        "categoryValid": category_valid,
        "subcategoryValid": subcategory_valid,
        "isValid": is_valid,
    }), 200


# --------------------------------------------------
# Image analysis endpoint
# --------------------------------------------------

@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze a civic complaint.

    Supports:
    - multipart/form-data with an 'image' file
    - application/json with an 'image_base64' field
    - Description-only requests
    """

    description = ""
    temp_path = None
    request_id = (
        request.headers.get("X-Request-Id")
        or request.form.get("requestId")
        or f"req_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"
    )

    logger.info("ANALYSIS [%s] | Starting civic complaint analysis", request_id)

    try:
        # ------------------------------------------
        # Handle multipart/form-data
        # ------------------------------------------

        if (
            request.content_type
            and "multipart/form-data" in request.content_type
        ):
            description = request.form.get("description", "")

            if "image" in request.files:
                file = request.files["image"]

                if file and file.filename:
                    ext = (
                        os.path.splitext(file.filename)[1].lower()
                        or ".jpg"
                    )

                    if ext not in ALLOWED_IMAGE_EXTENSIONS:
                        logger.warning(
                            "UPLOAD REJECTED [%s] | Unsupported extension: %s",
                            request_id,
                            ext,
                        )

                        return jsonify({
                            "error": (
                                f"Unsupported image format '{ext}'. "
                                "Allowed formats: "
                                f"{sorted(ALLOWED_IMAGE_EXTENSIONS)}"
                            ),
                            "requestId": request_id,
                        }), 400

                    fd, temp_path = tempfile.mkstemp(suffix=ext)
                    os.close(fd)

                    file.save(temp_path)

                    logger.info(
                        "IMAGE UPLOAD [%s] | Image received successfully",
                        request_id,
                    )

        # ------------------------------------------
        # Handle application/json with base64 image
        # ------------------------------------------

        elif request.is_json:
            data = request.get_json(silent=True) or {}

            description = data.get("description", "")
            b64_image = data.get("image_base64")
            if not request.headers.get("X-Request-Id") and data.get("requestId"):
                request_id = data.get("requestId")

            if b64_image:
                try:
                    if "," in b64_image:
                        b64_image = b64_image.split(",", 1)[1]

                    img_bytes = base64.b64decode(
                        b64_image,
                        validate=True,
                    )

                    if not img_bytes:
                        logger.warning(
                            "IMAGE UPLOAD [%s] | Empty base64 image",
                            request_id,
                        )

                        return jsonify({
                            "error": "Received empty image_base64 payload.",
                            "requestId": request_id,
                        }), 400

                    fd, temp_path = tempfile.mkstemp(
                        suffix=".jpg"
                    )
                    os.close(fd)

                    with open(temp_path, "wb") as image_file:
                        image_file.write(img_bytes)

                    logger.info(
                        "IMAGE UPLOAD [%s] | Base64 image decoded successfully",
                        request_id,
                    )

                except (ValueError, TypeError) as exc:
                    logger.warning(
                        "IMAGE UPLOAD [%s] | Base64 decoding failed: %s",
                        request_id,
                        exc,
                    )

                    return jsonify({
                        "error": "Invalid base64 image payload.",
                        "requestId": request_id,
                    }), 400

        # ------------------------------------------
        # Handle description-only form/query request
        # ------------------------------------------

        else:
            description = (
                request.form.get("description")
                or request.args.get("description")
                or ""
            )

        logger.info(
            "ANALYSIS INPUT [%s] | Image attached: %s | Description: %s",
            request_id,
            bool(temp_path),
            bool(description.strip()),
        )

        # ------------------------------------------
        # Run the classifier
        # ------------------------------------------

        inference_start = time.perf_counter()

        result = classify_complaint(
            image_path=temp_path,
            description=description,
            use_llm=True,
            request_id=request_id,
        )

        inference_ms = (
            time.perf_counter() - inference_start
        ) * 1000

        if not isinstance(result, dict):
            raise TypeError(
                "Classifier returned an unexpected response type"
            )

        result["requestId"] = request_id

        # Diagnostic logging (Safe, no credentials logged)
        logger.info(
            "CLASSIFICATION DIAGNOSTIC | ReqID: %s | Source: %s | ModelLoaded: %s | "
            "VisionApiCalled: %s | FallbackUsed: %s | FinalCat: %s | Subcat: %s | "
            "Conf: %s | Latency: %.2f ms",
            request_id,
            result.get("predictionSource", "unknown"),
            result.get("modelLoaded", False),
            result.get("predictionSource") == "gemini_vision",
            result.get("fallbackUsed", False),
            result.get("predictedCategory", result.get("category", "Unknown")),
            result.get("predictedSubcategory", result.get("subcategory", "")),
            result.get("confidence", 0.0),
            inference_ms,
        )

        return jsonify(result), 200

    except Exception as exc:
        sanitized_error = str(exc)[:200]
        logger.exception("ANALYSIS ERROR [%s] | Failure: %s", request_id, sanitized_error)

        return jsonify({
            "error": "Complaint analysis failed",
            "category": "Other",
            "subcategory": "General Issue",
            "predictedCategory": "Other",
            "predictedSubcategory": "General Issue",
            "priority": "MEDIUM",
            "confidence": 0.5,
            "department": "General Municipal Grievance Cell",
            "reason": "Automated fallback due to processing error",
            "isFallback": True,
            "fallbackUsed": True,
            "fallbackReason": f"Processing exception: {sanitized_error}",
            "predictionSource": "rules",
            "modelLoaded": get_model_status().get("loaded", False),
            "requestId": request_id,
        }), 500

    finally:
        if temp_path:
            try:
                cleanup_temp_file(temp_path)
                logger.info(
                    "CLEANUP [%s] | Temporary image file cleaned up",
                    request_id,
                )
            except Exception:
                logger.exception(
                    "CLEANUP ERROR [%s] | Failed to clean temporary image",
                    request_id,
                )



# --------------------------------------------------
# Start the service
# --------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("AI_PORT", 8000))

    logger.info("=" * 65)
    logger.info(
        "Starting Smart City Civic AI Microservice on "
        "http://0.0.0.0:%s",
        port,
    )
    logger.info("=" * 65)

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
    )
