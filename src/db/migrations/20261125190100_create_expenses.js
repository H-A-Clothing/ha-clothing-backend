// Member 7: expense records.
import { addUpdatedAtTrigger, money } from "../helpers.js";

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.schema.createTable("expenses", (table) => {
    table.increments("id").primary();
    table.integer("category_id").notNullable().references("id").inTable("expense_categories").onDelete("RESTRICT");
    table.string("beneficiary", 200).notNullable();
    table.text("description");
    money(table, "amount").notNullable();
    table.date("expense_date").notNullable().defaultTo(knex.raw("CURRENT_DATE"));
    table.string("payment_method", 40).notNullable();
    table.string("reference_no", 100).notNullable().unique();
    table.text("notes");
    table.integer("created_by").references("id").inTable("users").onDelete("SET NULL");
    table.timestamps(true, true);
    table.index("expense_date", "expenses_expense_date_idx");
    table.index("category_id", "expenses_category_id_idx");
  });
  await addUpdatedAtTrigger(knex, "expenses");
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists("expenses");
}
