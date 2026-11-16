/**
 * Comprehensive Automated Verification Suite for
 * Gemini 6-Category & Subcategory Validation
 *
 * Requirements Tested:
 * 1. Gemini classification prompt includes all six main categories and their subcategory mappings.
 * 2. Gemini predicts both category and valid subcategory for all six main categories:
 *    - Drainage (Blocked Drain, Drainage Overflow, Sewage Leakage)
 *    - Other (General Issue, Other)
 *    - Roads (Pothole, Damaged Road, Broken Footpath)
 *    - Street Light (Street Light Not Working, Street Light Damaged, etc.)
 *    - Waste Management (Garbage Dump, Overflowing Dustbin, Illegal Waste Disposal)
 *    - Water Supply (Water Leakage, Pipeline Damage, Water Supply Issue)
 * 3. Gemini returning "NA" or "N/A" is validated and resolved to a valid subcategory (never "NA").
 * 4. Case-insensitive subcategory matching (e.g. "pothole" -> "Pothole").
 * 5. Full response structure preservation (category, subcategory, predictedCategory, predictedSubcategory, priority, confidence, department, etc.).
 */

import fs from "fs";
import path from "path";
import {
  analyzeComplaintImageAndText,
  SIX_MAIN_CATEGORIES,
  validateAndResolveSubcategory,
  setGeminiClientForTesting,
  setMicroserviceFetchForTesting,
} from "./src/services/aiService.js";
import { COMPLAINT_CATEGORIES } from "./src/models/complaints.model.js";

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

// Find a real test image
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

// Mock factory for Gemini client capturing prompt and returning responses
function createMockGeminiClient({ responseText, onPrompt }) {
  return {
    models: {
      generateContent: async ({ model, contents }) => {
        if (onPrompt && contents && contents[0]?.parts) {
          onPrompt(contents[0].parts.map((p) => p.text).filter(Boolean).join("\n"));
        }
        return {
          text: responseText,
        };
      },
    },
  };
}

