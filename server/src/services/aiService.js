import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { ApiError } from "../utils/apiUtils.js";
import { COMPLAINT_CATEGORIES } from "../models/complaints.model.js";

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest",
].filter(Boolean);

export const SIX_MAIN_CATEGORIES = [
  "Drainage",
  "Other",
  "Roads",
  "Street Light",
  "Waste Management",
  "Water Supply",
];

const SIX_CATEGORY_SUBCATEGORY_PROMPT = `
1. Drainage
   Allowed subcategories: Blocked Drain, Drainage Overflow, Sewage Leakage
2. Other
   Allowed subcategories: General Issue, Other
3. Roads
   Allowed subcategories: Pothole, Damaged Road, Broken Footpath
4. Street Light
   Allowed subcategories: Street Light Not Working, Street Light Damaged, Street Light Missing, Street Light Flickering, Street Light Pole Damaged, Multiple Street Lights Not Working
5. Waste Management
   Allowed subcategories: Garbage Dump, Overflowing Dustbin, Illegal Waste Disposal
6. Water Supply
   Allowed subcategories: Water Leakage, Pipeline Damage, Water Supply Issue
`.trim();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const DEPARTMENT_MAP = {
  "Street Light": "Electrical Engineering & Public Lighting Division",
  "Waste Management": "Department of Solid Waste Management & Sanitation",
  "Roads": "Public Works Department (PWD) - Roads & Bridges",
  "Drainage": "Municipal Water Supply & Sewerage Board (Drainage Wing)",
  "Water Supply": "Municipal Water Supply & Sewerage Board (Water Wing)",
  "Street Infrastructure": "Electrical Engineering & Public Lighting Division",
  "Public Property": "Department of Parks, Gardens & Public Amenities",
  "Other": "General Municipal Grievance Cell",
};

/**
 * Validates and normalizes the subcategory against COMPLAINT_CATEGORIES for the given category.
 * - If rawSubcategory matches an allowed subcategory (exact or case-insensitively), returns canonical subcategory.
 * - If rawSubcategory is "NA", "N/A", missing, or not in the allowed list, resolves from description keywords
 *   or falls back to the category's primary subcategory from COMPLAINT_CATEGORIES.
 * Never returns "NA" or "N/A".
 */
export function validateAndResolveSubcategory(category, rawSubcategory = "", description = "") {
  const allowed = COMPLAINT_CATEGORIES[category] || COMPLAINT_CATEGORIES["Other"] || ["General Issue"];
  const trimmed = typeof rawSubcategory === "string" ? rawSubcategory.trim() : "";

  // 1. Exact match against allowed subcategories
  if (allowed.includes(trimmed)) {
    return trimmed;
  }

  // 2. Case-insensitive or clean match (ignoring placeholders like NA, N/A, none, etc.)
  if (trimmed && !/^(n\/?a|na|none|null|undefined|-)$/i.test(trimmed)) {
    const ciMatch = allowed.find((sub) => sub.toLowerCase() === trimmed.toLowerCase());
    if (ciMatch) return ciMatch;

    // Substring / fuzzy match
    const fuzzyMatch = allowed.find(
      (sub) =>
        sub.toLowerCase().includes(trimmed.toLowerCase()) ||
        trimmed.toLowerCase().includes(sub.toLowerCase())
    );
    if (fuzzyMatch) return fuzzyMatch;
  }

  // 3. If rawSubcategory was "NA", placeholder, or unrecognized, infer from description keywords
  const descLower = (description || "").toLowerCase();
  for (const sub of allowed) {
    const keywords = sub.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (keywords.some((k) => descLower.includes(k))) {
      return sub;
    }
  }

  // 4. Default to first valid subcategory in existing mapping for this category
  return allowed[0];
}

// Test hook references (for mocking in automated tests)
let testGeminiClient = null;
let testMicroserviceFetch = null;

export function setGeminiClientForTesting(client) {
  testGeminiClient = client;
}

