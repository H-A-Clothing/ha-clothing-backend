// Shared payment service (Members 1 and 2).
// Stripe (payments-stripe) and PayHere (checkout/payhere) write to the payments table ONLY through these
// functions, so the duplicate-payment rules live in one place:
//   - one idempotency key = one payment attempt (a retried request gets the same attempt back)
//   - an order that is already paid can't start a new payment
//   - each provider event is applied once (unique provider + event id)
//   - payment and order are updated in one transaction
import { randomBytes } from "node:crypto";
import { pool, withTransaction } from "../../config/database.js";
import { AppError } from "../../utils/errors.js";
import * as repo from "./payments.repository.js";

export const PAYMENT_STATUS = {
  PENDING: "pending",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
};

const DELIVERY_DAYS = { standard: [3, 5], express: [1, 2], pickup: [1, 2] };

// e.g. PAY-7Q3K9X2M. Random, so references can't be guessed by counting.
function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return `PAY-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

/**
 * Starts (or returns) a payment attempt for an order.
 * The amount is always the order total from the database, never a value from the browser.
 * Returns { payment, order, created, otherPending } — `created` is false when the idempotency key was seen before.
 */
export async function createPayment({ orderNumber, provider, idempotencyKey }) {
  return withTransaction(async (tx) => {
    const order = await repo.findOrderForUpdate(tx, orderNumber);
    if (!order) throw AppError.notFound("Order not found");

    const existing = await repo.findPaymentByIdempotencyKey(tx, idempotencyKey);
    if (existing) {
      if (existing.order_id !== order.id || existing.provider !== provider) {
        throw AppError.conflict("This idempotency key belongs to a different payment");
      }
      return { payment: existing, order, created: false, otherPending: [] };
    }

    if (order.status === "paid" || (await repo.hasSucceededPayment(tx, order.id))) {
      throw AppError.conflict("Order already paid");
    }
    if (order.status !== "pending_payment") {
      throw AppError.conflict(`This order can't be paid (status: ${order.status})`);
    }

    const payment = await repo.insertPayment(tx, {
      reference: newReference(),
      orderId: order.id,
      provider,
      idempotencyKey,
      amount: order.total,
      currency: order.currency,
    });
    const otherPending = await repo.findOtherPendingPayments(tx, order.id, payment.id);
    return { payment, order, created: true, otherPending };
  });
}

// Small updates made by a provider module outside a callback (e.g. saving the Stripe session id).
export function updatePayment(paymentId, fields) {
  return repo.updatePayment(pool, paymentId, fields);
}

/**
 * Applies a verified provider callback (Stripe webhook / PayHere notify) in ONE transaction:
 *   1. store the event in payment_events (a repeated event is ignored)
 *   2. update the payment
 *   3. on success, mark the order paid
 * `outcome` is { status, cardBrand?, cardLast4?, providerFee?, providerPaymentId?, failureReason? },
 * or null to only log the event.
 * `refund()` is called when money arrives for an order that is already paid; it must refund at the provider.
 * Returns { duplicate: true } for a repeated event, otherwise { status } (the payment's final status).
 */
export async function recordProviderEvent({ provider, providerEventId, eventType, payload, reference, outcome, refund }) {
  return withTransaction(async (tx) => {
    const payment = reference ? await repo.findPaymentByReference(tx, reference, { forUpdate: true }) : null;

    const eventId = await repo.insertEvent(tx, {
      paymentId: payment?.id ?? null,
      provider,
      providerEventId,
      eventType,
      signatureValid: true, // callers verify the signature before calling this
      payload,
    });
    if (!eventId) return { duplicate: true };

    if (!payment || !outcome) {
      await repo.markEventProcessed(tx, eventId);
      return { status: payment?.status ?? null };
    }

    const status = await applyOutcome(tx, payment, outcome, refund);
    await repo.markEventProcessed(tx, eventId);
    return { status };
  });
}

