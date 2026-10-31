// Environment loading and validation.
import "dotenv/config";

const REQUIRED = ["DATABASE_URL"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}. See .env.example.`);
}

const databaseUrl = process.env.DATABASE_URL;
if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
  throw new Error(
    "DATABASE_URL is not a valid connection string. It should start with postgresql:// " +
      "(copy it from Neon > Connect)."
  );
}

// Neon (and most hosted Postgres) needs SSL; a local Docker database does not.
const databaseSsl = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === "true"
  : /sslmode=require/.test(databaseUrl);

// SSL is set explicitly, so drop sslmode from the URL to stop pg overriding those settings.
function stripSslMode(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  // Shared by the pg pool (config/database.js) and Knex (knexfile.js).
  database: {
    connectionString: stripSslMode(databaseUrl),
    ssl: databaseSsl ? { rejectUnauthorized: true } : false,
  },
  jwtSecret: process.env.JWT_SECRET,
};
