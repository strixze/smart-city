import { Router } from "express";
import { analyzeCivicIssue, getAiStatus } from "../controllers/ai.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

router.get("/health", getAiStatus);
router.post("/analyze", authenticate, upload.single("image"), analyzeCivicIssue);

export default router;
