
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