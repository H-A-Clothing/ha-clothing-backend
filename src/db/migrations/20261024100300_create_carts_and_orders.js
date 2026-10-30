// Carts, orders and order items.
// Owner: Member 2. Used by Members 3, 6, 7 and 8.
import { addUpdatedAtTrigger, money } from "../helpers.js";

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "dispatched",
  "delivered",
  "cancelled",
  "refunded",
];

export const DELIVERY_METHODS = ["standard", "express", "pickup"];

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  // A signed-in customer has one cart (user_id); a guest cart uses session_token.
  await knex.schema.createTable("carts", (table) => {
    table.increments("id").primary();
    table.integer("user_id").unique().references("id").inTable("users").onDelete("CASCADE");
    table.string("session_token", 100).unique();
    table.timestamps(true, true);
    table.check("?? IS NOT NULL OR ?? IS NOT NULL", ["user_id", "session_token"], "carts_has_owner");
  });

  await knex.schema.createTable("cart_items", (table) => {
    table.increments("id").primary();
    table.integer("cart_id").notNullable().references("id").inTable("carts").onDelete("CASCADE");
    table.integer("variant_id").notNullable().references("id").inTable("product_variants").onDelete("CASCADE");
    table.integer("quantity").notNullable();
    table.timestamps(true, true);
    table.unique(["cart_id", "variant_id"]);
    table.check("?? > 0", ["quantity"], "cart_items_quantity_positive");
  });

  await knex.schema.createTable("orders", (table) => {
    table.increments("id").primary();
    table.string("order_number", 20).notNullable().unique(); // shown to customers, e.g. HA-94281
    table.integer("user_id").references("id").inTable("users").onDelete("SET NULL");
    table.enu("status", ORDER_STATUSES).notNullable().defaultTo("pending_payment");
    table.string("customer_email", 255).notNullable();

    // Address is copied at checkout, so later address edits don't change past orders.
    table.enu("delivery_method", DELIVERY_METHODS).notNullable().defaultTo("standard");
    table.string("shipping_name", 200).notNullable();
    table.string("shipping_phone", 30).notNullable();
    table.string("shipping_line1", 255).notNullable();
    table.string("shipping_line2", 255);
    table.string("shipping_city", 100).notNullable();
    table.string("shipping_district", 100);
    table.string("shipping_postal_code", 20);
    table.string("shipping_country", 100).notNullable().defaultTo("Sri Lanka");

    money(table, "subtotal").notNullable();
    table.string("discount_code", 50);
    money(table, "discount_amount").notNullable().defaultTo(0);
    money(table, "shipping_fee").notNullable().defaultTo(0);
    money(table, "tax_amount").notNullable().defaultTo(0);
    money(table, "total").notNullable();
    table.string("currency", 3).notNullable().defaultTo("USD");
    table.text("notes");

    table.timestamp("placed_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("dispatched_at");
    table.timestamp("delivered_at");
    table.timestamp("cancelled_at");
    table.timestamps(true, true);

    table.index("user_id");
    table.index(["status", "placed_at"]);
    table.index("placed_at"); // date-range reports (Member 7)
    table.check("?? >= 0 AND ?? >= 0 AND ?? >= 0 AND ?? >= 0 AND ?? >= 0",
      ["subtotal", "discount_amount", "shipping_fee", "tax_amount", "total"], "orders_amounts_not_negative");
  });

  // Product details and cost are copied at the time of sale, so reports stay correct
  // when products or costs change later.
  await knex.schema.createTable("order_items", (table) => {
    table.increments("id").primary();
    table.integer("order_id").notNullable().references("id").inTable("orders").onDelete("CASCADE");
    table.integer("variant_id").references("id").inTable("product_variants").onDelete("SET NULL");
    table.integer("product_id").references("id").inTable("products").onDelete("SET NULL");
    table.string("product_name", 200).notNullable();
    table.string("sku", 60);
    table.string("size", 10).notNullable();
    table.string("color", 50).notNullable();
    table.integer("quantity").notNullable();
    money(table, "unit_price").notNullable();
    money(table, "unit_cost"); // cost at time of sale (Member 7 profit reports)
    money(table, "line_total").notNullable();
    table.timestamps(true, true);
    table.index("order_id");
    table.index("product_id");
    table.check("?? > 0", ["quantity"], "order_items_quantity_positive");
  });

  for (const table of ["carts", "cart_items", "orders", "order_items"]) {
    await addUpdatedAtTrigger(knex, table);
  }
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable("order_items");
  await knex.schema.dropTable("orders");
  await knex.schema.dropTable("cart_items");
  await knex.schema.dropTable("carts");
}
