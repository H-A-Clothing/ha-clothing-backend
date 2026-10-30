// Categories, colours, products, variants and images.
// Owner: Member 4. Used by Members 1, 2 and 7.
// Promotions and discount codes are added by Member 4 in a later migration.
import { addUpdatedAtTrigger, money } from "../helpers.js";

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.schema.createTable("categories", (table) => {
    table.increments("id").primary();
    table.integer("parent_id").references("id").inTable("categories").onDelete("SET NULL");
    table.string("name", 100).notNullable();
    table.string("slug", 120).notNullable().unique();
    table.text("description");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable("colors", (table) => {
    table.increments("id").primary();
    table.string("name", 50).notNullable().unique(); // e.g. Lilac Mist
    table.string("hex", 7).notNullable(); // e.g. #b8a4e3
    table.timestamps(true, true);
  });

  await knex.schema.createTable("products", (table) => {
    table.increments("id").primary();
    table.integer("category_id").notNullable().references("id").inTable("categories");
    table.string("name", 200).notNullable();
    table.string("slug", 220).notNullable().unique();
    table.string("collection", 100); // label shown on cards, e.g. "Silk Capsule"
    table.text("description");
    table.text("fabric_care");
    money(table, "price").notNullable();
    money(table, "sale_price"); // null when not on sale
    table.string("badge", 30); // e.g. New, Atelier
    table.boolean("is_active").notNullable().defaultTo(true);
    table.boolean("is_featured").notNullable().defaultTo(false);
    table.timestamps(true, true);
    table.index("category_id");
    table.check("?? > 0", ["price"], "products_price_positive");
    table.check("?? IS NULL OR (?? > 0 AND ?? < ??)", ["sale_price", "sale_price", "sale_price", "price"],
      "products_sale_price_below_price");
  });

  // One row per sellable size + colour combination. Stock is tracked per variant.
  await knex.schema.createTable("product_variants", (table) => {
    table.increments("id").primary();
    table.integer("product_id").notNullable().references("id").inTable("products").onDelete("CASCADE");
    table.integer("color_id").notNullable().references("id").inTable("colors");
    table.string("size", 10).notNullable(); // XS, S, M, L, XL
    table.string("sku", 60).notNullable().unique();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(["product_id", "color_id", "size"]);
  });

  // Images live in file storage; only the URL is saved here.
  await knex.schema.createTable("product_images", (table) => {
    table.increments("id").primary();
    table.integer("product_id").notNullable().references("id").inTable("products").onDelete("CASCADE");
    table.integer("color_id").references("id").inTable("colors"); // optional: image for one colour
    table.string("url", 500).notNullable();
    table.string("alt_text", 255);
    table.integer("sort_order").notNullable().defaultTo(0);
    table.boolean("is_primary").notNullable().defaultTo(false);
    table.timestamps(true, true);
    table.index("product_id");
  });

  for (const table of ["categories", "colors", "products", "product_variants", "product_images"]) {
    await addUpdatedAtTrigger(knex, table);
  }
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable("product_images");
  await knex.schema.dropTable("product_variants");
  await knex.schema.dropTable("products");
  await knex.schema.dropTable("colors");
  await knex.schema.dropTable("categories");
}
