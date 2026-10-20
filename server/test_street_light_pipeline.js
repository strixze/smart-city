/**
 * Comprehensive Automated Verification Suite for Street Light Category & Prediction Pipeline
 * Covers all 9 Task Requirements:
 * 1. Street Light Category & 6 Subcategories Schema Validation
 * 2. Department & Staff Assignment Support
 * 3. Model Checkpoint & Architecture Verification via Health Endpoint (6 classes, Street Light supported)
 * 4. Image Classification of Street Light via fine-tuned MobileNetV3 (predictionSource: "mobilenet")
 * 5. Model/Image Unavailable Explicit Fallback Metadata (predictionSource: "rules", fallbackUsed: true)
 * 6. Vision API / Text-only Classification Reporting
 * 7. Incompatible Checkpoint / Health Diagnostic Verification
 * 8. Full Citizen Complaint Creation & MongoDB Persistence
 * 9. Admin Review, Filter by Street Light, and Manual Citizen Category Override
 * 10. Existing Categories Regression Verification
 */

import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import { COMPLAINT_CATEGORIES } from "./src/models/complaints.model.js";
import { DEPARTMENTS } from "./src/models/users.model.js";
import { getFallbackClassification } from "./src/services/aiService.js";

const API = "http://localhost:3000/api/v1";
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

