// Admin analytics routes (Member 8).
import express from "express";
import * as analyticsController from "./analytics.controller.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = express.Router();

router.get("/dashboard", requireAdmin, analyticsController.getDashboard);
router.get("/export.csv", requireAdmin, analyticsController.exportSalesCsv);

export default router;
