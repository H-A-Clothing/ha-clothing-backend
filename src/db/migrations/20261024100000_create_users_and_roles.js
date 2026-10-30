// Users, roles and addresses.
// Owners: Member 3 (users, addresses) and Member 8 (roles). Used by all members.
import { addUpdatedAtTrigger } from "../helpers.js";

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  // Finer admin roles (e.g. inventory_manager, finance) are added by Member 8 later.
  await knex.schema.createTable("roles", (table) => {
    table.increments("id").primary();
    table.string("name", 50).notNullable().unique();
    table.string("description", 255);
    table.timestamps(true, true);
  });

  await knex("roles").insert([
    { name: "customer", description: "Shops on the storefront" },
    { name: "admin", description: "Full access to the admin area" },
  ]);

  await knex.schema.createTable("users", (table) => {
    table.increments("id").primary();
    table.integer("role_id").notNullable().references("id").inTable("roles");
    table.string("email", 255).notNullable().unique();
    table.string("password_hash", 255).notNullable();
    table.string("first_name", 100).notNullable();
    table.string("last_name", 100).notNullable();
    table.string("phone", 30);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("email_verified_at");
    table.timestamp("last_login_at");
    table.timestamps(true, true);
  });

  await knex.schema.createTable("addresses", (table) => {
    table.increments("id").primary();
    table.integer("user_id").notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("label", 50); // e.g. Home, Work
    table.string("recipient_name", 200).notNullable();
    table.string("phone", 30).notNullable();
    table.string("line1", 255).notNullable();
    table.string("line2", 255);
    table.string("city", 100).notNullable();
    table.string("district", 100);
    table.string("postal_code", 20);
    table.string("country", 100).notNullable().defaultTo("Sri Lanka");
    table.boolean("is_default").notNullable().defaultTo(false);
    table.timestamps(true, true);
    table.index("user_id");
  });

  // At most one default address per user.
  await knex.raw(
    "CREATE UNIQUE INDEX addresses_one_default_per_user ON addresses (user_id) WHERE is_default"
  );

  for (const table of ["roles", "users", "addresses"]) {
    await addUpdatedAtTrigger(knex, table);
  }
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTable("addresses");
  await knex.schema.dropTable("users");
  await knex.schema.dropTable("roles");
  await knex.raw("DROP FUNCTION IF EXISTS set_updated_at()");
}
