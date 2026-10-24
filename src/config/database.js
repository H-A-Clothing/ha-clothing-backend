// PostgreSQL connection pool.
// Repositories use `query`; services that change several tables use `withTransaction`.
import pg from "pg";
import { env } from "./env.js";

// SSL is configured below, so drop sslmode from the URL to stop pg overriding those settings.
function stripSslMode(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

export const pool = new pg.Pool({
  connectionString: stripSslMode(env.databaseUrl),
  ssl: env.databaseSsl ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Neon can take a few seconds to wake an idle database.
  connectionTimeoutMillis: 15_000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

// Runs `work(client)` inside BEGIN/COMMIT and rolls back if it throws.
// Use the given client for every query in the transaction, e.g. checkout, stock reservation, payment callbacks.
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkConnection() {
  const { rows } = await pool.query(
    "SELECT current_database() AS database, version() AS version, now() AS time"
  );
  return rows[0];
}

export function closePool() {
  return pool.end();
}
