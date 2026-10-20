import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest"
].filter(Boolean);

/**
 * Intelligent rule-based civic classification fallback.
 * Evaluates complaint description keywords and filename to determine
 * category, subcategory, priority, confidence, and explicit metadata.
 */
export function getFallbackClassification(
  description = "",
  filename = "",
  options = {}
) {
  const text = `${description} ${filename}`.toLowerCase();
  const requestId = options.requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const fallbackReason = options.fallbackReason || "Automated keyword and heuristic classification fallback";

  let category = "Other";
  let subcategory = "General Issue";
  let priority = "MEDIUM";
  let confidence = 0.55;
  let reason = "Automated keyword-based classification";
  let department = "General Municipal Grievance Cell";

  // Category matching
  if (/street\s*light|streetlight|street\s*lamp|lamp\s*post|lighting|dark\s*street|flickering\s*light|broken\s*pole|light\s*pole|light\s*bulb|sodium\s*lamp|unlit/i.test(text)) {
    category = "Street Light";
    department = "Electrical Engineering & Public Lighting Division";
    if (/flicker/i.test(text)) {
      subcategory = "Street Light Flickering";
      priority = "MEDIUM";
    } else if (/pole/i.test(text)) {
      subcategory = "Street Light Pole Damaged";
      priority = "HIGH";
    } else if (/missing/i.test(text)) {
      subcategory = "Street Light Missing";
      priority = "MEDIUM";
    } else if (/multiple|all|entire\s*street/i.test(text)) {
      subcategory = "Multiple Street Lights Not Working";
      priority = "HIGH";
    } else if (/damage|broken/i.test(text)) {
      subcategory = "Street Light Damaged";
      priority = "MEDIUM";
    } else {
      subcategory = "Street Light Not Working";
      priority = "MEDIUM";
    }
    confidence = 0.88;
  } else if (/waste|garbage|trash|dustbin|dump|litter|debris|filth|rubbish|compost/i.test(text)) {
    category = "Waste Management";
    department = "Department of Solid Waste Management & Sanitation";
    if (/dump|illegal/i.test(text)) {
      subcategory = "Illegal Waste Disposal";
      priority = "HIGH";
    } else if (/overflow/i.test(text)) {
      subcategory = "Overflowing Dustbin";
      priority = "HIGH";
    } else {
      subcategory = "Garbage Dump";
      priority = "MEDIUM";
    }
    confidence = 0.88;
  } else if (/pothole|road|asphalt|tar|crater|pavement|footpath|divider|speed breaker|carriageway/i.test(text)) {
    category = "Roads";
    department = "Public Works Department (PWD) - Roads & Bridges";
    if (/pothole|crater/i.test(text)) {
      subcategory = "Pothole";
      priority = "HIGH";
    } else if (/footpath|sidewalk/i.test(text)) {
      subcategory = "Broken Footpath";
      priority = "MEDIUM";
    } else {
      subcategory = "Damaged Road";
      priority = "HIGH";
    }
    confidence = 0.91;
  } else if (/drain|gutter|sewage|sewer|waterlogging|blocked drain|manhole|flooding/i.test(text)) {
    category = "Drainage";
    department = "Municipal Water Supply & Sewerage Board (Drainage Wing)";
    if (/manhole|open drain|flood/i.test(text)) {
      subcategory = "Drainage Overflow";
      priority = "CRITICAL";
    } else if (/sewage|leakage/i.test(text)) {
      subcategory = "Sewage Leakage";
      priority = "HIGH";
    } else {
      subcategory = "Blocked Drain";
      priority = "HIGH";
    }
    confidence = 0.89;
  } else if (/water supply|pipeline|pipe|leak|drinking water|tap|valve|water leak/i.test(text)) {
    category = "Water Supply";
    department = "Municipal Water Supply & Sewerage Board (Water Wing)";
    if (/burst|pipeline damage/i.test(text)) {
      subcategory = "Pipeline Damage";
      priority = "HIGH";
    } else if (/leak/i.test(text)) {
      subcategory = "Water Leakage";
      priority = "HIGH";
    } else {
      subcategory = "Water Supply Issue";
      priority = "MEDIUM";
    }
    confidence = 0.87;
  } else if (/traffic signal|signal|sign board|signboard/i.test(text)) {
    category = "Street Infrastructure";
    department = "Electrical Engineering & Public Lighting Division";
    if (/signal/i.test(text)) {
      subcategory = "Damaged Traffic Signal";
      priority = "HIGH";
    } else {
      subcategory = "Damaged Sign Board";
      priority = "LOW";
    }
    confidence = 0.85;
  } else if (/bench|park|garden|playground|public property|vandalism|fence|bus stop|shelter/i.test(text)) {
    category = "Public Property";
    department = "Department of Parks, Gardens & Public Amenities";
    if (/vandal/i.test(text)) {
      subcategory = "Vandalism";
      priority = "MEDIUM";
    } else if (/bench/i.test(text)) {
      subcategory = "Damaged Bench";
      priority = "LOW";
    } else {
      subcategory = "Damaged Park Equipment";
      priority = "MEDIUM";
    }
    confidence = 0.82;
  }

  // Priority escalation overrides
  if (/danger|hazard|accident|open manhole|live wire|electric shock|explosion|urgent|emergency|collapse|electrocution/i.test(text)) {
    priority = "CRITICAL";
    confidence = Math.max(confidence, 0.92);
    reason += " (Escalated to CRITICAL due to public safety hazard)";
  } else if (/major|severe|heavy|deep|main road|highway/i.test(text) && priority === "LOW") {
    priority = "MEDIUM";
  }

  return {
    category,
    subcategory,
    predictedCategory: category,
    predictedSubcategory: subcategory,
    priority,
    confidence,
    reason,
    department,
    predictionSource: "rules",
    modelLoaded: false,
    modelVersion: null,
    fallbackUsed: true,
    fallbackReason,
    requestId,
    isFallback: true,
    source: "rules",
    serviceStatus: "Rule-based fallback active",
  };
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Queries the dedicated Python AI Microservice (ai/) if running.
 */
async function queryMicroserviceAI(imagePath, description, requestId) {
  try {
    const formData = new FormData();
    formData.append("description", description || "");
    if (requestId) {
      formData.append("requestId", requestId);
    }

    if (imagePath && fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      const filename = path.basename(imagePath);
      formData.append("image", new Blob([buffer]), filename);
    }

    const headers = {};
    if (requestId) {
      headers["X-Request-Id"] = requestId;
    }

    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: "POST",
      body: formData,
      headers,
      signal: AbortSignal.timeout(3500),
    });

    if (response.ok) {
      const data = await response.json();
      const predSource = data.predictionSource || (
        data.source === "mobilenet_v3" ? "mobilenet" :
        data.source === "gemini" ? "gemini_vision" : "rules"
      );

      return {
        category: data.category || data.predictedCategory || "Other",
        subcategory: data.subcategory || data.predictedSubcategory || "General Issue",
        predictedCategory: data.predictedCategory || data.category || "Other",
        predictedSubcategory: data.predictedSubcategory || data.subcategory || "General Issue",
        priority: data.priority || "MEDIUM",
        confidence: typeof data.confidence === "number" ? data.confidence : 0.85,
        reason: data.reason || "",
        department: data.department || "",
        predictionSource: predSource,
        modelLoaded: Boolean(data.modelLoaded),
        modelVersion: data.modelVersion || (predSource === "mobilenet" ? "1.0.0" : null),
        fallbackUsed: Boolean(data.fallbackUsed ?? data.isFallback),
        fallbackReason: data.fallbackReason || (data.isFallback ? data.reason : null),
        requestId: data.requestId || requestId,
        isFallback: Boolean(data.isFallback ?? data.fallbackUsed),
        source: data.source || predSource,
        model: data.model || (predSource === "mobilenet" ? "MobileNetV3-Small-Civic" : "CivicClassifier"),
        topPredictions: data.top_predictions || [],
        serviceStatus: `AI Microservice connected (${data.model || predSource})`,
      };
    }
  } catch {
    // Microservice offline; proceed smoothly to Gemini or rule-based fallback
  }
  return null;
}

