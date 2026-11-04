// Shared payment request validation.
import { AppError } from "../../utils/errors.js";

export const PAYMENT_METHODS = ["stripe", "payhere"];
const ORDER_NUMBER = /^[A-Z]{2,4}-[A-Z0-9]{3,15}$/; // e.g. HA-94281
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/; // the frontend sends crypto.randomUUID()
const REFERENCE = /^PAY-[A-Z0-9]{8}$/;

// body: { orderId, method, idempotencyKey }
export function validateInitiate(body = {}) {
  const errors = [];
  const orderNumber = typeof body.orderId === "string" ? body.orderId.trim().toUpperCase() : "";
  const { method, idempotencyKey } = body;

  if (!ORDER_NUMBER.test(orderNumber)) errors.push({ field: "orderId", message: "must be an order number, e.g. HA-94281" });
  if (!PAYMENT_METHODS.includes(method)) {
    errors.push({ field: "method", message: `must be one of: ${PAYMENT_METHODS.join(", ")}` });
  }
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
    errors.push({ field: "idempotencyKey", message: "must be 16–100 letters, numbers, - or _ (use a UUID)" });
  }

  if (errors.length) throw AppError.badRequest("Invalid payment request", errors);
  return { orderNumber, method, idempotencyKey };
}

export function validateReference(reference) {
  if (!REFERENCE.test(reference ?? "")) throw AppError.notFound("Payment not found");
  return reference;
}
