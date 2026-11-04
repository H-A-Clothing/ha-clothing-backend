// Stripe payment URL paths, mounted at /api/v1/payments/stripe.
// Starting a payment and reading its status are shared: see modules/payments.
import { Router } from "express";
import * as controller from "./payments-stripe.controller.js";

const router = Router();

router.post("/webhook", controller.webhook); // called by Stripe, body is raw (see app.js)
router.post("/cancel", controller.cancel); // called by the failure page after "back" on Stripe

export default router;
