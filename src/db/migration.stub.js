// Template for `npm run migrate:make <name>`.
// Never edit a migration after it has been merged into develop; add a new one instead.

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  // await knex.schema.createTable("example", (table) => {
  //   table.increments("id").primary();
  //   table.string("name").notNullable();
  //   table.timestamps(true, true);
  // });
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  // await knex.schema.dropTable("example");
}
