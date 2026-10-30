// Payments (one table for Stripe and PayHere) and provider callback events.
// Owners: Members 1 (Stripe) and 2 (PayHere). Used by Members 6 and 7.
import { addUpdatedAtTrigger, money } from "../helpers.js";

export const PAYMENT_PROVIDERS = ["stripe", "payhere"];
export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "cancelled", "refunded", "partially_refunded"];

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.schema.createTable("payments", (table) => {
    table.increments("id").primary();
    table.string("reference", 40).notNullable().unique(); // our own reference, shown on the payment pages
    table.integer("order_id").notNullable().references("id").inTable("orders").onDelete("RESTRICT");
    table.enu("provider", PAYMENT_PROVIDERS).notNullable();
    table.enu("status", PAYMENT_STATUSES).notNullable().defaultTo("pending");

    // Duplicate-payment protection:
    // - the frontend sends one idempotency key per order, so a retried request can't create a second row
    // - the provider's own id (Stripe PaymentIntent / PayHere payment_id) can only be stored once
    table.string("idempotency_key", 100).notNullable().unique();
    table.string("provider_payment_id", 100).unique();

    money(table, "amount").notNullable();
    table.string("currency", 3).notNullable().defaultTo("USD");
    money(table, "provider_fee"); // for reconciliation (Member 7)
    money(table, "refunded_amount").notNullable().defaultTo(0);

    table.string("card_brand", 20);
    table.string("card_last4", 4); // never store full card numbers
    table.string("failure_reason", 500);

    table.timestamp("paid_at");
    table.timestamp("verified_at"); // admin payment verification (Member 6)
    table.integer("verified_by").references("id").inTable("users").onDelete("SET NULL");
    table.timestamps(true, true);

    table.index("order_id");
    table.index(["status", "created_at"]);
    table.check("?? > 0", ["amount"], "payments_amount_positive");
    table.check("?? >= 0 AND ?? <= ??", ["refunded_amount", "refunded_amount", "amount"],
      "payments_refund_within_amount");
  });

  // An order can have several failed attempts, but only one successful payment.
  await knex.raw(
    "CREATE UNIQUE INDEX payments_one_success_per_order ON payments (order_id) WHERE status = 'succeeded'"
  );

  // Every callback/webhook is logged once. A repeated callback with the same event id is rejected
  // by the unique constraint, so it can't update the payment twice.
  await knex.schema.createTable("payment_events", (table) => {
    table.bigIncrements("id").primary();
    table.integer("payment_id").references("id").inTable("payments").onDelete("CASCADE");
    table.enu("provider", PAYMENT_PROVIDERS).notNullable();
    table.string("provider_event_id", 150).notNullable();
    table.string("event_type", 100).notNullable(); // e.g. payment_intent.succeeded, payhere status 2
    table.boolean("signature_valid").notNullable();
    table.jsonb("payload").notNullable();
    table.timestamp("received_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("processed_at");
    table.unique(["provider", "provider_event_id"]);
    table.index("payment_id");
  });

  await addUpdatedAtTrigger(knex, "payments");
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable("payment_events");
  await knex.schema.dropTable("payments");
}
