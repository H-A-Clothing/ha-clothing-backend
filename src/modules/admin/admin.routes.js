// Admin URL paths for roles, staff management, and admin profile (Member 8).
import express from "express";
import * as adminController from "./admin.controller.js";
import { requireAdmin, requireRole } from "../../middleware/role.middleware.js";

const router = express.Router();

// Only full `admin` users can manage roles and staff assignments.
router.get("/roles", requireRole("admin"), adminController.getRoles);
router.post("/roles", requireRole("admin"), adminController.postRole);
router.patch("/roles/:id", requireRole("admin"), adminController.patchRole);

router.get("/staff", requireRole("admin"), adminController.getStaff);
router.post("/staff", requireRole("admin"), adminController.postStaff);

// Any admin or staff role can view and update their own profile.
router.get("/profile", requireAdmin, adminController.getProfile);
router.patch("/profile", requireAdmin, adminController.patchProfile);

export default router;
