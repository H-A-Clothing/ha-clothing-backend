// Catalogue SQL queries only.
import { query } from "../../config/database.js";

// Orders in these states count as sold (for "Bestselling").
const SOLD_STATUSES = ["paid", "processing", "dispatched", "delivered"];

// Shared SELECT for product cards and the detail page.
// colors and sizes are built as JSON arrays; stock per size is summed across colours.
const PRODUCT_SELECT = `
  SELECT
    p.id, p.slug, p.name, p.collection, p.price, p.sale_price, p.badge,
    p.description, p.fabric_care, p.created_at,
    cat.slug AS category, cat.name AS category_label,
    (SELECT i.url FROM product_images i
      WHERE i.product_id = p.id
      ORDER BY i.is_primary DESC, i.sort_order, i.id
      LIMIT 1) AS image,
    COALESCE((
      SELECT json_agg(json_build_object('name', c.name, 'hex', c.hex) ORDER BY c.first_variant)
      FROM (
        SELECT col.name, col.hex, MIN(v.id) AS first_variant
        FROM product_variants v JOIN colors col ON col.id = v.color_id
        WHERE v.product_id = p.id AND v.is_active
        GROUP BY col.name, col.hex
      ) c
    ), '[]'::json) AS colors,
    COALESCE((
      SELECT json_agg(json_build_object('size', s.size, 'stock', s.stock)
                      ORDER BY array_position(ARRAY['XS','S','M','L','XL']::varchar[], s.size), s.size)
      FROM (
        SELECT v.size, COALESCE(SUM(st.quantity_available), 0)::int AS stock
        FROM product_variants v LEFT JOIN stock st ON st.variant_id = v.id
        WHERE v.product_id = p.id AND v.is_active
        GROUP BY v.size
      ) s
    ), '[]'::json) AS sizes,
    COALESCE(sold.quantity, 0)::int AS sold
  FROM products p
  JOIN categories cat ON cat.id = p.category_id
  LEFT JOIN (
    SELECT oi.product_id, SUM(oi.quantity) AS quantity
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status = ANY($1)
    GROUP BY oi.product_id
  ) sold ON sold.product_id = p.id
`;

// Sort keys come from validation (a fixed list), never straight from the request.
const ORDER_BY = {
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "COALESCE(p.sale_price, p.price) ASC, p.id",
  price_desc: "COALESCE(p.sale_price, p.price) DESC, p.id",
  bestselling: "sold DESC, p.created_at DESC, p.id DESC",
};

// Builds the WHERE clause. Every user value goes in as a $n parameter.
function buildFilters(filters, params) {
  const add = (value) => {
    params.push(value);
    return `$${params.length}`;
  };
  const where = ["p.is_active", "cat.is_active"];

  if (filters.category) where.push(`cat.slug = ${add(filters.category)}`);
  if (filters.collection === "new") where.push("p.badge = 'New'");
  if (filters.collection === "sale") where.push("p.sale_price IS NOT NULL");

  if (filters.q) {
    const patterns = filters.q.split(/\s+/).filter(Boolean).map((word) => `%${word}%`);
    const list = add(patterns);
    where.push(`(p.name ILIKE ANY(${list}) OR p.collection ILIKE ANY(${list}) OR cat.name ILIKE ANY(${list}))`);
  }

  if (filters.sizes.length) {
    where.push(`EXISTS (
      SELECT 1 FROM product_variants v JOIN stock st ON st.variant_id = v.id
      WHERE v.product_id = p.id AND v.is_active AND st.quantity_available > 0
        AND v.size = ANY(${add(filters.sizes)}))`);
  }

  if (filters.colors.length) {
    where.push(`EXISTS (
      SELECT 1 FROM product_variants v JOIN colors col ON col.id = v.color_id
      WHERE v.product_id = p.id AND v.is_active AND col.name = ANY(${add(filters.colors)}))`);
  }

  if (filters.minPrice !== undefined) where.push(`COALESCE(p.sale_price, p.price) >= ${add(filters.minPrice)}`);
  if (filters.maxPrice !== undefined) where.push(`COALESCE(p.sale_price, p.price) <= ${add(filters.maxPrice)}`);

  if (filters.inStock) {
    where.push(`EXISTS (
      SELECT 1 FROM product_variants v JOIN stock st ON st.variant_id = v.id
      WHERE v.product_id = p.id AND v.is_active AND st.quantity_available > 0)`);
  }

  return where.join(" AND ");
}

export async function findProducts(filters, { sort, limit, offset }) {
  const params = [SOLD_STATUSES];
  const where = buildFilters(filters, params);

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM (${PRODUCT_SELECT} WHERE ${where}) filtered`,
    params
  );

  params.push(limit, offset);
  const { rows } = await query(
    `${PRODUCT_SELECT} WHERE ${where}
     ORDER BY ${ORDER_BY[sort]}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows, total: countRows[0].total };
}

export async function findProductBySlug(slug) {
  const { rows } = await query(
    `${PRODUCT_SELECT} WHERE p.slug = $2 AND p.is_active AND cat.is_active`,
    [SOLD_STATUSES, slug]
  );
  return rows[0] ?? null;
}

export async function findRelatedProducts(productId, categorySlug, limit = 4) {
  const { rows } = await query(
    `${PRODUCT_SELECT}
     WHERE p.is_active AND cat.is_active AND cat.slug = $2 AND p.id <> $3
     ORDER BY sold DESC, p.created_at DESC
     LIMIT $4`,
    [SOLD_STATUSES, categorySlug, productId, limit]
  );
  return rows;
}

export async function findCategories() {
  const { rows } = await query(
    `SELECT cat.slug, cat.name, cat.description,
            COUNT(p.id) FILTER (WHERE p.is_active)::int AS count
     FROM categories cat
     LEFT JOIN products p ON p.category_id = cat.id
     WHERE cat.is_active
     GROUP BY cat.id
     ORDER BY cat.sort_order, cat.name`
  );
  return rows;
}

export async function findColorsInUse() {
  const { rows } = await query(
    `SELECT col.name, col.hex
     FROM colors col
     WHERE EXISTS (
       SELECT 1 FROM product_variants v JOIN products p ON p.id = v.product_id
       WHERE v.color_id = col.id AND v.is_active AND p.is_active)
     ORDER BY col.id`
  );
  return rows;
}

export async function findPriceRange() {
  const { rows } = await query(
    `SELECT COALESCE(MIN(COALESCE(sale_price, price)), 0) AS min,
            COALESCE(MAX(price), 0) AS max
     FROM products WHERE is_active`
  );
  return rows[0];
}
