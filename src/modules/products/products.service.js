// Product business rules.
import { AppError } from "../../utils/errors.js";
import * as repo from "./products.repository.js";
import { parseProductListQuery, validateCategory, validateColor, validateProduct } from "./products.validation.js";

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

// ---- Products ----
// The database returns decimals as text ("1500.00"); the API sends numbers.
function formatProduct(row) {
  return {
    ...row,
    price: Number(row.price),
    sale_price: row.sale_price === null || row.sale_price === undefined ? null : Number(row.sale_price),
  };
}

function assertSalePriceBelowPrice(price, salePrice) {
  if (salePrice !== null && salePrice !== undefined && Number(salePrice) >= Number(price)) {
    throw AppError.badRequest("Validation failed", { sale_price: "Sale price must be lower than the price" });
  }
}

async function assertCategoryExists(categoryId) {
  if (!(await repo.findCategoryById(categoryId))) {
    throw AppError.badRequest("Validation failed", { category_id: "Category does not exist" });
  }
}

export async function listProducts(query) {
  const { page, limit, offset, filters } = parseProductListQuery(query);
  const { rows, total } = await repo.listProducts(filters, { limit, offset });
  return { data: rows.map(formatProduct), meta: { page, limit, total } };
}

export async function getProduct(id) {
  const product = await repo.findProductById(id);
  if (!product) throw AppError.notFound("Product not found");
  const [variants, images] = await Promise.all([repo.listVariantsForProduct(id), repo.listImagesForProduct(id)]);
  return { ...formatProduct(product), variants, images };
}

export async function createProduct(body) {
  const data = validateProduct(body);
  assertSalePriceBelowPrice(data.price, data.sale_price);
  await assertCategoryExists(data.category_id);
  if (await repo.findProductBySlug(data.slug)) throw AppError.conflict("A product with this slug already exists");
  try {
    const created = await repo.insertProduct(data);
    return await getProduct(created.id);
  } catch (error) {
    return rethrowConflict(error, "A product with this slug already exists");
  }
}

export async function updateProduct(id, body) {
  const data = validateProduct(body, { partial: true });
  if (!Object.keys(data).length) throw AppError.badRequest("Nothing to update");

  const existing = await repo.findProductById(id);
  if (!existing) throw AppError.notFound("Product not found");

  // The sale price rule depends on both values, so check the final combination.
  const finalPrice = data.price ?? existing.price;
  const finalSale = data.sale_price !== undefined ? data.sale_price : existing.sale_price;
  assertSalePriceBelowPrice(finalPrice, finalSale);

  if (data.category_id !== undefined) await assertCategoryExists(data.category_id);
  if (data.slug && data.slug !== existing.slug) {
    const same = await repo.findProductBySlug(data.slug);
    if (same && same.id !== id) throw AppError.conflict("A product with this slug already exists");
  }
  try {
    await repo.updateProduct(id, data);
  } catch (error) {
    rethrowConflict(error, "A product with this slug already exists");
  }
  return getProduct(id);
}