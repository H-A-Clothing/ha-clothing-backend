// Centralized error handling middleware.
// Shared error shape for every endpoint: { message, details? }
import { env } from "../config/env.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Express recognises error handlers by their four arguments, so `next` must stay.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const status = error.status ?? 500;
  if (status >= 500) console.error(error);

  res.status(status).json({
    message: status >= 500 && env.nodeEnv === "production" ? "Internal server error" : error.message,
    ...(error.details && { details: error.details }),
  });
}