export function setMicroserviceFetchForTesting(fn) {
  testMicroserviceFetch = fn;
}

/**
 * Returns an instance of GoogleGenAI if a valid GEMINI_API_KEY is present
 * or if a test client is injected.
 */
function getGeminiClient() {
  if (testGeminiClient) return testGeminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return null;
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
}

/**
 * Returns the exact provider list for a given environment.
 * Development: ["MobileNetV3"] (strictly MobileNetV3 only)
 * Production:  ["Gemini"]      (strictly Gemini only)
 * Unset/Other: []              (invalid configuration, no provider)
 */
export function getProviderPriority(env = process.env.NODE_ENV) {
  if (env === "development") {
    return ["MobileNetV3"];
  }
  if (env === "production") {
    return ["Gemini"];
  }
  return [];
}

/**
 * Intelligent rule-based civic classification.
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
  const fallbackReason = options.fallbackReason || "Automated keyword and heuristic classification";

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
    fallbackUsed: false,
    fallbackReason: null,
    requestId,
    isFallback: false,
    source: "rules",
    serviceStatus: "Rule-based active",
  };
}

/**
 * Queries the dedicated Python AI Microservice (ai/) if running.
 */
export async function queryMicroserviceAI(imagePath, description, requestId) {
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

    const fetchFn = testMicroserviceFetch || globalThis.fetch;
    const response = await fetchFn(`${AI_SERVICE_URL}/analyze`, {
      method: "POST",
      body: formData,
      headers,
      signal: AbortSignal.timeout(20000),
    });

    if (response.ok) {
      const data = await response.json();
      const predSource = data.predictionSource || (
        data.source === "gemini" ? "gemini_vision" :
        data.source === "mobilenet_v3" ? "mobilenet" : "rules"
      );

      return {
        category: data.category || data.predictedCategory || "Other",
        subcategory: data.subcategory || data.predictedSubcategory || "General Issue",
        predictedCategory: data.predictedCategory || data.category || "Other",
        predictedSubcategory: data.predictedSubcategory || data.subcategory || "General Issue",
        priority: data.priority || "MEDIUM",
        confidence: typeof data.confidence === "number" ? data.confidence : 0.85,
        description: data.description || data.reason || "",
        reason: data.reason || "",
        department: data.department || "",
        needsReview: Boolean(data.needsReview),
        predictionSource: predSource,
        modelLoaded: Boolean(data.modelLoaded),
        modelVersion: data.modelVersion || null,
        fallbackUsed: false,
        fallbackReason: null,
        requestId: data.requestId || requestId,
        isFallback: false,
        source: data.source || predSource,
        model: data.model || "MobileNetV3-Small",
        topPredictions: data.top_predictions || [],
        serviceStatus: `AI Microservice connected (${data.model || predSource})`,
      };
    }
  } catch {
    // Microservice offline or communication failed
  }
  return null;
}

/**
 * Executes MobileNetV3 classification strictly via the Python microservice.
 * Always returns its prediction regardless of confidence score.
 * Never switches to Gemini or rules.
 * Throws a clear ApiError if unavailable or failed.
 */
export async function classifyWithMobileNetV3(imagePath, description, requestId) {
  if (imagePath && !fs.existsSync(imagePath)) {
    throw new ApiError(400, `Image file specified does not exist on disk: ${imagePath}`);
  }

  const result = await queryMicroserviceAI(imagePath, description, requestId);
  if (!result) {
    throw new ApiError(503, `MobileNetV3 classification service is unavailable or unreachable at ${AI_SERVICE_URL}`);
  }

  const cat = result.category || result.predictedCategory || "Other";
  const sub = result.subcategory || result.predictedSubcategory || "General Issue";
  const conf = typeof result.confidence === "number" ? result.confidence : 0.85;

  return {
    category: cat,
    subcategory: sub,
    predictedCategory: cat,
    predictedSubcategory: sub,
    priority: result.priority || "MEDIUM",
    confidence: conf,
    description: result.description || result.reason || "",
    reason: result.reason || "",
    department: result.department || DEPARTMENT_MAP[cat] || "General Municipal Grievance Cell",
    needsReview: Boolean(result.needsReview),
    predictionSource: "mobilenet",
    modelLoaded: Boolean(result.modelLoaded),
    modelVersion: result.modelVersion || null,
    fallbackUsed: false,
    fallbackReason: null,
    requestId,
    isFallback: false,
    source: "mobilenet",
    model: result.model || "MobileNetV3-Small",
    topPredictions: result.topPredictions || [],
    serviceStatus: "Trained MobileNetV3 model active",
  };
}

