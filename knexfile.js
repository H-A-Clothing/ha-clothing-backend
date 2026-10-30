// Knex configuration for migrations and seeds.
// Knex is used only for schema changes; repositories keep using plain SQL through config/database.js.
import { env } from "./src/config/env.js";

export default {
  client: "pg",
  connection: env.database,
  pool: { min: 0, max: 5 },
  migrations: {
    directory: "./src/db/migrations",
    tableName: "knex_migrations",
    extension: "js",
    stub: "./src/db/migration.stub.js",
  },
  seeds: {
    directory: "./src/db/seeds",
    extension: "js",
    stub: "./src/db/seed.stub.js",
  },
};
