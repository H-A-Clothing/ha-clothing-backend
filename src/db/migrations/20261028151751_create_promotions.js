// Promotions and discount codes.
// Owner: Member 4. Used by Members 1, 2 and 8.
import { addUpdatedAtTrigger, money } from "../helpers.js";

export const DISCOUNT_TYPES = ["percentage", "fixed"];

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.schema.createTable("promotions", (table) => {
    table.increments("id").primary();
    table.string("name", 150).notNullable();
    table.text("description");
    table.enu("discount_type", DISCOUNT_TYPES).notNullable();
    money(table, "discount_value").notNullable(); // % (1-100) or fixed amount
    table.timestamp("starts_at").notNullable();
    table.timestamp("ends_at").notNullable();
    // false = does not stack on products that already have a sale_price
    table.boolean("applies_to_sale_items").notNullable().defaultTo(false);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.index(["is_active", "starts_at", "ends_at"]);
    table.check("?? > 0", ["discount_value"], "promotions_value_positive");
    table.check("?? <> 'percentage' OR ?? <= 100", ["discount_type", "discount_value"],
      "promotions_percentage_max_100");
    table.check("?? > ??", ["ends_at", "starts_at"], "promotions_dates_valid");
  });

  // Which products or categories a promotion covers.
  // No rows in either table = the promotion applies to the whole store.
  await knex.schema.createTable("promotion_products", (table) => {
    table.integer("promotion_id").notNullable().references("id").inTable("promotions").onDelete("CASCADE");
    table.integer("product_id").notNullable().references("id").inTable("products").onDelete("CASCADE");
    table.primary(["promotion_id", "product_id"]);
  });

  await knex.schema.createTable("promotion_categories", (table) => {
    table.integer("promotion_id").notNullable().references("id").inTable("promotions").onDelete("CASCADE");
    table.integer("category_id").notNullable().references("id").inTable("categories").onDelete("CASCADE");
    table.primary(["promotion_id", "category_id"]);
  });

  await knex.schema.createTable("discount_codes", (table) => {
    table.increments("id").primary();
    table.integer("promotion_id").notNullable().references("id").inTable("promotions").onDelete("CASCADE");
    table.string("code", 50).notNullable().unique(); // always stored in UPPERCASE
    table.integer("usage_limit"); // null = unlimited
    table.integer("times_used").notNullable().defaultTo(0);
    money(table, "min_order_amount").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.index("promotion_id");
    table.check("?? = upper(??)", ["code", "code"], "discount_codes_code_uppercase");
    table.check("?? IS NULL OR ?? > 0", ["usage_limit", "usage_limit"], "discount_codes_limit_positive");
    table.check("?? >= 0", ["times_used"], "discount_codes_used_not_negative");
  });

  for (const table of ["promotions", "discount_codes"]) {
    await addUpdatedAtTrigger(knex, table);
  }
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable("discount_codes");
  await knex.schema.dropTable("promotion_categories");
  await knex.schema.dropTable("promotion_products");
  await knex.schema.dropTable("promotions");
}