// Product, category and colour request validation.
import { AppError } from "../../utils/errors.js";

export function slugify(text) {
  return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest("Invalid id");
  return id;
}

function fail(errors) {
  if (Object.keys(errors).length) throw AppError.badRequest("Validation failed", errors);
}

// partial = true is used for edits: only the fields that were sent are checked.
export function validateCategory(body = {}, { partial = false } = {}) {
  const errors = {};
  const data = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) errors.name = "Name is required (max 100 characters)";
    else data.name = name;
  }

  if (body.slug !== undefined || (!partial && data.name)) {
    const slug = slugify(body.slug ?? data.name);
    if (!slug || slug.length > 120) errors.slug = "Slug is invalid";
    else data.slug = slug;
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== "string") errors.description = "Must be text";
    else data.description = body.description?.trim() || null;
  }

  if (body.parent_id !== undefined) {
    if (body.parent_id !== null && !Number.isInteger(body.parent_id)) errors.parent_id = "Must be a category id or null";
    else data.parent_id = body.parent_id;
  }

  if (body.sort_order !== undefined) {
    if (!Number.isInteger(body.sort_order) || body.sort_order < 0) errors.sort_order = "Must be a whole number, 0 or more";
    else data.sort_order = body.sort_order;
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") errors.is_active = "Must be true or false";
    else data.is_active = body.is_active;
  }

  fail(errors);
  return data;
}

export function validateColor(body = {}, { partial = false } = {}) {
  const errors = {};
  const data = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50) errors.name = "Name is required (max 50 characters)";
    else data.name = name;
  }

  if (!partial || body.hex !== undefined) {
    if (typeof body.hex !== "string" || !/^#[0-9a-fA-F]{6}$/.test(body.hex)) errors.hex = "Must look like #b8a4e3";
    else data.hex = body.hex.toLowerCase();
  }

  fail(errors);
  return data;
}

// ---- Products ----
const MAX_MONEY = 99_999_999.99; // decimal(10,2)

function isMoney(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_MONEY &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6
  );
}

// Optional text column: undefined = not sent, null or "" = clear it.
function optionalText(body, key, max, errors, data) {
  if (body[key] === undefined) return;
  const value = body[key];
  if (value === null) data[key] = null;
  else if (typeof value !== "string" || value.length > max) errors[key] = `Must be text (max ${max} characters)`;
  else data[key] = value.trim() || null;
}

export function validateProduct(body = {}, { partial = false } = {}) {
  const errors = {};
  const data = {};

  if (!partial || body.category_id !== undefined) {
    if (!Number.isInteger(body.category_id) || body.category_id <= 0) errors.category_id = "Choose a category";
    else data.category_id = body.category_id;
  }

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 200) errors.name = "Name is required (max 200 characters)";
    else data.name = name;
  }

  // Slug is generated from the name on create; on edit it only changes if sent.
  if (body.slug !== undefined || (!partial && data.name)) {
    const slug = slugify(body.slug ?? data.name);
    if (!slug || slug.length > 220) errors.slug = "Slug is invalid";
    else data.slug = slug;
  }

  optionalText(body, "collection", 100, errors, data);
  optionalText(body, "badge", 30, errors, data);
  optionalText(body, "description", 5000, errors, data);
  optionalText(body, "fabric_care", 5000, errors, data);

  if (!partial || body.price !== undefined) {
    if (!isMoney(body.price)) errors.price = "Must be a positive amount with up to 2 decimals";
    else data.price = body.price;
  }

  if (body.sale_price !== undefined) {
    if (body.sale_price !== null && !isMoney(body.sale_price)) {
      errors.sale_price = "Must be a positive amount with up to 2 decimals, or null";
    } else data.sale_price = body.sale_price;
  }

  for (const key of ["is_active", "is_featured"]) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "boolean") errors[key] = "Must be true or false";
      else data[key] = body[key];
    }
  }

  fail(errors);
  return data;
}

// GET /products?page=1&limit=20&search=silk&category_id=2&is_active=true
export function parseProductListQuery(query = {}) {
  const errors = {};

  const page = query.page === undefined ? 1 : Number(query.page);
  if (!Number.isInteger(page) || page < 1) errors.page = "Must be a whole number, 1 or more";

  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.limit = "Must be between 1 and 100";

  let search;
  if (query.search !== undefined) {
    if (typeof query.search !== "string" || query.search.length > 100) errors.search = "Must be text (max 100 characters)";
    else search = query.search.trim() || undefined;
  }

  let categoryId;
  if (query.category_id !== undefined) {
    categoryId = Number(query.category_id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) errors.category_id = "Must be a category id";
  }

  let isActive;
  if (query.is_active !== undefined) {
    if (query.is_active === "true") isActive = true;
    else if (query.is_active === "false") isActive = false;
    else errors.is_active = "Must be true or false";
  }

  fail(errors);
  return { page, limit, offset: (page - 1) * limit, filters: { search, categoryId, isActive } };
}