// Stock levels and stock movements.
// Owner: Member 5. Used by Members 1, 2 and 7.
// Suppliers and purchase orders are added by Member 5 in a later migration.
import { addUpdatedAtTrigger, money } from "../helpers.js";

export const STOCK_MOVEMENT_TYPES = [
  "stock_in", // goods received
  "stock_out", // manual removal (damaged, lost)
  "reservation", // held during checkout
  "release", // reservation cancelled or expired
  "sale", // reservation converted after payment
  "return", // customer return put back into stock
  "adjustment", // stock count correction
];

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  // One row per variant. Lock it with SELECT ... FOR UPDATE when reserving.
  await knex.schema.createTable("stock", (table) => {
    table.integer("variant_id").primary().references("id").inTable("product_variants").onDelete("CASCADE");
    table.integer("quantity_on_hand").notNullable().defaultTo(0);
    table.integer("quantity_reserved").notNullable().defaultTo(0);
    table.specificType(
      "quantity_available",
      "integer GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED"
    );
    table.integer("low_stock_threshold").notNullable().defaultTo(3);
    money(table, "unit_cost"); // current cost price, used for inventory valuation
    table.timestamps(true, true);
    table.check("?? >= 0", ["quantity_on_hand"], "stock_on_hand_not_negative");
    table.check("?? >= 0 AND ?? <= ??", ["quantity_reserved", "quantity_reserved", "quantity_on_hand"],
      "stock_reserved_within_on_hand");
  });

  // Every stock change writes a row here (audit trail).
  await knex.schema.createTable("stock_movements", (table) => {
    table.bigIncrements("id").primary();
    table.integer("variant_id").notNullable().references("id").inTable("product_variants").onDelete("CASCADE");
    table.enu("type", STOCK_MOVEMENT_TYPES).notNullable();
    table.integer("quantity_change").notNullable(); // positive adds stock, negative removes
    table.string("reference_type", 50); // e.g. order, purchase_order
    table.integer("reference_id");
    table.string("note", 255);
    table.integer("created_by").references("id").inTable("users").onDelete("SET NULL");
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["variant_id", "created_at"]);
    table.index(["reference_type", "reference_id"]);
  });

  await addUpdatedAtTrigger(knex, "stock");
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable("stock_movements");
  await knex.schema.dropTable("stock");
}