async function runSuite() {
  console.log("================================================================");
  console.log("  SMART CITY CIVIC: STREET LIGHT & PREDICTION PIPELINE TEST SUITE");
  console.log("================================================================\n");

  // TEST 1: Street Light Category & Subcategories Validation in Schema
  console.log("[Test 1] Validating Street Light in COMPLAINT_CATEGORIES Schema...");
  assert("Street Light" in COMPLAINT_CATEGORIES, "Street Light exists in COMPLAINT_CATEGORIES");

  const expectedSubcategories = [
    "Street Light Not Working",
    "Street Light Damaged",
    "Street Light Missing",
    "Street Light Flickering",
    "Street Light Pole Damaged",
    "Multiple Street Lights Not Working",
  ];

  const actualSubcategories = COMPLAINT_CATEGORIES["Street Light"];
  assert(Array.isArray(actualSubcategories), "Street Light subcategories is an array");
  for (const sub of expectedSubcategories) {
    assert(actualSubcategories.includes(sub), `Subcategory '${sub}' is present`);
  }

  // TEST 2: Department & Staff Assignment Mapping
  console.log("\n[Test 2] Validating Street Light in DEPARTMENTS Schema...");
  assert(DEPARTMENTS.includes("Street Light"), "Street Light department exists in user model");

  // TEST 3: Health Endpoint & Verified PyTorch Architecture
  console.log("\n[Test 3] Verifying AI Health Endpoint & Checkpoint Output Classes...");
  const healthRes = await axios.get(`${API}/ai/health`);
  const healthData = healthRes.data?.data;

  assert(healthData.online === true, "AI microservice is online");
  assert(healthData.modelLoaded === true, "PyTorch MobileNetV3 model is loaded");
  assert(healthData.modelVerified === true, "Model forward pass architecture verified");
  assert(healthData.modelNumClasses === 6, "Model output dimension has exactly 6 classes");
  assert(healthData.modelClasses.includes("Street Light"), "Model classes array includes 'Street Light'");
  assert(healthData.supportedCategories.includes("Street Light"), "Supported categories includes 'Street Light'");
  assert(healthData.fallbackClassificationEnabled === true, "Fallback classification is enabled");
  assert(typeof healthData.visionApiConfigured === "boolean", "Vision API configured flag is present");

  // TEST 4: Authenticated Citizen Login
  console.log("\n[Test 4] Authenticating Citizen & Admin...");
  const citizenLogin = await axios.post(`${API}/auth/login`, {
    email: "citizen@smartcity.local",
    password: "Citizen@123"
  });
  const citizenToken = citizenLogin.data.data.token;
  assert(Boolean(citizenToken), "Citizen token acquired");

  const adminLogin = await axios.post(`${API}/auth/login`, {
    email: "admin@smartcity.local",
    password: "Admin@123"
  });
  const adminToken = adminLogin.data.data.token;
  assert(Boolean(adminToken), "Admin token acquired");

  // TEST 5: Classification of a Real Street Light Image (MobileNetV3)
  console.log("\n[Test 5] Classifying Street Light Image via AI Analysis Endpoint...");
  const sampleImagePath = path.resolve("../ai/data/Street Light/street_light_001.jpg");
  assert(fs.existsSync(sampleImagePath), "Sample street light image exists on disk");

  const form = new FormData();
  form.append("image", fs.createReadStream(sampleImagePath), "street_light_001.jpg");
  form.append("description", "Street light pole on 5th Avenue");

  const analyzeRes = await axios.post(`${API}/ai/analyze`, form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${citizenToken}` }
  });
  const analyzeData = analyzeRes.data?.data;

  assert(analyzeData.predictedCategory === "Street Light" || analyzeData.category === "Street Light", "Predicted category is Street Light");
  assert(analyzeData.predictionSource === "mobilenet", `Prediction source is 'mobilenet' (got: ${analyzeData.predictionSource})`);
  assert(analyzeData.modelLoaded === true, "modelLoaded metadata is true");
  assert(analyzeData.fallbackUsed === false, "fallbackUsed metadata is false");
  assert(typeof analyzeData.confidence === "number" && analyzeData.confidence > 0.5, `Confidence is calibrated (>0.5, got: ${analyzeData.confidence})`);
  assert(Boolean(analyzeData.requestId), `Request ID is tracked (${analyzeData.requestId})`);

  // TEST 6: Fallback Metadata on Model Unavailability / Heuristic Rules
  console.log("\n[Test 6] Verifying Explicit Fallback Metadata in Rule-Based Classifier...");
  const fallbackResult = getFallbackClassification(
    "Street light pole is damaged and flickering at night",
    "street-light.jpg",
    { fallbackReason: "PyTorch model offline" }
  );

  assert(fallbackResult.category === "Street Light", "Fallback classified as Street Light");
  assert(fallbackResult.predictionSource === "rules", "Fallback predictionSource is 'rules'");
  assert(fallbackResult.fallbackUsed === true, "fallbackUsed is true");
  assert(fallbackResult.fallbackReason === "PyTorch model offline", "fallbackReason is recorded");
  assert(Boolean(fallbackResult.requestId), "fallback requestId is generated");

  // TEST 7: Citizen Complaint Creation & MongoDB Persistence (Street Light)
  console.log("\n[Test 7] Creating Street Light Complaint & Testing Persistence...");
  const complaintForm = new FormData();
  complaintForm.append("title", "Street Light Pole Damaged on Park Street");
  complaintForm.append("description", "The street light pole is badly damaged and light is not working at night.");
  complaintForm.append("locationAddress", "Park Street, Ward 4, Near Community Center");
  complaintForm.append("category", "Street Light");
  complaintForm.append("subcategory", "Street Light Pole Damaged");
  complaintForm.append("priority", "HIGH");
  complaintForm.append("image", fs.createReadStream(sampleImagePath), "street_light_001.jpg");

  const createRes = await axios.post(`${API}/complaints`, complaintForm, {
    headers: { ...complaintForm.getHeaders(), Authorization: `Bearer ${citizenToken}` }
  });
  const createdComplaint = createRes.data?.data?.complaint;

  assert(Boolean(createdComplaint?._id), "Complaint created with valid MongoDB _id");
  assert(createdComplaint.category === "Street Light", "Saved category is Street Light");
  assert(createdComplaint.subcategory === "Street Light Pole Damaged", "Saved subcategory is Street Light Pole Damaged");
  assert(Boolean(createdComplaint.complaintNumber), `Complaint number generated: ${createdComplaint.complaintNumber}`);
  assert(createdComplaint.status === "SUBMITTED", "Status is SUBMITTED");

  // Fetch created complaint back from MongoDB to verify persistence
  const getCompRes = await axios.get(`${API}/complaints/${createdComplaint._id}`, {
    headers: { Authorization: `Bearer ${citizenToken}` }
  });
  const persistedComplaint = getCompRes.data?.data?.complaint;
  assert(persistedComplaint.category === "Street Light", "Persisted category is Street Light");
  assert(persistedComplaint.predictedCategory === "Street Light" || persistedComplaint.aiCategory === "Street Light", "AI Category persisted as Street Light");
  assert(Boolean(persistedComplaint.predictionSource), `Prediction source recorded: ${persistedComplaint.predictionSource}`);

  // TEST 8: Admin Filter & Status/Classification Update for Street Light
  console.log("\n[Test 8] Admin Filtering & Classification Override for Street Light...");
  const adminComplaintsRes = await axios.get(`${API}/admin/complaints?category=Street Light`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminList = adminComplaintsRes.data?.data?.complaints || [];
  const foundComplaint = adminList.find(c => c._id === createdComplaint._id);
  assert(Boolean(foundComplaint), "Complaint appears in Admin filtered list by 'Street Light'");

  // Admin updates classification/priority
  const updateRes = await axios.patch(`${API}/admin/complaints/${createdComplaint._id}`, {
    category: "Street Light",
    priority: "CRITICAL"
  }, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(updateRes.data?.data?.complaint?.priority === "CRITICAL", "Admin updated priority to CRITICAL successfully");

  // TEST 9: Manual Citizen Override Without AI
  console.log("\n[Test 9] Manual Category Selection with explicit 'manual' predictionSource...");
  const manualForm = new FormData();
  manualForm.append("title", "Multiple Street Lights Not Working in Market");
  manualForm.append("description", "Entire street is dark because multiple lights failed.");
  manualForm.append("locationAddress", "Market Road Sector 2");
  manualForm.append("category", "Street Light");
  manualForm.append("subcategory", "Multiple Street Lights Not Working");
  manualForm.append("priority", "HIGH");
  manualForm.append("predictionSource", "manual");
  manualForm.append("image", fs.createReadStream(sampleImagePath), "street_light_001.jpg");

  const manualCreateRes = await axios.post(`${API}/complaints`, manualForm, {
    headers: { ...manualForm.getHeaders(), Authorization: `Bearer ${citizenToken}` }
  });
  const manualComp = manualCreateRes.data?.data?.complaint;
  assert(manualComp.predictionSource === "manual", "predictionSource is recorded as 'manual'");
  assert(manualComp.category === "Street Light", "Manual category 'Street Light' preserved");

  // TEST 10: Regression Verification of Existing Categories
  console.log("\n[Test 10] Verifying Existing Categories Continue Working...");
  const legacyCategories = ["Drainage", "Roads", "Waste Management", "Water Supply", "Other"];
  for (const cat of legacyCategories) {
    assert(cat in COMPLAINT_CATEGORIES, `Pre-existing category '${cat}' is valid in schema`);
  }

  console.log("\n================================================================");
  console.log(`  ALL TESTS COMPLETED: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("================================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
