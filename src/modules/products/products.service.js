// Product business rules.
import { AppError } from "../../utils/errors.js";
import * as repo from "./products.repository.js";
import { validateCategory, validateColor } from "./products.validation.js";

const UNIQUE_VIOLATION = "23505";

function rethrowConflict(error, message) {
  if (error.code === UNIQUE_VIOLATION) throw AppError.conflict(message);
  throw error;
}

// A category cannot be its own parent, or sit under one of its own children.
async function assertValidParent(categoryId, parentId) {
  if (parentId === null || parentId === undefined) return;
  if (parentId === categoryId) throw AppError.badRequest("A category cannot be its own parent");

  let current = await repo.findCategoryById(parentId);
  if (!current) throw AppError.badRequest("Parent category does not exist");

  for (let depth = 0; current && depth < 10; depth += 1) {
    if (current.parent_id === categoryId) throw AppError.badRequest("That parent is a child of this category");
    current = current.parent_id ? await repo.findCategoryById(current.parent_id) : null;
  }
}

// ---- Categories ----
export const listCategories = () => repo.listCategories();

export async function createCategory(body) {
  const data = validateCategory(body);
  await assertValidParent(null, data.parent_id);
  if (await repo.findCategoryBySlug(data.slug)) throw AppError.conflict("A category with this slug already exists");
  try {
    return await repo.insertCategory(data);
  } catch (error) {
    return rethrowConflict(error, "A category with this slug already exists");
  }
}

export async function updateCategory(id, body) {
  const data = validateCategory(body, { partial: true });
  if (!Object.keys(data).length) throw AppError.badRequest("Nothing to update");

  const existing = await repo.findCategoryById(id);
  if (!existing) throw AppError.notFound("Category not found");

  if (data.parent_id !== undefined) await assertValidParent(id, data.parent_id);
  if (data.slug && data.slug !== existing.slug && (await repo.findCategoryBySlug(data.slug))) {
    throw AppError.conflict("A category with this slug already exists");
  }
  try {
    return await repo.updateCategory(id, data);
  } catch (error) {
    return rethrowConflict(error, "A category with this slug already exists");
  }
}

// ---- Colours ----
export const listColors = () => repo.listColors();

export async function createColor(body) {
  const data = validateColor(body);
  if (await repo.findColorByName(data.name)) throw AppError.conflict("A colour with this name already exists");
  try {
    return await repo.insertColor(data);
  } catch (error) {
    return rethrowConflict(error, "A colour with this name already exists");
  }
}

export async function updateColor(id, body) {
  const data = validateColor(body, { partial: true });
  if (!Object.keys(data).length) throw AppError.badRequest("Nothing to update");

  const existing = await repo.findColorById(id);
  if (!existing) throw AppError.notFound("Colour not found");

  if (data.name) {
    const same = await repo.findColorByName(data.name);
    if (same && same.id !== id) throw AppError.conflict("A colour with this name already exists");
  }
  try {
    return await repo.updateColor(id, data);
  } catch (error) {
    return rethrowConflict(error, "A colour with this name already exists");
  }
}