async function runGeminiSubcategoriesTestSuite() {
  console.log("==================================================================");
  console.log(" GEMINI 6-CATEGORY & SUBCATEGORY VALIDATION TEST SUITE");
  console.log("==================================================================\n");

  const sampleImage = findSampleImage();
  assert(Boolean(sampleImage && fs.existsSync(sampleImage)), `Sample image verified: ${sampleImage}`);

  process.env.NODE_ENV = "production";
  process.env.GEMINI_API_KEY = "test_key_for_mocking";

  // Prevent any microservice calls
  setMicroserviceFetchForTesting(async () => {
    throw new Error("MobileNetV3 must not be called in production");
  });

  // ----------------------------------------------------------------------------
  // SUITE 1: Prompt Content Verification
  // ----------------------------------------------------------------------------
  console.log("\n[Suite 1] Verifying Gemini Prompt Contains All 6 Categories & Subcategories...");
  let capturedPrompt = "";
  setGeminiClientForTesting(
    createMockGeminiClient({
      onPrompt: (promptText) => {
        capturedPrompt = promptText;
      },
      responseText: JSON.stringify({
        category: "Drainage",
        subcategory: "Blocked Drain",
        priority: "HIGH",
        confidence: 0.95,
        reason: "Blocked stormwater drain",
      }),
    })
  );

  await analyzeComplaintImageAndText({
    imagePath: sampleImage,
    description: "Inspection prompt test",
    requestId: "test_prompt_inspection",
  });

  for (const cat of SIX_MAIN_CATEGORIES) {
    assert(capturedPrompt.includes(cat), `Prompt includes main category: ${cat}`);
    const allowedSubs = COMPLAINT_CATEGORIES[cat];
    for (const sub of allowedSubs) {
      assert(capturedPrompt.includes(sub), `Prompt includes subcategory '${sub}' for category '${cat}'`);
    }
  }
  assert(capturedPrompt.includes('Never return "NA"'), 'Prompt explicitly warns against returning "NA"');

  // ----------------------------------------------------------------------------
  // SUITE 2: End-to-End Prediction Verification for All 6 Main Categories
  // ----------------------------------------------------------------------------
  console.log("\n[Suite 2] Testing Production Gemini Predictions Across All 6 Main Categories...");

  const testCases = [
    {
      category: "Drainage",
      subcategory: "Drainage Overflow",
      description: "Severe stormwater drain overflowing onto public road",
      priority: "CRITICAL",
      confidence: 0.97,
    },
    {
      category: "Roads",
      subcategory: "Pothole",
      description: "Deep dangerous crater on 4th cross street",
      priority: "HIGH",
      confidence: 0.94,
    },
    {
      category: "Street Light",
      subcategory: "Street Light Pole Damaged",
      description: "Bent street light pole tilted dangerously",
      priority: "HIGH",
      confidence: 0.92,
    },
    {
      category: "Waste Management",
      subcategory: "Overflowing Dustbin",
      description: "Community trash bin overflowing with rotten garbage",
      priority: "HIGH",
      confidence: 0.96,
    },
    {
      category: "Water Supply",
      subcategory: "Pipeline Damage",
      description: "Drinking water main pipeline cracked and gushing water",
      priority: "CRITICAL",
      confidence: 0.98,
    },
    {
      category: "Other",
      subcategory: "General Issue",
      description: "General administrative civic inquiry",
      priority: "LOW",
      confidence: 0.85,
    },
  ];

  for (const tc of testCases) {
    console.log(`  -> Testing ${tc.category} with predicted subcategory "${tc.subcategory}"...`);

    setGeminiClientForTesting(
      createMockGeminiClient({
        responseText: JSON.stringify({
          category: tc.category,
          subcategory: tc.subcategory,
          priority: tc.priority,
          confidence: tc.confidence,
          reason: `Visual confirmation of ${tc.subcategory}`,
        }),
      })
    );

    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: tc.description,
      requestId: `test_cat_${tc.category.toLowerCase().replace(/\s+/g, "_")}`,
    });

    assert(result.category === tc.category, `Category is correctly ${tc.category}`);
    assert(result.predictedCategory === tc.category, `predictedCategory is correctly ${tc.category}`);
    assert(result.subcategory === tc.subcategory, `subcategory is correctly ${tc.subcategory} (not NA)`);
    assert(result.predictedSubcategory === tc.subcategory, `predictedSubcategory is correctly ${tc.subcategory}`);
    assert(COMPLAINT_CATEGORIES[tc.category].includes(result.subcategory), `Returned subcategory belongs to ${tc.category} schema`);
    assert(result.confidence === tc.confidence, `Confidence preserved at ${tc.confidence}`);
    assert(result.predictionSource === "gemini_vision", "predictionSource is gemini_vision");
    assert(result.fallbackUsed === false, "fallbackUsed is false");
    assert(result.isFallback === false, "isFallback is false");
    assert(Boolean(result.department), `Department routed: ${result.department}`);
  }

  // ----------------------------------------------------------------------------
  // SUITE 3: Handling Gemini returning "NA" or "N/A" (The Previous Defect)
  // ----------------------------------------------------------------------------
  console.log('\n[Suite 3] Testing Protection Against Gemini Returning "NA" / "N/A"...');

  for (const cat of SIX_MAIN_CATEGORIES) {
    console.log(`  -> Testing ${cat} when Gemini outputs "NA"...`);

    setGeminiClientForTesting(
      createMockGeminiClient({
        responseText: JSON.stringify({
          category: cat,
          subcategory: "NA", // The previous bug
          priority: "HIGH",
          confidence: 0.91,
          reason: "Identified category but returned NA subcategory",
        }),
      })
    );

    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: `Report for ${cat} defect`,
      requestId: `test_na_${cat.toLowerCase().replace(/\s+/g, "_")}`,
    });

    assert(result.category === cat, `Category matches ${cat}`);
    assert(result.subcategory !== "NA" && result.subcategory !== "N/A", `Subcategory is NOT "NA" (got "${result.subcategory}")`);
    assert(result.predictedSubcategory !== "NA", `predictedSubcategory is NOT "NA" (got "${result.predictedSubcategory}")`);
    assert(
      COMPLAINT_CATEGORIES[cat].includes(result.subcategory),
      `Resolved subcategory "${result.subcategory}" is a valid schema member of ${cat}`
    );
  }

  // ----------------------------------------------------------------------------
  // SUITE 4: Case-Insensitive Subcategory Normalization
  // ----------------------------------------------------------------------------
  console.log("\n[Suite 4] Testing Case-Insensitive Normalization...");

  const caseInsensitiveCases = [
    { cat: "Roads", rawSub: "pothole", expected: "Pothole" },
    { cat: "Drainage", rawSub: "blocked drain", expected: "Blocked Drain" },
    { cat: "Waste Management", rawSub: "garbage dump", expected: "Garbage Dump" },
    { cat: "Street Light", rawSub: "street light flickering", expected: "Street Light Flickering" },
    { cat: "Water Supply", rawSub: "water leakage", expected: "Water Leakage" },
  ];

  for (const cic of caseInsensitiveCases) {
    setGeminiClientForTesting(
      createMockGeminiClient({
        responseText: JSON.stringify({
          category: cic.cat,
          subcategory: cic.rawSub,
          priority: "MEDIUM",
          confidence: 0.88,
        }),
      })
    );

    const result = await analyzeComplaintImageAndText({
      imagePath: sampleImage,
      description: `Testing case normalization for ${cic.cat}`,
      requestId: `test_case_${cic.cat}`,
    });

    assert(
      result.subcategory === cic.expected,
      `Normalized "${cic.rawSub}" -> "${cic.expected}": got "${result.subcategory}"`
    );
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log("\n==================================================================");
  console.log(` ALL GEMINI SUBCATEGORY TESTS PASSED: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("==================================================================\n");

  if (testsFailed > 0) {
    throw new Error(`Test suite failed with ${testsFailed} failure(s)`);
  }
}

runGeminiSubcategoriesTestSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

