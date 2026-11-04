// Shared payment request and response handling.
import { AppError } from "../../utils/errors.js";
import * as stripe from "../payments-stripe/payments-stripe.service.js";
import * as service from "./payments.service.js";
import { validateInitiate, validateReference } from "./payments.validation.js";

// Express 4 doesn't catch errors from async handlers, so pass them to the error middleware.
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);

// Each provider starts a payment and returns { reference, status, redirectUrl? | payhere? }.
// Member 2 adds payhere here once checkout/payhere.service.js exports its start function.
const PROVIDERS = {
  stripe: stripe.startCheckout,
};

export const initiate = handle(async (req, res) => {
  const { orderNumber, method, idempotencyKey } = validateInitiate(req.body);
  const start = PROVIDERS[method];
  if (!start) throw new AppError(501, `${method} payments are not available yet`);
  res.json(await start({ orderNumber, idempotencyKey }));
});

export const getStatus = handle(async (req, res) => {
  const reference = validateReference(req.params.reference);
  res.json(await service.getPaymentStatus(reference));
});
