/**
 * Comprehensive Automated Verification Suite for
 * Strict Environment-Based AI Provider Selection (NODE_ENV)
 *
 * Requirements Verified:
 * 1. Development (NODE_ENV=development):
 *    - Use ONLY the trained MobileNetV3 model.
 *    - Always return its prediction, regardless of confidence score.
 *    - Do NOT switch to Gemini when confidence is low.
 *    - Do NOT use rule-based fallback.
 *    - Do NOT call Gemini under any circumstances.
 *
 * 2. Production (NODE_ENV=production):
 *    - Use ONLY the Gemini API.
 *    - Always use Gemini for predictions, regardless of confidence score.
 *    - Do NOT switch to MobileNetV3 when Gemini confidence is low.
 *    - Do NOT use rule-based fallback.
 *    - Do NOT call the trained model under any circumstances.
 *
 * 3. Configuration & Error Handling:
 *    - Validate unsupported or missing NODE_ENV values -> return clear configuration error.
 *    - Selected provider unavailable -> return clear error; NO fallback.
 *    - Preserve existing confidence scores in the API response (no artificial modification).
 *    - Preserve existing response structure, category names, subcategories, department routing.
 *    - GEMINI_API_KEY on the backend only.
 *
 * 4. Specific Verification Test Cases:
 *    - Case 1: Development + high MobileNetV3 confidence -> MobileNetV3.
 *    - Case 2: Development + low MobileNetV3 confidence -> MobileNetV3.
 *    - Case 3: Development + Gemini configured -> Gemini must not be called.
 *    - Case 4: Production + high Gemini confidence -> Gemini.
 *    - Case 5: Production + low Gemini confidence -> Gemini.
 *    - Case 6: Production + MobileNetV3 available -> MobileNetV3 must not be called.
 *    - Case 7: Selected provider unavailable -> return an error; no fallback.
 *    - Case 8: Missing/unsupported NODE_ENV -> return configuration error; no fallback.
 *    - Case 9: Live microservice verification on port 8000.
 */

import fs from "fs";
import path from "path";
import {
  analyzeComplaintImageAndText,
  getProviderPriority,
  setGeminiClientForTesting,
  setMicroserviceFetchForTesting,
} from "./src/services/aiService.js";
import { ApiError } from "./src/utils/apiUtils.js";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    testsPassed++;
  }
}

// Helper to capture console logs and errors for assertion
let capturedLogs = [];
const originalLog = console.log;
const originalError = console.error;

function startLogCapture() {
  capturedLogs = [];
  console.log = (...args) => {
    capturedLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    originalLog(...args);
  };
  console.error = (...args) => {
    capturedLogs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
    originalError(...args);
  };
}

function stopLogCapture() {
  console.log = originalLog;
  console.error = originalError;
  return [...capturedLogs];
}

// Find a real test image from the dataset for testing
function findSampleImage() {
  const candidateDirs = [
    path.resolve("../ai/data/Drainage"),
    path.resolve("./ai/data/Drainage"),
    path.resolve("../ai/data/Roads"),
    path.resolve("./ai/data/Roads"),
  ];

  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (files.length > 0) {
        return path.join(dir, files[0]);
      }
    }
  }
  return null;
}

// Mock factory for Gemini client
function createMockGeminiClient({ responseText, shouldThrow, timeoutDelayMs, onCall }) {
  return {
    models: {
      generateContent: async ({ model }) => {
        if (onCall) onCall(model);
        if (timeoutDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, timeoutDelayMs));
        }
        if (shouldThrow) {
          throw new Error(typeof shouldThrow === "string" ? shouldThrow : "Simulated Gemini API error");
        }
        return {
          text: responseText,
        };
      },
    },
  };
}

// Mock factory for Python microservice fetch
function createMockMicroserviceFetch({ status = 200, responseData, shouldReject, onCall }) {
  return async (url, options) => {
    if (onCall) onCall(url, options);
    if (shouldReject) {
      throw new Error(typeof shouldReject === "string" ? shouldReject : "fetch failed: ECONNREFUSED");
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseData,
    };
  };
}

