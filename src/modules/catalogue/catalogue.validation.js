// Catalogue request validation.
// Turns query-string text into clean, typed values, or throws a 400 with field details.
import { AppError } from "../../utils/errors.js";

export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "bestselling"];
export const COLLECTIONS = ["new", "sale", "bestsellers"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LIMIT = 48;

// "S,M,L" -> ["S", "M", "L"]
function list(value) {
  if (value === undefined || value === "") return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateProductQuery(query) {
  const errors = [];

  const integer = (name, fallback, { min, max }) => {
    if (query[name] === undefined || query[name] === "") return fallback;
    const value = Number(query[name]);
    if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
      errors.push({ field: name, message: `must be a whole number from ${min}${max ? ` to ${max}` : ""}` });
      return fallback;
    }
    return value;
  };

  const price = (name) => {
    if (query[name] === undefined || query[name] === "") return undefined;
    const value = Number(query[name]);
    if (!Number.isFinite(value) || value < 0) {
      errors.push({ field: name, message: "must be a number of 0 or more" });
      return undefined;
    }
    return value;
  };

  const sort = query.sort || "newest";
  if (!SORT_OPTIONS.includes(sort)) {
    errors.push({ field: "sort", message: `must be one of: ${SORT_OPTIONS.join(", ")}` });
  }

  const collection = query.collection || undefined;
  if (collection && !COLLECTIONS.includes(collection)) {
    errors.push({ field: "collection", message: `must be one of: ${COLLECTIONS.join(", ")}` });
  }

  const category = query.category || undefined;
  if (category && !SLUG.test(category)) {
    errors.push({ field: "category", message: "must be a category slug, e.g. dresses" });
  }

  const q = query.q ? String(query.q).trim() : "";
  if (q.length > 100) errors.push({ field: "q", message: "must be 100 characters or fewer" });

  const result = {
    page: integer("page", 1, { min: 1 }),
    limit: integer("limit", 12, { min: 1, max: MAX_LIMIT }),
    sort,
    collection,
    category,
    q,
    sizes: list(query.sizes).map((size) => size.toUpperCase()),
    colors: list(query.colors),
    minPrice: price("minPrice"),
    maxPrice: price("maxPrice"),
    inStock: query.inStock === "true",
  };

  if (result.minPrice !== undefined && result.maxPrice !== undefined && result.minPrice > result.maxPrice) {
    errors.push({ field: "minPrice", message: "must not be greater than maxPrice" });
  }

  if (errors.length) throw AppError.badRequest("Invalid query parameters", errors);
  return result;
}

export function validateSlug(slug) {
  if (!SLUG.test(slug)) throw AppError.notFound("Product not found");
  return slug;
}