/**
 * Executes Gemini multimodal classification strictly.
 * Always returns its prediction regardless of confidence score.
 * Never switches to MobileNetV3 or rules.
 * Throws a clear ApiError if unavailable or failed.
 */
export async function classifyWithGemini(imagePath, description, requestId) {
  const ai = getGeminiClient();
  if (!ai) {
    throw new ApiError(500, "Gemini classification service is unavailable: GEMINI_API_KEY is not configured");
  }

  const parts = [
    {
      text: `
Analyze this civic complaint.

Description:
${description}

Classify it into one of these six municipal categories and its corresponding subcategory:
${SIX_CATEGORY_SUBCATEGORY_PROMPT}

Rules:
1. "category": Must be one of the six categories above ("Drainage", "Other", "Roads", "Street Light", "Waste Management", "Water Supply").
2. "subcategory": Must be one of the allowed subcategories for that predicted category. Never return "NA", "N/A", or generic placeholders. Always choose the most fitting valid subcategory.
3. "priority": LOW, MEDIUM, HIGH, or CRITICAL.
4. "confidence": float between 0.50 and 0.99.
5. "reason": short explanation.

Return ONLY a valid JSON object:
{
  "category": "<one of the 6 categories>",
  "subcategory": "<one of the allowed subcategories for the chosen category>",
  "priority": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "confidence": <float>,
  "reason": "<short explanation>"
}
      `.trim(),
    },
  ];

  if (imagePath && fs.existsSync(imagePath)) {
    try {
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
    } catch (readErr) {
      throw new ApiError(400, `Failed to read image file for Gemini analysis: ${readErr.message}`);
    }
  }

  let response = null;
  let lastError = null;
  let usedModel = null;
  const timeoutMs = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 15000;

  for (const model of CANDIDATE_MODELS) {
    try {
      const generatePromise = ai.models.generateContent({
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

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new ApiError(504, `Gemini API request timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      response = await Promise.race([generatePromise, timeoutPromise]);
      if (response && response.text) {
        usedModel = model;
        break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!response || !response.text) {
    if (lastError instanceof ApiError) {
      throw lastError;
    }
    throw new ApiError(502, `Gemini API error: ${lastError?.message || "No response received from Gemini models"}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (parseErr) {
    throw new ApiError(502, `Invalid JSON returned by Gemini: ${parseErr.message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ApiError(502, "Gemini response is not a valid JSON object");
  }

  const rawCat = typeof parsed.category === "string" ? parsed.category.trim() : "";
  if (!rawCat) {
    throw new ApiError(502, "Gemini response is missing or has invalid category");
  }

  // Canonicalize category against COMPLAINT_CATEGORIES
  const canonicalCategory = Object.keys(COMPLAINT_CATEGORIES).find(
    (c) => c.toLowerCase() === rawCat.toLowerCase()
  ) || rawCat;

  // Validate and resolve subcategory against the existing mapping for the predicted category
  const sub = validateAndResolveSubcategory(canonicalCategory, parsed.subcategory, description);
  const conf = typeof parsed.confidence === "number" && !isNaN(parsed.confidence)
    ? parsed.confidence
    : (typeof parsed.confidence === "string" && !isNaN(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.90);

  return {
    category: canonicalCategory,
    subcategory: sub,
    predictedCategory: canonicalCategory,
    predictedSubcategory: sub,
    priority: parsed.priority || "MEDIUM",
    confidence: conf,
    reason: parsed.reason || "",
    department: parsed.department || DEPARTMENT_MAP[canonicalCategory] || "General Municipal Grievance Cell",
    predictionSource: "gemini_vision",
    modelLoaded: false,
    modelVersion: null,
    fallbackUsed: false,
    fallbackReason: null,
    requestId,
    isFallback: false,
    source: "gemini",
    model: usedModel || "Gemini-Vision",
    topPredictions: [],
    serviceStatus: "Gemini AI active",
  };
}

/**
 * Returns health and architecture verification from the Python AI microservice.
 */
export async function getAiHealth() {
  const environment = process.env.NODE_ENV;
  const priority = getProviderPriority(environment);
  const selectedProvider = environment === "development" ? "MobileNetV3" : environment === "production" ? "Gemini" : "None";

  try {
    const fetchFn = testMicroserviceFetch || globalThis.fetch;
    const response = await fetchFn(`${AI_SERVICE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const data = await response.json();
      return {
        online: true,
        environment: environment || "unconfigured",
        selectedProvider,
        activeProviderPriority: priority,
        ...data,
      };
    }
  } catch {
    // Return offline representation
  }

  return {
    online: false,
    status: "offline",
    service: "Smart City Civic AI Microservice (Unreachable)",
    environment: environment || "unconfigured",
    selectedProvider,
    activeProviderPriority: priority,
    modelLoaded: false,
    modelVerified: false,
    modelError: "AI microservice is offline or unreachable at " + AI_SERVICE_URL,
    visionApiConfigured: Boolean(process.env.GEMINI_API_KEY),
    fallbackClassificationEnabled: false,
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

/**
 * Strict Environment-Based AI Complaint Classifier:
 *
 * NODE_ENV=development:
 * - Use ONLY trained MobileNetV3 model.
 * - Always return its prediction, regardless of confidence score.
 * - Do NOT switch to Gemini when confidence is low.
 * - Do NOT use rule-based fallback.
 * - Do NOT call Gemini under any circumstances.
 *
 * NODE_ENV=production:
 * - Use ONLY Gemini API.
 * - Always use Gemini for predictions, regardless of confidence score.
 * - Do NOT switch to MobileNetV3 when Gemini confidence is low.
 * - Do NOT use rule-based fallback.
 * - Do NOT call the trained model under any circumstances.
 *
 * Unsupported or missing NODE_ENV:
 * - Throws a clear ApiError configuration error; does not select a provider automatically.
 */
export async function analyzeComplaintImageAndText({
  imagePath,
  description = "",
  requestId = null,
}) {
  const effectiveRequestId = requestId || `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const environment = process.env.NODE_ENV;

  // Validate NODE_ENV strictly
  if (!environment || (environment !== "development" && environment !== "production")) {
    const errorMsg = `Configuration Error: Invalid or unsupported NODE_ENV ("${environment}"). NODE_ENV must be set strictly to "development" or "production".`;
    console.error(`[AI Provider Selection] ${errorMsg}`);
    throw new ApiError(500, errorMsg);
  }

  console.log(`Environment: ${environment}`);

  // DEVELOPMENT ENVIRONMENT: Strict MobileNetV3 only
  if (environment === "development") {
    console.log("Selected provider: MobileNetV3");
    try {
      const result = await classifyWithMobileNetV3(imagePath, description, effectiveRequestId);
      console.log("MobileNetV3 classification successful");
      return result;
    } catch (error) {
      console.log(`MobileNetV3 classification failed: ${error.message}`);
      throw error;
    }
  }

  // PRODUCTION ENVIRONMENT: Strict Gemini only
  if (environment === "production") {
    console.log("Selected provider: Gemini");
    try {
      const result = await classifyWithGemini(imagePath, description, effectiveRequestId);
      console.log("Gemini classification successful");
      return result;
    } catch (error) {
      console.log(`Gemini classification failed: ${error.message}`);
      throw error;
    }
  }
}
