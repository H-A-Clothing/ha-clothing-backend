// Stripe payment request validation.
import { AppError } from "../../utils/errors.js";
import { validateReference } from "../payments/payments.validation.js";

// body: { reference }
export function validateCancel(body = {}) {
  return validateReference(body.reference);
}

// The webhook needs the raw bytes (see app.js) and Stripe's signature header.
export function validateWebhook(req) {
  const signature = req.headers["stripe-signature"];
  if (!Buffer.isBuffer(req.body) || !signature) throw AppError.badRequest("Invalid Stripe signature");
  return { rawBody: req.body, signature };
}
