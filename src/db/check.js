// Connection test: npm run db:check
import { checkConnection, closePool } from "../config/database.js";
import { env } from "../config/env.js";

try {
  const db = await checkConnection();
  console.log("Database connection OK");
  // The host differs per Neon branch, so this shows which copy of the database you're using.
  console.log(`  host:     ${new URL(env.database.connectionString).hostname}`);
  console.log(`  database: ${db.database}`);
  console.log(`  server:   ${db.version.split(" on ")[0]}`);
  console.log(`  time:     ${db.time.toISOString()}`);
} catch (error) {
  console.error("Database connection FAILED:", error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
