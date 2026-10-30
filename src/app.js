// Express application setup and route mounting.
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { checkConnection } from "./config/database.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import productsRoutes from "./modules/products/products.routes.js";

export const app = express();

app.use(cors({ origin: env.corsOrigin }));
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

app.use("/api/v1", api);

app.use(notFoundHandler);
app.use(errorHandler);