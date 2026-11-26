// Finance request validation. Keep accepted values explicit and independent of the request SQL.
import { AppError } from "../../utils/errors.js";

export const PAYMENT_METHODS = ["Bank transfer", "Cash", "Card", "Cheque"];

function fail(errors) {
  if (Object.keys(errors).length) throw AppError.badRequest("Validation failed", errors);
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest("Invalid id");
  return id;
}

function todayInColombo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateExpense(body = {}, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw AppError.badRequest("Validation failed", { body: "Enter expense details as an object" });
  const errors = {};
  const data = {};

  if (!partial || body.category_id !== undefined) {
    const categoryId = Number(body.category_id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) errors.category_id = "Choose a valid expense category";
    else data.category_id = categoryId;
  }

  if (!partial || body.beneficiary !== undefined) {
    const beneficiary = typeof body.beneficiary === "string" ? body.beneficiary.trim() : "";
    if (!beneficiary || beneficiary.length > 200) errors.beneficiary = "Beneficiary is required (max 200 characters)";
    else data.beneficiary = beneficiary;
  }

  if (!partial || body.description !== undefined) {
    if (body.description !== null && body.description !== undefined && typeof body.description !== "string") {
      errors.description = "Description must be text";
    } else {
      const description = body.description?.trim() ?? "";
      if (description.length > 2000) errors.description = "Description must be 2000 characters or fewer";
      else data.description = description || null;
    }
  }

  if (!partial || body.amount !== undefined) {
    const amountText = String(body.amount ?? "").trim();
    const amount = Number(amountText);
    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
      errors.amount = "Amount must be greater than zero and have no more than two decimal places";
    } else data.amount = amount;
  }

  if (!partial || body.expense_date !== undefined) {
    const expenseDate = body.expense_date ?? todayInColombo();
    if (!isValidDate(expenseDate)) errors.expense_date = "Enter a valid date";
    else if (expenseDate > todayInColombo()) errors.expense_date = "Expense date cannot be in the future";
    else data.expense_date = expenseDate;
  }

  if (!partial || body.payment_method !== undefined) {
    if (!PAYMENT_METHODS.includes(body.payment_method)) errors.payment_method = `Choose one of: ${PAYMENT_METHODS.join(", ")}`;
    else data.payment_method = body.payment_method;
  }

  if (!partial || body.reference_no !== undefined) {
    const reference = typeof body.reference_no === "string" ? body.reference_no.trim() : "";
    if (!reference || reference.length > 100) errors.reference_no = "Reference / voucher number is required (max 100 characters)";
    else data.reference_no = reference;
  }

  if (!partial || body.notes !== undefined) {
    if (body.notes !== null && body.notes !== undefined && typeof body.notes !== "string") errors.notes = "Notes must be text";
    else {
      const notes = body.notes?.trim() ?? "";
      if (notes.length > 4000) errors.notes = "Notes must be 4000 characters or fewer";
      else data.notes = notes || null;
    }
  }

  fail(errors);
  return data;
}

export function validateCategory(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw AppError.badRequest("Validation failed", { body: "Enter category details as an object" });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) throw AppError.badRequest("Validation failed", { name: "Category name is required (max 80 characters)" });
  return { name };
}

export function parseExpenseListQuery(query = {}) {
  const errors = {};
  const filters = {};
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);
  if (!Number.isInteger(page) || page < 1) errors.page = "Page must be a positive integer";
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.limit = "Limit must be between 1 and 100";

  for (const key of ["from", "to"]) {
    if (query[key] !== undefined) {
      if (!isValidDate(query[key])) errors[key] = "Enter a valid date";
      else filters[key] = query[key];
    }
  }
  if (filters.from && filters.to && filters.from > filters.to) errors.to = "End date must be on or after start date";
  if (query.categoryId !== undefined) {
    const categoryId = Number(query.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) errors.categoryId = "Category must be a positive integer";
    else filters.categoryId = categoryId;
  }
  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 100) errors.search = "Search must be 100 characters or fewer";
    else filters.search = query.search.trim();
  }
  fail(errors);
  return { page, limit, offset: (page - 1) * limit, filters };
}
