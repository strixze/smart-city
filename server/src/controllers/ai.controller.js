import { analyzeComplaintImageAndText, getAiHealth } from "../services/aiService.js";
import { ApiResponse } from "../utils/apiUtils.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const analyzeCivicIssue = asyncHandler(async (req, res) => {
  const { description, requestId } = req.body;
  const imagePath = req.file ? req.file.path : null;

  const result = await analyzeComplaintImageAndText({
    imagePath,
    description: description || "",
    requestId: req.headers["x-request-id"] || requestId || null
  });

  res.status(200).json(
    new ApiResponse(200, result, "AI classification completed.")
  );
});

export const getAiStatus = asyncHandler(async (req, res) => {
  const health = await getAiHealth();
  res.status(200).json(
    new ApiResponse(200, health, "AI health status retrieved.")
  );
});
