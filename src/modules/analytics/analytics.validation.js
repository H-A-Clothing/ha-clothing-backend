// Query validation for Member 8 analytics endpoints.
import { AppError } from "../../utils/errors.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function validateAnalyticsQuery(query = {}) {
  const defaults = defaultDateRange();
  const from =
    typeof query.from === "string" && query.from.trim()
      ? query.from.trim()
      : defaults.from;
  const to =
    typeof query.to === "string" && query.to.trim()
      ? query.to.trim()
      : defaults.to;
  const limit = query.limit !== undefined ? Number(query.limit) : 5;

  const errors = [];

  if (!DATE_REGEX.test(from) || Number.isNaN(Date.parse(from))) {
    errors.push({
      field: "from",
      message: "Start date must be in YYYY-MM-DD format",
    });
  }

  if (!DATE_REGEX.test(to) || Number.isNaN(Date.parse(to))) {
    errors.push({
      field: "to",
      message: "End date must be in YYYY-MM-DD format",
    });
  }

  if (errors.length === 0 && from > to) {
    errors.push({
      field: "from",
      message: "Start date cannot be after end date",
    });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    errors.push({
      field: "limit",
      message: "Limit must be an integer between 1 and 50",
    });
  }

  if (errors.length > 0) {
    throw AppError.badRequest("Invalid analytics query parameters", errors);
  }

  return { from, to, limit };
}
