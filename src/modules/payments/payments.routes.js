// Shared payment URL paths, mounted at /api/v1/payments.
// Provider callbacks live in their own modules: /payments/stripe/* (M1), /payments/payhere/* (M2).
import { Router } from "express";
import * as controller from "./payments.controller.js";

const router = Router();

router.post("/initiate", controller.initiate);
router.get("/:reference/status", controller.getStatus);

export default router;