/**
 * Returns health and architecture verification from the Python AI microservice.
 */
export async function getAiHealth() {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const data = await response.json();
      return {
        online: true,
        ...data,
      };
    }
  } catch (err) {
    // Return offline representation
  }

  return {
    online: false,
    status: "offline",
    service: "Smart City Civic AI Microservice (Unreachable)",
    modelLoaded: false,
    modelVerified: false,
    modelError: "AI microservice is offline or unreachable at " + AI_SERVICE_URL,
    visionApiConfigured: Boolean(process.env.GEMINI_API_KEY),
    fallbackClassificationEnabled: true,
    supportedCategories: [
      "Waste Management",
      "Roads",
      "Drainage",
      "Water Supply",
      "Street Light",
      "Street Infrastructure",
      "Public Property",
      "Other",
    ],
  };
}

export async function analyzeComplaintImageAndText({
  imagePath,
  description = "",
  requestId = null,
}) {
  const effectiveRequestId = requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // 1. Try Python AI Microservice first (runs fine-tuned PyTorch MobileNetV3)
  const microserviceResult = await queryMicroserviceAI(imagePath, description, effectiveRequestId);
  if (microserviceResult) {
    return microserviceResult;
  }

  // 2. Direct Gemini fallback
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[Gemini AI] No GEMINI_API_KEY configured. Using intelligent fallback.");
    return getFallbackClassification(
      description,
      imagePath ? path.basename(imagePath) : "",
      {
        requestId: effectiveRequestId,
        fallbackReason: "MobileNetV3 microservice offline and GEMINI_API_KEY not configured",
      }
    );
  }

  try {
    const parts = [
      {
        text: `
Analyze this civic complaint.

Description:
${description}

Classify it into one of these municipal categories:
- Waste Management
- Roads
- Drainage
- Water Supply
- Street Light
- Street Infrastructure
- Public Property
- Other

Relevant subcategories for Street Light include:
- Street Light Not Working
- Street Light Damaged
- Street Light Missing
- Street Light Flickering
- Street Light Pole Damaged
- Multiple Street Lights Not Working

Return JSON with:
1. category
2. subcategory
3. priority: LOW, MEDIUM, HIGH, CRITICAL
4. confidence: float between 0.50 and 0.99
5. short reason

Return ONLY valid JSON.
        `,
      },
    ];

    // Add image if available and exists on disk
    if (imagePath && fs.existsSync(imagePath)) {
      const imageData = fs.readFileSync(imagePath).toString("base64");
      const ext = path.extname(imagePath).toLowerCase();
      const mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".webp"
            ? "image/webp"
            : "image/jpeg";

      parts.push({
        inlineData: {
          mimeType,
          data: imageData,
        },
      });
    }

    // Try candidate models in order of availability
    let response = null;
    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts,
            },
          ],
          config: {
            responseMimeType: "application/json",
          },
        });
        if (response && response.text) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("No response received from Gemini models");
    }

    const result = JSON.parse(response.text);
    const cat = result.category || "Other";
    const sub = result.subcategory || "General Issue";

    return {
      category: cat,
      subcategory: sub,
      predictedCategory: cat,
      predictedSubcategory: sub,
      priority: result.priority || "MEDIUM",
      confidence: Number(result.confidence) || 0.90,
      reason: result.reason || "",
      department: result.department || (cat === "Street Light" ? "Electrical Engineering & Public Lighting Division" : ""),
      predictionSource: "gemini_vision",
      modelLoaded: false,
      modelVersion: null,
      fallbackUsed: false,
      fallbackReason: null,
      requestId: effectiveRequestId,
      isFallback: false,
      source: "gemini",
      serviceStatus: "Gemini AI connected",
    };
  } catch (error) {
    console.error(
      "[Gemini AI Error]",
      error.message
    );

    return getFallbackClassification(
      description,
      imagePath ? path.basename(imagePath) : "",
      {
        requestId: effectiveRequestId,
        fallbackReason: `MobileNetV3 microservice offline and Gemini error: ${error.message}`,
      }
    );
  }
}