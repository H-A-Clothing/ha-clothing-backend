// Stripe payment request and response handling.
import * as service from "./payments-stripe.service.js";
import { validateCancel, validateWebhook } from "./payments-stripe.validation.js";

// Express 4 doesn't catch errors from async handlers, so pass them to the error middleware.
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);

// Stripe retries until it gets a 2xx, so reply 200 once the event is stored (repeats included).
export const webhook = handle(async (req, res) => {
  const { rawBody, signature } = validateWebhook(req);
  await service.handleWebhook(rawBody, signature);
  res.json({ received: true });
});

export const cancel = handle(async (req, res) => {
  const reference = validateCancel(req.body);
  res.json(await service.cancelCheckout(reference));
});
