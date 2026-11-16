import { Router } from "express";
import {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getComplaintHotspots,
  confirmResolution,
  reopenComplaint,
  getCitizenDashboard,
  testComplaintImageAuthenticity
} from "../controllers/complaint.controller.js";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

router.use(authenticate);

// Hotspot map data (accessible by CITIZEN, STAFF, ADMIN with role-based scoping)
router.get("/map/hotspots", getComplaintHotspots);

// Citizen Routes
router.post("/", authorizeRoles("CITIZEN"), upload.single("image"), createComplaint);
router.get("/my", authorizeRoles("CITIZEN"), getMyComplaints);
router.get("/dashboard", authorizeRoles("CITIZEN"), getCitizenDashboard);

// Details viewable by Citizen, Staff, Admin
router.get("/:id", getComplaintById);

// Resolution confirmation and reopening
router.post("/:id/confirm", authorizeRoles("CITIZEN"), confirmResolution);
router.post("/:id/reopen", authorizeRoles("CITIZEN"), reopenComplaint);

// On-Demand AI Image Authenticity Test (strictly manual button click)
router.post("/:id/image-authenticity-test", testComplaintImageAuthenticity);

export default router;
