// Catalogue business rules.
// Response shapes match the frontend contract in ha-clothing-frontend/src/api/catalogue.js.
import { AppError } from "../../utils/errors.js";
import * as repository from "./catalogue.repository.js";

const BESTSELLER_LIMIT = 8;

// pg returns decimal columns as strings; the frontend expects numbers.
const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

function toProduct(row) {
  const price = toNumber(row.price);
  const salePrice = toNumber(row.sale_price);
  const stock = row.sizes.reduce((sum, size) => sum + size.stock, 0);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    categoryLabel: row.category_label,
    collection: row.collection,
    price,
    salePrice,
    badge: row.badge ?? (salePrice !== null ? "Sale" : null),
    image: row.image,
    colors: row.colors,
    sizes: row.sizes,
    stock,
    inStock: stock > 0,
    description: row.description,
    fabric: row.fabric_care,
    createdAt: row.created_at,
  };
}

export async function listProducts({ page, limit, sort, ...filters }) {
  // "Bestsellers" is the top 8 by units sold, on a single page.
  if (filters.collection === "bestsellers") {
    sort = "bestselling";
    page = 1;
    limit = Math.min(limit, BESTSELLER_LIMIT);
  }

  const { rows, total } = await repository.findProducts(filters, {
    sort,
    limit,
    offset: (page - 1) * limit,
  });

  const cappedTotal = filters.collection === "bestsellers" ? Math.min(total, BESTSELLER_LIMIT) : total;

  return {
    items: rows.map(toProduct),
    total: cappedTotal,
    page,
    totalPages: Math.max(1, Math.ceil(cappedTotal / limit)),
  };
}

export async function getProduct(slug) {
  const row = await repository.findProductBySlug(slug);
  if (!row) throw AppError.notFound("Product not found");

  const related = await repository.findRelatedProducts(row.id, row.category);
  return { ...toProduct(row), related: related.map(toProduct) };
}

export async function listCategories() {
  const rows = await repository.findCategories();
  return rows.map((row) => ({
    slug: row.slug,
    label: row.name,
    note: row.description,
    count: row.count,
  }));
}

export async function getFilterOptions() {
  const [categories, colors, priceRange] = await Promise.all([
    listCategories(),
    repository.findColorsInUse(),
    repository.findPriceRange(),
  ]);

  return {
    categories,
    colors,
    priceRange: {
      min: Math.floor(Number(priceRange.min)),
      max: Math.ceil(Number(priceRange.max)),
    },
  };
}
