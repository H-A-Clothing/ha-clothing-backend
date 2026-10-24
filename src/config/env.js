// Environment loading and validation.
import "dotenv/config";

const REQUIRED = ["DATABASE_URL"];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}. See .env.example.`);
}

const databaseUrl = process.env.DATABASE_URL;

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl,
  // Neon (and most hosted Postgres) needs SSL; a local Docker database does not.
  databaseSsl: process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === "true"
    : /sslmode=require/.test(databaseUrl),
  jwtSecret: process.env.JWT_SECRET,
};
