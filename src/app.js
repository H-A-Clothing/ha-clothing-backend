// Express application setup and route mounting.
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { checkConnection } from "./config/database.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import productsRoutes from "./modules/products/products.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import paymentsStripeRoutes from "./modules/payments-stripe/payments-stripe.routes.js";

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
// Stripe signs the exact bytes it sends, so its webhook must get the raw body, not parsed JSON.
// It runs first; express.json() then skips the already-read body.
app.use("/api/v1/payments/stripe/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

const api = express.Router();

api.get("/health", async (req, res) => {
  try {
    const db = await checkConnection();
    res.json({ status: "ok", database: "up", databaseName: db.database, time: db.time });
  } catch (error) {
    res.status(503).json({ status: "degraded", database: "down", message: error.message });
  }
});

// Each member mounts their module router here once it exports one, e.g.:
// import catalogueRoutes from "./modules/catalogue/catalogue.routes.js";
// api.use("/catalogue", catalogueRoutes);
api.use("/admin", productsRoutes);
api.use("/payments/stripe", paymentsStripeRoutes); // M1
api.use("/payments", paymentsRoutes); // M1 + M2 shared

app.use("/api/v1", api);

app.use(notFoundHandler);
app.use(errorHandler);