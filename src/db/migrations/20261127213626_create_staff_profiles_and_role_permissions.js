// Staff profiles and finer admin role permissions.
// Owner: Member 8 (Analytics and System Administration).
import { addUpdatedAtTrigger } from "../helpers.js";

/** @param {import("knex").Knex} knex */
export async function up(knex) {
  await knex.schema.alterTable("roles", (table) => {
    table.jsonb("permissions").notNullable().defaultTo(JSON.stringify([]));
  });

  await knex("roles")
    .where({ name: "admin" })
    .update({ permissions: JSON.stringify(["*"]) });

  await knex("roles").insert([
    {
      name: "staff",
      description: "General store staff with limited admin access",
      permissions: JSON.stringify([
        "orders:read",
        "products:read",
        "faqs:manage",
      ]),
    },
    {
      name: "inventory_manager",
      description: "Manages stock, suppliers, and purchase orders",
      permissions: JSON.stringify(["inventory:manage", "products:read"]),
    },
    {
      name: "finance_manager",
      description: "Manages product costs, expenses, and financial reports",
      permissions: JSON.stringify(["finance:manage", "orders:read"]),
    },
    {
      name: "order_manager",
      description: "Manages order processing, returns, and deliveries",
      permissions: JSON.stringify(["orders:manage", "deliveries:manage"]),
    },
  ]);

  await knex.schema.createTable("staff_profiles", (table) => {
    table
      .integer("user_id")
      .primary()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table.string("job_title", 100).notNullable();
    table.string("department", 100);
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("last_login_at");
    table.timestamps(true, true);
  });

  await addUpdatedAtTrigger(knex, "staff_profiles");
}

/** @param {import("knex").Knex} knex */
export async function down(knex) {
  await knex.schema.dropTableIfExists("staff_profiles");
  await knex("roles")
    .whereIn("name", [
      "staff",
      "inventory_manager",
      "finance_manager",
      "order_manager",
    ])
    .del();
  await knex.schema.alterTable("roles", (table) => {
    table.dropColumn("permissions");
  });
}