async function applyOutcome(tx, payment, outcome, refund) {
  if (payment.status === PAYMENT_STATUS.SUCCEEDED || payment.status === PAYMENT_STATUS.REFUNDED) {
    return payment.status; // final; late events can't change it
  }

  if (outcome.status !== PAYMENT_STATUS.SUCCEEDED) {
    // A late "expired"/"failed" event must not overwrite a payment that was already closed.
    if (payment.status !== PAYMENT_STATUS.PENDING) return payment.status;
    await repo.updatePayment(tx, payment.id, {
      status: outcome.status,
      failureReason: outcome.failureReason,
      providerPaymentId: outcome.providerPaymentId,
    });
    return outcome.status;
  }

  // Money was taken. Lock the order so two successful callbacks can't both mark it paid.
  const order = await repo.lockOrderById(tx, payment.order_id);
  const alreadyPaid = order.status !== "pending_payment" || (await repo.hasSucceededPayment(tx, order.id));

  if (alreadyPaid) {
    // e.g. the customer paid in two browser tabs. Give the second payment back.
    if (refund) {
      await refund();
      await repo.updatePayment(tx, payment.id, {
        status: PAYMENT_STATUS.REFUNDED,
        refundedAmount: payment.amount,
        providerPaymentId: outcome.providerPaymentId,
        failureReason: "Duplicate payment for an order that was already paid. Refunded automatically.",
      });
      return PAYMENT_STATUS.REFUNDED;
    }
    await repo.updatePayment(tx, payment.id, {
      status: PAYMENT_STATUS.FAILED,
      providerPaymentId: outcome.providerPaymentId,
      failureReason: "Duplicate payment for an order that was already paid. Refund it at the provider.",
    });
    return PAYMENT_STATUS.FAILED;
  }

  await repo.updatePayment(tx, payment.id, {
    status: PAYMENT_STATUS.SUCCEEDED,
    providerPaymentId: outcome.providerPaymentId,
    cardBrand: outcome.cardBrand,
    cardLast4: outcome.cardLast4,
    providerFee: outcome.providerFee,
    failureReason: null,
    paidAt: new Date(),
  });
  await repo.markOrderPaid(tx, order.id);
  return PAYMENT_STATUS.SUCCEEDED;
}

export async function findPayment(reference) {
  return repo.findPaymentByReference(pool, reference);
}

// GET /payments/:reference/status
export async function getPaymentStatus(reference) {
  const payment = await repo.findPaymentByReference(pool, reference);
  if (!payment) throw AppError.notFound("Payment not found");

  return {
    reference: payment.reference,
    orderId: payment.order_number,
    method: payment.provider,
    status: payment.status,
    amount: toNumber(payment.amount),
    currency: payment.currency,
    cardLast4: payment.card_last4,
    failureReason: payment.failure_reason,
    paidAt: payment.paid_at,
    order: await getOrder(payment.order_id),
  };
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}

/**
 * The order object shown on the payment, success and failure pages.
 * Same shape as Member 2's GET /orders/:orderId (see docs/payment-api-contract.md), so it can be reused there.
 */
export async function getOrder(orderId) {
  const [order, items] = await Promise.all([repo.findOrderDetails(pool, orderId), repo.findOrderItems(pool, orderId)]);
  if (!order) return null;

  const [from, to] = DELIVERY_DAYS[order.delivery_method] ?? DELIVERY_DAYS.standard;
  const discountAmount = toNumber(order.discount_amount);

  return {
    id: order.order_number,
    status: order.status,
    customer: { name: order.shipping_name, email: order.customer_email },
    shippingAddress: [
      order.shipping_line1,
      order.shipping_line2,
      order.shipping_city,
      [order.shipping_district, order.shipping_postal_code].filter(Boolean).join(" "),
      order.shipping_country,
    ]
      .filter(Boolean)
      .join(", "),
    deliveryMethod: order.delivery_method,
    items: items.map((item) => ({
      id: item.id,
      name: item.product_name,
      collection: item.category_name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: toNumber(item.unit_price),
    })),
    subtotal: toNumber(order.subtotal),
    discount: order.discount_code || discountAmount > 0 ? { code: order.discount_code, amount: discountAmount } : null,
    shippingFee: toNumber(order.shipping_fee),
    tax: toNumber(order.tax_amount),
    total: toNumber(order.total),
    currency: order.currency,
    estimatedDelivery: { from: addDays(order.placed_at, from), to: addDays(order.placed_at, to) },
  };
}
