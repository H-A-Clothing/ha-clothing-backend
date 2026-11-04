// Stripe payment business rules (Member 1): Stripe Checkout (hosted payment page) and its webhook.
// Card details are typed on Stripe's page, so they never reach our server.
// All payments-table writes go through the shared payments service.
import Stripe from "stripe";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import * as payments from "../payments/payments.service.js";

const { PAYMENT_STATUS } = payments;
const CHECKOUT_LIFETIME_MINUTES = 60; // Stripe allows 30 minutes to 24 hours

let client;
function stripe() {
  if (!env.stripe.secretKey?.startsWith("sk_")) {
    throw new AppError(503, "Stripe is not configured. Add STRIPE_SECRET_KEY to the backend .env file.");
  }
  client ??= new Stripe(env.stripe.secretKey);
  return client;
}

// Stripe counts money in the smallest unit (cents): 322.50 -> 32250.
const toMinorUnits = (amount) => Math.round(Number(amount) * 100);

function checkoutResponse(payment, redirectUrl = null, status = payment.status) {
  return { reference: payment.reference, status, redirectUrl };
}

async function createSession(payment, order) {
  const reference = payment.reference;
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      client_reference_id: reference,
      customer_email: order.customer_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: payment.currency.toLowerCase(),
            // The whole order total from the database (items, delivery, tax and discount are already in it).
            unit_amount: toMinorUnits(payment.amount),
            product_data: { name: `H&A Clothing order ${order.order_number}` },
          },
        },
      ],
      metadata: { reference, orderNumber: order.order_number },
      payment_intent_data: { metadata: { reference, orderNumber: order.order_number } },
      success_url: `${env.frontendUrl}/payment/success?ref=${reference}`,
      cancel_url: `${env.frontendUrl}/payment/failure?ref=${reference}&cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_MINUTES * 60,
    },
    // Stripe's own duplicate protection: a retried request returns the same session.
    { idempotencyKey: `checkout-${reference}` }
  );

  await payments.updatePayment(payment.id, { providerPaymentId: session.id });
  return session;
}

// Closes an open Stripe page. Returns false when it can't be closed (it was already paid or expired).
async function expireSession(payment, reason) {
  try {
    await stripe().checkout.sessions.expire(payment.provider_payment_id);
  } catch {
    return false; // the webhook will report what really happened
  }
  await payments.updatePayment(payment.id, { status: PAYMENT_STATUS.CANCELLED, failureReason: reason });
  return true;
}

function stripeUnavailable(error) {
  if (error instanceof AppError) return error;
  console.error("Stripe request failed:", error.message);
  return new AppError(502, "We couldn't reach Stripe. Please try again.");
}

// POST /payments/initiate with method "stripe" -> { reference, status, redirectUrl }
export async function startCheckout({ orderNumber, idempotencyKey }) {
  const { payment, order, created, otherPending } = await payments.createPayment({
    orderNumber,
    provider: "stripe",
    idempotencyKey,
  });

  try {
    if (!created) return await resumeCheckout(payment, order);

    // Close older open Stripe pages for this order (e.g. another browser tab), so it can't be paid twice.
    const olderStripePages = otherPending.filter(
      (other) => other.provider === "stripe" && other.provider_payment_id?.startsWith("cs_")
    );
    await Promise.all(olderStripePages.map((other) => expireSession(other, "Replaced by a newer payment attempt")));

    const session = await createSession(payment, order);
    return checkoutResponse(payment, session.url);
  } catch (error) {
    // The payment row stays "pending", so retrying with the same idempotency key tries Stripe again.
    throw stripeUnavailable(error);
  }
}

// Same idempotency key again (double click, refresh, back button): send the customer to the same Stripe page.
async function resumeCheckout(payment, order) {
  if (payment.status !== PAYMENT_STATUS.PENDING) return checkoutResponse(payment);
  if (!payment.provider_payment_id) {
    const session = await createSession(payment, order); // the first attempt didn't reach Stripe
    return checkoutResponse(payment, session.url);
  }

  const session = await stripe().checkout.sessions.retrieve(payment.provider_payment_id);
  if (session.status === "open") return checkoutResponse(payment, session.url);
  if (session.status === "expired") {
    await payments.updatePayment(payment.id, {
      status: PAYMENT_STATUS.CANCELLED,
      failureReason: "The payment page expired before payment.",
    });
    return checkoutResponse(payment, null, PAYMENT_STATUS.CANCELLED);
  }
  return checkoutResponse(payment); // complete: the webhook is on its way, the success page waits for it
}

// POST /payments/stripe/cancel — the customer pressed "back" on Stripe's page.
export async function cancelCheckout(reference) {
  const payment = await payments.findPayment(reference);
  if (!payment || payment.provider !== "stripe") throw AppError.notFound("Payment not found");

  if (payment.status === PAYMENT_STATUS.PENDING && payment.provider_payment_id?.startsWith("cs_")) {
    try {
      await expireSession(payment, "Cancelled on the Stripe payment page.");
    } catch (error) {
      throw stripeUnavailable(error);
    }
  }
  return payments.getPaymentStatus(reference);
}

// Card brand, last 4 digits and Stripe's fee, read from the PaymentIntent.
async function paidOutcome(session) {
  const intent = await stripe().paymentIntents.retrieve(session.payment_intent, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = intent.latest_charge;
  const card = charge?.payment_method_details?.card;
  const balance = charge?.balance_transaction;
  const feeInSameCurrency = balance && balance.currency === session.currency;

  return {
    status: PAYMENT_STATUS.SUCCEEDED,
    providerPaymentId: intent.id,
    cardBrand: card?.brand,
    cardLast4: card?.last4,
    providerFee: feeInSameCurrency ? balance.fee / 100 : undefined,
  };
}

async function outcomeFor(event) {
  const session = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
      // Cards are "paid" straight away; slower methods report later with async_payment_succeeded.
      return session.payment_status === "paid" ? paidOutcome(session) : null;
    case "checkout.session.async_payment_succeeded":
      return paidOutcome(session);
    case "checkout.session.async_payment_failed":
      return { status: PAYMENT_STATUS.FAILED, failureReason: "The payment was declined." };
    case "checkout.session.expired":
      return { status: PAYMENT_STATUS.CANCELLED, failureReason: "The payment page expired before payment." };
    default:
      return null; // logged only
  }
}

// POST /payments/stripe/webhook
export async function handleWebhook(rawBody, signature) {
  if (!env.stripe.webhookSecret?.startsWith("whsec_")) {
    throw new AppError(503, "Stripe webhooks are not configured. Add STRIPE_WEBHOOK_SECRET to the backend .env file.");
  }

  let event;
  try {
    // Proves the request really came from Stripe and wasn't changed on the way.
    event = stripe().webhooks.constructEvent(rawBody, signature, env.stripe.webhookSecret);
  } catch {
    throw AppError.badRequest("Invalid Stripe signature");
  }

  const object = event.data.object;
  const reference = object.client_reference_id ?? object.metadata?.reference ?? null;
  const outcome = reference ? await outcomeFor(event) : null;

  return payments.recordProviderEvent({
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    payload: event,
    reference,
    outcome,
    refund: outcome?.providerPaymentId
      ? () =>
          stripe().refunds.create(
            { payment_intent: outcome.providerPaymentId },
            { idempotencyKey: `refund-${reference}` }
          )
      : undefined,
  });
}
