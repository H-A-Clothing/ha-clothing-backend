# Payment API contract

**Status:** agreed in Member 2's checkout handoff (2 Nov 2026). Member 1's side (shared service + Stripe) is built.
**Covers:** how an order gets paid with Stripe (Member 1) or PayHere (Member 2), and how the result reaches
the customer's success/failure page.

## 1. Who owns what

| Part | Owner | Code |
|---|---|---|
| Orders (create, totals, status before payment), `GET /orders/:orderId` | Member 2 | `modules/checkout/` |
| Shared payment service: the only code that writes `payments` and `payment_events` | Members 1 + 2 (written by Member 1) | `modules/payments/payments.service.js` |
| `POST /payments/initiate` and `GET /payments/:reference/status` | Member 1 | `modules/payments/` |
| Stripe Checkout, Stripe webhook, Stripe cancel | Member 1 | `modules/payments-stripe/` |
| PayHere form + PayHere notify callback | Member 2 | `modules/checkout/payhere.service.js` |
| Payment, success and failure pages | Member 1 | frontend `features/payment/` |

## 2. The flow

```
Bag (/cart) ─► Details (/checkout) ─► Review (/checkout/review)          all Member 2
             "Place order" creates the order, status = pending_payment
             │  redirect to /payment?order=HA-10042   (order_number, not the database id)
             ▼
Payment page (M1) ── POST /payments/initiate { orderId, method, idempotencyKey }
             │
     ┌───────┴────────────────────────┐
     ▼ stripe                          ▼ payhere
 redirectUrl → Stripe Checkout     payhere.fields → POST form to PayHere
     │                                  │
     ▼                                  ▼
 Stripe webhook (M1)               PayHere notify (M2)
     └──────────────┬───────────────────┘
                    ▼
  shared service recordProviderEvent(), ONE transaction:
   1. record event in payment_events (ignored if seen before)
   2. payments.status = succeeded | failed | cancelled
   3. orders.status   = paid (only on success)
                    ▼
 Customer returns to /payment/success?ref=… or /payment/failure?ref=…
 Page calls GET /payments/:reference/status (polls while "pending")
```

## 3. Endpoints

All under `/api/v1`. Errors use the shared shape `{ message, details? }`.

### 3.1 `POST /payments/initiate` (Member 1)

Request:
```json
{ "orderId": "HA-10042", "method": "stripe", "idempotencyKey": "6f1c…uuid" }
```
- `orderId` is the **order number** shown to customers (`orders.order_number`), so other orders can't be guessed.
- `idempotencyKey` is created by the frontend once per **payment attempt** and reused on retries of that attempt.

Rules:
- The order must exist (`404`) and be `pending_payment` (`409`).
- The **amount always comes from `orders.total` in the database**, never from the request.
- Same `idempotencyKey` again: the **same** payment comes back (and, for Stripe, the same payment page). No new row.
- An order that is already paid: `409` `"Order already paid"`.
- A new key for an order that still has an open Stripe page (e.g. a second browser tab): the old page is closed.
- If money still arrives twice (race), the second payment is refunded automatically and marked `refunded`.

Response for Stripe:
```json
{ "reference": "PAY-7Q3K9X2M", "status": "pending", "redirectUrl": "https://checkout.stripe.com/c/pay/…" }
```
If the attempt is already closed (`failed`/`cancelled`), `redirectUrl` is `null`: the frontend shows the failure
page and the customer starts a new attempt with a **new** key.

Response for PayHere (PayHere needs an HTML form POST, not a plain link):
```json
{
  "reference": "PAY-7Q3K9X2M",
  "status": "pending",
  "payhere": { "action": "https://sandbox.payhere.lk/pay/checkout", "fields": { "merchant_id": "…", "order_id": "PAY-7Q3K9X2M", "hash": "…" } }
}
```

### 3.2 Provider callbacks (not called by the frontend)

| Endpoint | Owner | Verification |
|---|---|---|
| `POST /payments/stripe/webhook` | Member 1 | Stripe signature header (`STRIPE_WEBHOOK_SECRET`); raw request body |
| `POST /payments/payhere/notify` | Member 2 | PayHere `md5sig` (`PAYHERE_MERCHANT_SECRET`) |

Both call the shared service, which:
- stores the event in `payment_events`. The unique `(provider, provider_event_id)` constraint means a repeated callback is ignored.
- updates the payment and the order **in one transaction**. If anything fails, nothing changes and the provider retries.
- replies `200` once the event is safely stored, so the provider stops retrying.