async function runStrictPriorityTestSuite() {
  console.log("================================================================");
  console.log(" SMART CITY CIVIC AI: STRICT NODE_ENV PROVIDER SWITCH TEST SUITE");
  console.log("================================================================\n");

  const sampleImage = findSampleImage();
  assert(Boolean(sampleImage && fs.existsSync(sampleImage)), `Valid sample image found: ${sampleImage}`);

  // --------------------------------------------------------------------------
  // SUITE 1: Provider Priority Mapping Verification
  // --------------------------------------------------------------------------
  console.log("\n[Suite 1] Priority Resolver Mapping...");
  const devPriority = getProviderPriority("development");
  assert(
    devPriority.length === 1 && devPriority[0] === "MobileNetV3",
    `Development priority is strictly [MobileNetV3]: got ${JSON.stringify(devPriority)}`
  );

  const prodPriority = getProviderPriority("production");
  assert(
    prodPriority.length === 1 && prodPriority[0] === "Gemini",
    `Production priority is strictly [Gemini]: got ${JSON.stringify(prodPriority)}`
  );

  const unsetPriority = getProviderPriority(undefined);
  assert(
    unsetPriority.length === 0,
    `Unset environment returns empty priority: got ${JSON.stringify(unsetPriority)}`
  );

  const stagingPriority = getProviderPriority("staging");
  assert(
    stagingPriority.length === 0,
    `Unsupported environment ("staging") returns empty priority: got ${JSON.stringify(stagingPriority)}`
  );

  // --------------------------------------------------------------------------
  // SUITE 2: Development Environment Tests (NODE_ENV=development)
  // --------------------------------------------------------------------------
  console.log("\n[Suite 2] Development Environment Flow (NODE_ENV=development)...");
  process.env.NODE_ENV = "development";

  // CASE 1: Development + high MobileNetV3 confidence -> MobileNetV3
  {
    console.log("  [Case 1] Development + high MobileNetV3 confidence -> MobileNetV3");
    let geminiCalled = false;
    let mobileNetCalled = false;

    setGeminiClientForTesting(
      createMockGeminiClient({
        onCall: () => { geminiCalled = true; },
        responseText: JSON.stringify({ category: "Other", confidence: 0.99 }),
      })
    );

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: {
          predictedCategory: "Drainage",
          category: "Drainage",
          predictedSubcategory: "Blocked Drain",
          subcategory: "Blocked Drain",
          priority: "HIGH",
          confidence: 0.985,
          predictionSource: "mobilenet",
          source: "mobilenet_v3",
          modelLoaded: true,
          modelVersion: "1.11.0-drainage-v9",
        },
      })
    );

    startLogCapture();
    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Severe stormwater drainage blockage",
      requestId: "test_dev_high_conf",
    });
    const logs = stopLogCapture();

    assert(mobileNetCalled === true, "MobileNetV3 was called");
    assert(geminiCalled === false, "Gemini was NOT called");
    assert(result.category === "Drainage", "Category is Drainage");
    assert(result.confidence === 0.985, `Confidence preserved at 0.985: got ${result.confidence}`);
    assert(result.predictionSource === "mobilenet", "Prediction source is mobilenet");
    assert(result.fallbackUsed === false, "fallbackUsed is false");
    assert(result.isFallback === false, "isFallback is false");
    assert(logs.some((l) => l.includes("Environment: development")), "Logged Environment: development");
    assert(logs.some((l) => l.includes("Selected provider: MobileNetV3")), "Logged Selected provider: MobileNetV3");
    assert(logs.some((l) => l.includes("MobileNetV3 classification successful")), "Logged MobileNetV3 classification successful");
  }

  // CASE 2: Development + low MobileNetV3 confidence -> MobileNetV3 (Do NOT switch to Gemini, do NOT use rules)
  {
    console.log("  [Case 2] Development + low MobileNetV3 confidence -> MobileNetV3");
    let geminiCalled = false;
    let mobileNetCalled = false;

    setGeminiClientForTesting(
      createMockGeminiClient({
        onCall: () => { geminiCalled = true; },
        responseText: JSON.stringify({ category: "Roads", confidence: 0.95 }),
      })
    );

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: {
          predictedCategory: "Roads",
          category: "Roads",
          predictedSubcategory: "Damaged Road",
          subcategory: "Damaged Road",
          priority: "MEDIUM",
          confidence: 0.28, // Low confidence
          predictionSource: "mobilenet",
          source: "mobilenet_v3",
          modelLoaded: true,
          modelVersion: "1.11.0-drainage-v9",
        },
      })
    );

    startLogCapture();
    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Minor road surface unevenness",
      requestId: "test_dev_low_conf",
    });
    const logs = stopLogCapture();

    assert(mobileNetCalled === true, "MobileNetV3 was called");
    assert(geminiCalled === false, "Gemini was NOT called despite low confidence");
    assert(result.category === "Roads", "Category is Roads from MobileNetV3");
    assert(result.confidence === 0.28, `Low confidence preserved at exactly 0.28: got ${result.confidence}`);
    assert(result.predictionSource === "mobilenet", "Prediction source is mobilenet");
    assert(result.fallbackUsed === false, "fallbackUsed is false (no fallback)");
    assert(result.isFallback === false, "isFallback is false");
    assert(logs.some((l) => l.includes("MobileNetV3 classification successful")), "Logged MobileNetV3 classification successful");
  }

  // CASE 3: Development + Gemini configured -> Gemini must NOT be called
  {
    console.log("  [Case 3] Development + Gemini configured -> Gemini must NOT be called");
    process.env.GEMINI_API_KEY = "dummy_valid_looking_gemini_key_for_test";
    let geminiCalled = false;

    setGeminiClientForTesting(
      createMockGeminiClient({
        onCall: () => { geminiCalled = true; },
        responseText: JSON.stringify({ category: "Street Light", confidence: 0.99 }),
      })
    );

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        status: 200,
        responseData: {
          predictedCategory: "Street Light",
          category: "Street Light",
          predictedSubcategory: "Street Light Not Working",
          subcategory: "Street Light Not Working",
          priority: "HIGH",
          confidence: 0.89,
          predictionSource: "mobilenet",
          source: "mobilenet_v3",
        },
      })
    );

    startLogCapture();
    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Dark street with broken lamp pole",
      requestId: "test_dev_gemini_configured",
    });
    const logs = stopLogCapture();

    assert(geminiCalled === false, "Gemini was NOT called even though GEMINI_API_KEY and client were configured");
    assert(result.predictionSource === "mobilenet", "Prediction came from MobileNetV3");
    assert(result.confidence === 0.89, "Confidence preserved at 0.89");
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Production Environment Tests (NODE_ENV=production)
  // --------------------------------------------------------------------------
  console.log("\n[Suite 3] Production Environment Flow (NODE_ENV=production)...");
  process.env.NODE_ENV = "production";

  // CASE 4: Production + high Gemini confidence -> Gemini
  {
    console.log("  [Case 4] Production + high Gemini confidence -> Gemini");
    let geminiCalled = false;
    let mobileNetCalled = false;

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: { category: "Drainage", confidence: 0.99 },
      })
    );

    setGeminiClientForTesting(
      createMockGeminiClient({
        onCall: () => { geminiCalled = true; },
        responseText: JSON.stringify({
          category: "Waste Management",
          subcategory: "Overflowing Dustbin",
          priority: "HIGH",
          confidence: 0.96,
          reason: "Garbage overflow detected by Gemini Vision",
        }),
      })
    );

    startLogCapture();
    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Trash overflowing onto sidewalk",
      requestId: "test_prod_high_conf",
    });
    const logs = stopLogCapture();

    assert(geminiCalled === true, "Gemini was called");
    assert(mobileNetCalled === false, "MobileNetV3 was NOT called");
    assert(result.category === "Waste Management", "Category is Waste Management");
    assert(result.confidence === 0.96, `Confidence preserved at 0.96: got ${result.confidence}`);
    assert(result.predictionSource === "gemini_vision", "Prediction source is gemini_vision");
    assert(result.fallbackUsed === false, "fallbackUsed is false");
    assert(result.isFallback === false, "isFallback is false");
    assert(logs.some((l) => l.includes("Environment: production")), "Logged Environment: production");
    assert(logs.some((l) => l.includes("Selected provider: Gemini")), "Logged Selected provider: Gemini");
    assert(logs.some((l) => l.includes("Gemini classification successful")), "Logged Gemini classification successful");
  }

  // CASE 5: Production + low Gemini confidence -> Gemini (Do NOT switch to MobileNetV3, do NOT use rules)
  {
    console.log("  [Case 5] Production + low Gemini confidence -> Gemini");
    let geminiCalled = false;
    let mobileNetCalled = false;

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: { category: "Roads", confidence: 0.99 },
      })
    );

    setGeminiClientForTesting(
      createMockGeminiClient({
        onCall: () => { geminiCalled = true; },
        responseText: JSON.stringify({
          category: "Water Supply",
          subcategory: "Water Leakage",
          priority: "MEDIUM",
          confidence: 0.32, // Low confidence
          reason: "Uncertain water pipeline leak",
        }),
      })
    );

    startLogCapture();
    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Possible leak near valve",
      requestId: "test_prod_low_conf",
    });
    const logs = stopLogCapture();

    assert(geminiCalled === true, "Gemini was called");
    assert(mobileNetCalled === false, "MobileNetV3 was NOT called despite low Gemini confidence");
    assert(result.category === "Water Supply", "Category is Water Supply from Gemini");
    assert(result.confidence === 0.32, `Low confidence preserved at exactly 0.32: got ${result.confidence}`);
    assert(result.predictionSource === "gemini_vision", "Prediction source is gemini_vision");
    assert(result.fallbackUsed === false, "fallbackUsed is false (no fallback)");
    assert(result.isFallback === false, "isFallback is false");
    assert(logs.some((l) => l.includes("Gemini classification successful")), "Logged Gemini classification successful");
  }

  // CASE 6: Production + MobileNetV3 available -> MobileNetV3 must NOT be called
  {
    console.log("  [Case 6] Production + MobileNetV3 available -> MobileNetV3 must NOT be called");
    let mobileNetCalled = false;

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: {
          category: "Drainage",
          confidence: 0.99,
          predictionSource: "mobilenet",
        },
      })
    );

    setGeminiClientForTesting(
      createMockGeminiClient({
        responseText: JSON.stringify({
          category: "Public Property",
          subcategory: "Damaged Bench",
          priority: "LOW",
          confidence: 0.88,
          reason: "Broken park bench",
        }),
      })
    );

    startLogCapture();
    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Broken bench in municipal park",
      requestId: "test_prod_mobilenet_available",
    });
    const logs = stopLogCapture();

    assert(mobileNetCalled === false, "MobileNetV3 was NOT called even though it was available");
    assert(result.predictionSource === "gemini_vision", "Prediction came from Gemini");
    assert(result.category === "Public Property", "Category is Public Property");
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Selected Provider Unavailable -> Return Error, NO Fallback
  // --------------------------------------------------------------------------
  console.log("\n[Suite 4] Selected Provider Unavailable -> Return Clear Error (NO Fallback)...");

  // CASE 7a: Development + MobileNetV3 unavailable -> Throw error, do NOT call Gemini or Rules
  {
    console.log("  [Case 7a] Development: MobileNetV3 unavailable -> returns error, NO fallback");
    process.env.NODE_ENV = "development";
    let geminiCalled = false;

    setGeminiClientForTesting(
      createMockGeminiClient({
        onCall: () => { geminiCalled = true; },
        responseText: JSON.stringify({ category: "Drainage", confidence: 0.95 }),
      })
    );

    // Microservice offline/refusing connection
    setMicroserviceFetchForTesting(createMockMicroserviceFetch({ shouldReject: true }));

    let caughtError = null;
    startLogCapture();
    try {
      await analyzeComplaintImageAndText({
        imagePath: sampleImage,
        description: "Flooded drainage issue",
        requestId: "test_dev_unavailable",
      });
    } catch (err) {
      caughtError = err;
    }
    const logs = stopLogCapture();

    assert(Boolean(caughtError), "Error was thrown when MobileNetV3 was unavailable");
    assert(caughtError instanceof ApiError, "Caught error is an ApiError");
    assert(caughtError.statusCode === 503, `Status code is 503: got ${caughtError.statusCode}`);
    assert(
      caughtError.message.includes("unavailable") || caughtError.message.includes("offline"),
      `Error message is clear: ${caughtError.message}`
    );
    assert(geminiCalled === false, "Gemini was NOT called (no silent fallback)");
    assert(logs.some((l) => l.includes("MobileNetV3 classification failed")), "Logged MobileNetV3 classification failed");
    assert(!logs.some((l) => l.includes("Fallback")), "No fallback was triggered or logged");
  }

  // CASE 7b: Production + Gemini unavailable (missing GEMINI_API_KEY) -> Throw error, do NOT call MobileNetV3 or Rules
  {
    console.log("  [Case 7b] Production: Missing GEMINI_API_KEY -> returns error, NO fallback");
    process.env.NODE_ENV = "production";
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    setGeminiClientForTesting(null); // Real check for API key

    let mobileNetCalled = false;
    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: { category: "Roads", confidence: 0.99 },
      })
    );

    let caughtError = null;
    startLogCapture();
    try {
      await analyzeComplaintImageAndText({
        imagePath: sampleImage,
        description: "Damaged road crater",
        requestId: "test_prod_missing_key",
      });
    } catch (err) {
      caughtError = err;
    }
    const logs = stopLogCapture();

    assert(Boolean(caughtError), "Error was thrown when GEMINI_API_KEY is missing");
    assert(caughtError.statusCode === 500, `Status code is 500: got ${caughtError.statusCode}`);
    assert(
      caughtError.message.includes("GEMINI_API_KEY is not configured"),
      `Error message states missing key: ${caughtError.message}`
    );
    assert(mobileNetCalled === false, "MobileNetV3 was NOT called (no silent fallback)");
    assert(logs.some((l) => l.includes("Gemini classification failed")), "Logged Gemini classification failed");
    assert(!logs.some((l) => l.includes("Fallback")), "No fallback was triggered or logged");

    if (savedKey) process.env.GEMINI_API_KEY = savedKey;
  }

  // CASE 7c: Production + Gemini API timeout/error -> Throw error, do NOT call MobileNetV3 or Rules
  {
    console.log("  [Case 7c] Production: Gemini API error -> returns error, NO fallback");
    process.env.NODE_ENV = "production";
    let mobileNetCalled = false;

    setMicroserviceFetchForTesting(
      createMockMicroserviceFetch({
        onCall: () => { mobileNetCalled = true; },
        status: 200,
        responseData: { category: "Roads", confidence: 0.99 },
      })
    );

    setGeminiClientForTesting(
      createMockGeminiClient({
        shouldThrow: "Gemini API rate limit exceeded (429)",
      })
    );

    let caughtError = null;
    startLogCapture();
    try {
      await analyzeComplaintImageAndText({
        imagePath: sampleImage,
        description: "Broken traffic signal",
        requestId: "test_prod_gemini_error",
      });
    } catch (err) {
      caughtError = err;
    }
    const logs = stopLogCapture();

    assert(Boolean(caughtError), "Error was thrown on Gemini API failure");
    assert(caughtError.statusCode === 502, `Status code is 502: got ${caughtError.statusCode}`);
    assert(caughtError.message.includes("Gemini API error"), `Error message is clear: ${caughtError.message}`);
    assert(mobileNetCalled === false, "MobileNetV3 was NOT called (no silent fallback)");
    assert(!logs.some((l) => l.includes("Fallback")), "No fallback was triggered or logged");
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Missing or Unsupported NODE_ENV -> Return Configuration Error
  // --------------------------------------------------------------------------
  console.log("\n[Suite 5] Validate Unsupported or Missing NODE_ENV...");

  // CASE 8a: Missing NODE_ENV (undefined)
  {
    console.log("  [Case 8a] NODE_ENV is undefined -> returns configuration error");
    const prevEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;

    let geminiCalled = false;
    let mobileNetCalled = false;
    setGeminiClientForTesting(createMockGeminiClient({ onCall: () => { geminiCalled = true; } }));
    setMicroserviceFetchForTesting(createMockMicroserviceFetch({ onCall: () => { mobileNetCalled = true; } }));

    let caughtError = null;
    try {
      await analyzeComplaintImageAndText({
        imagePath: sampleImage,
        description: "Test complaint",
        requestId: "test_missing_env",
      });
    } catch (err) {
      caughtError = err;
    }

    assert(Boolean(caughtError), "Error was thrown when NODE_ENV is undefined");
    assert(caughtError instanceof ApiError, "Caught error is an ApiError");
    assert(caughtError.statusCode === 500, "Status code is 500");
    assert(
      caughtError.message.includes("Invalid or unsupported NODE_ENV"),
      `Error states invalid NODE_ENV: ${caughtError.message}`
    );
    assert(geminiCalled === false, "Gemini was NOT called");
    assert(mobileNetCalled === false, "MobileNetV3 was NOT called");

    process.env.NODE_ENV = prevEnv;
  }

  // CASE 8b: Unsupported NODE_ENV ("staging")
  {
    console.log("  [Case 8b] NODE_ENV='staging' -> returns configuration error");
    process.env.NODE_ENV = "staging";

    let geminiCalled = false;
    let mobileNetCalled = false;
    setGeminiClientForTesting(createMockGeminiClient({ onCall: () => { geminiCalled = true; } }));
    setMicroserviceFetchForTesting(createMockMicroserviceFetch({ onCall: () => { mobileNetCalled = true; } }));

    let caughtError = null;
    try {
      await analyzeComplaintImageAndText({
        imagePath: sampleImage,
        description: "Test complaint",
        requestId: "test_staging_env",
      });
    } catch (err) {
      caughtError = err;
    }

    assert(Boolean(caughtError), "Error was thrown when NODE_ENV is staging");
    assert(caughtError instanceof ApiError, "Caught error is an ApiError");
    assert(caughtError.statusCode === 500, "Status code is 500");
    assert(
      caughtError.message.includes("NODE_ENV must be set strictly to \"development\" or \"production\""),
      `Error requires strict development or production: ${caughtError.message}`
    );
    assert(geminiCalled === false, "Gemini was NOT called");
    assert(mobileNetCalled === false, "MobileNetV3 was NOT called");
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Live Microservice End-to-End Verification (port 8000)
  // --------------------------------------------------------------------------
  console.log("\n[Suite 6] Live Python AI Microservice Integration (port 8000)...");
  // Reset test hooks to use real fetch and real clients
  setMicroserviceFetchForTesting(null);
  setGeminiClientForTesting(null);

  // CASE 9: Live Development Flow with Running Python Microservice
  {
    console.log("  [Case 9] Live Dev: Real MobileNetV3 inference on port 8000");
    process.env.NODE_ENV = "development";

    startLogCapture();
    const liveResult = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: "Severe stormwater drainage blockage and overflowing sewage",
      requestId: "test_live_dev_strict",
    });
    const logs = stopLogCapture();

    assert(Boolean(liveResult), "Live analysis result returned");
    assert(liveResult.predictionSource === "mobilenet", `Source is mobilenet: got ${liveResult.predictionSource}`);
    assert(liveResult.confidence >= 0.70, `Confidence is high: got ${(liveResult.confidence * 100).toFixed(1)}%`);
    assert(liveResult.fallbackUsed === false, "fallbackUsed is false");
    assert(liveResult.isFallback === false, "isFallback is false");
    assert(liveResult.modelVersion === "1.11.0-drainage-v9", `Model version verified: ${liveResult.modelVersion}`);
    assert(logs.some((l) => l.includes("Environment: development")), "Logged Environment: development");
    assert(logs.some((l) => l.includes("Selected provider: MobileNetV3")), "Logged Selected provider: MobileNetV3");
    assert(logs.some((l) => l.includes("MobileNetV3 classification successful")), "Logged MobileNetV3 classification successful");
    console.log(`    -> Live Prediction: Category=${liveResult.category}, Conf=${(liveResult.confidence * 100).toFixed(1)}%, ModelVersion=${liveResult.modelVersion}`);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n================================================================");
  console.log(` ALL STRICT PRIORITY TESTS PASSED: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("================================================================\n");

  if (testsFailed > 0) {
    throw new Error(`Test suite failed with ${testsFailed} failure(s)`);
  }
}

runStrictPriorityTestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});
