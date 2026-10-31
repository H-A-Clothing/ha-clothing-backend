// HTTP server startup.
import { app } from "./app.js";
import { env } from "./config/env.js";
import { checkConnection, closePool } from "./config/database.js";

const server = app.listen(env.port, async () => {
  console.log(`API listening on http://localhost:${env.port}/api/v1`);
  try {
    const db = await checkConnection();
    console.log(`Connected to PostgreSQL database "${db.database}"`);
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
  }
});

function shutdown() {
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