### 3.3 `POST /payments/stripe/cancel` (Member 1)

Called by the failure page when the customer pressed "back" on Stripe (`?cancelled=1`). Body `{ "reference": "PAY-…" }`.
Closes the Stripe page and marks the payment `cancelled`. Returns the same object as 3.4.

### 3.4 `GET /payments/:reference/status` (Member 1)

Response:
```json
{
  "reference": "PAY-7Q3K9X2M",
  "orderId": "HA-10042",
  "method": "stripe",
  "status": "succeeded",
  "amount": 322,
  "currency": "USD",
  "cardLast4": "4242",
  "failureReason": null,
  "paidAt": "2026-11-04T10:15:00.000Z",
  "order": { "…": "the order object in 3.5" }
}
```
`status` is one of `pending`, `succeeded`, `failed`, `cancelled`, `refunded`. The success page polls while it is
`pending` (the customer can arrive back before the webhook does).

### 3.5 Order object (`GET /orders/:orderId`, Member 2; also inside 3.4)

```js
{
  id: "HA-94281",                 // order_number
  status: "pending_payment",
  customer: { name: "Elena Perera", email: "elena@example.com" },
  shippingAddress: "12 Flower Road, Colombo 07, Colombo 00700, Sri Lanka",
  deliveryMethod: "standard",     // standard | express | pickup
  items: [{ id: 1, name: "Tailored A-Line Midi Dress", collection: "Silk Capsule",
            color: "Lilac Mist", size: "S", quantity: 1, unitPrice: 185 }],
  subtotal: 297,
  discount: { code: "SPRING25", amount: 25 },   // or null
  shippingFee: 0,
  tax: 50,
  total: 322,
  currency: "USD",
  estimatedDelivery: { from: "2026-10-29", to: "2026-11-01" }
}
```
`getOrder(orderId)` in `modules/payments/payments.service.js` already builds this shape from the database, so
`GET /orders/:orderId` can reuse it.

## 4. Status changes

| Event | `payments.status` | `orders.status` |
|---|---|---|
| Initiate | `pending` | stays `pending_payment` |
| Provider confirms payment | `succeeded` | `paid` |
| Provider says payment failed | `failed` | stays `pending_payment` (customer can retry with a new attempt) |
| Customer cancels / page expires | `cancelled` | stays `pending_payment` |
| Second payment for an already-paid order | `refunded` (Stripe, automatic) | stays `paid` |

## 5. Return URLs (frontend)

- Stripe `success_url`: `{FRONTEND_URL}/payment/success?ref={reference}`
- Stripe `cancel_url`: `{FRONTEND_URL}/payment/failure?ref={reference}&cancelled=1`
- PayHere `return_url` / `cancel_url`: the same two pages.

## 6. Adding PayHere (Member 2)

1. In `modules/checkout/payhere.service.js`, export `startPayHere({ orderNumber, idempotencyKey })`:
   call `payments.createPayment({ orderNumber, provider: "payhere", idempotencyKey })`, then return
   `{ reference, status, payhere: { action, fields } }`.
2. Add it to `PROVIDERS` in `modules/payments/payments.controller.js`: `payhere: startPayHere`.
3. In the notify handler, check `md5sig`, then call `payments.recordProviderEvent({ provider: "payhere",
   providerEventId, eventType, payload, reference: order_id, outcome })` with
   `outcome.status` = `succeeded` (status 2), `failed` (-2), `cancelled` (-1), or `null` for pending (0).

## 7. Answers to Member 2's handoff questions

1. **URL:** yes, `/payment?order=<order_number>` (e.g. `HA-94281`). The backend only accepts order numbers.
2. **Currency:** proposal: **USD** everywhere (orders default to `USD`, Stripe test mode, PayHere supports USD).
   Member 7's finance page needs to agree; it can convert to LKR for display.
3. **Delivery prices:** fine by Member 1 (Standard $12, free from $150; Express $15; pickup free).
4. **Clearing the cart:** agreed. The success page calls `clear()` once the payment is `succeeded`.
5. **Shared payment service:** done, `src/modules/payments/payments.service.js` (`createPayment`,
   `recordProviderEvent`, `getOrder`). See section 6.
6. **GitHub default branch + protection:** agreed; needs the repo owner to change it in Settings.
