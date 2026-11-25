// Member 7: expense category setup.
const defaultCategories = [
  "Product purchases",
  "Marketing",
  "Transport",
  "Packaging",
  "Rent",
  "Utilities",
  "Other",
];

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.schema.createTable("expense_categories", (table) => {
    table.increments("id").primary();
    table.string("name", 80).notNullable().unique();
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamps(true, true);
  });
  await knex.raw("CREATE UNIQUE INDEX expense_categories_name_lower_unique ON expense_categories (lower(name))");
  await knex("expense_categories").insert(defaultCategories.map((name) => ({ name })));
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.raw("DROP INDEX IF EXISTS expense_categories_name_lower_unique");
  await knex.schema.dropTableIfExists("expense_categories");
}
