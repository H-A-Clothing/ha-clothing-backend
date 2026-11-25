// Product SQL queries only.
import { query } from "../../config/database.js";

// Column names come from the validation functions (never from the request), so building SET is safe.
function updateById(table, id, data) {
  const keys = Object.keys(data);
  const sets = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");
  return query(`UPDATE ${table} SET ${sets} WHERE id = $${keys.length + 1} RETURNING *`, [...Object.values(data), id]);
}

// ---- Categories ----
export async function listCategories() {
  const { rows } = await query(
    `SELECT c.*, (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
     FROM categories c
     ORDER BY c.sort_order, c.name`
  );
  return rows;
}

export async function findCategoryById(id) {
  const { rows } = await query("SELECT * FROM categories WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function findCategoryBySlug(slug) {
  const { rows } = await query("SELECT * FROM categories WHERE slug = $1", [slug]);
  return rows[0] ?? null;
}

export async function insertCategory({ name, slug, description = null, parent_id = null, sort_order = 0, is_active = true }) {
  const { rows } = await query(
    `INSERT INTO categories (name, slug, description, parent_id, sort_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, slug, description, parent_id, sort_order, is_active]
  );
  return rows[0];
}

export async function updateCategory(id, data) {
  const { rows } = await updateById("categories", id, data);
  return rows[0] ?? null;
}

// ---- Colours ----
export async function listColors() {
  const { rows } = await query("SELECT * FROM colors ORDER BY name");
  return rows;
}

export async function findColorById(id) {
  const { rows } = await query("SELECT * FROM colors WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function findColorByName(name) {
  const { rows } = await query("SELECT * FROM colors WHERE lower(name) = lower($1)", [name]);
  return rows[0] ?? null;
}

export async function insertColor({ name, hex }) {
  const { rows } = await query("INSERT INTO colors (name, hex) VALUES ($1, $2) RETURNING *", [name, hex]);
  return rows[0];
}

export async function updateColor(id, data) {
  const { rows } = await updateById("colors", id, data);
  return rows[0] ?? null;
}

// ---- Products ----
function productFilters({ search, categoryId, isActive }) {
  const where = [];
  const params = [];
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(p.name ILIKE $${params.length} OR p.slug ILIKE $${params.length})`);
  }
  if (categoryId) {
    params.push(categoryId);
    where.push(`p.category_id = $${params.length}`);
  }
  if (isActive !== undefined) {
    params.push(isActive);
    where.push(`p.is_active = $${params.length}`);
  }
  return { clause: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listProducts(filters, { limit, offset }) {
  const { clause, params } = productFilters(filters);
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name,
            (SELECT COUNT(*)::int FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
            (SELECT i.url FROM product_images i WHERE i.product_id = p.id
              ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS image_url
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${clause}
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: counted } = await query(`SELECT COUNT(*)::int AS total FROM products p ${clause}`, params);
  return { rows, total: counted[0].total };
}

export async function findProductById(id) {
  const { rows } = await query(
    `SELECT p.*, c.name AS category_name
     FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function findProductBySlug(slug) {
  const { rows } = await query("SELECT id, slug FROM products WHERE slug = $1", [slug]);
  return rows[0] ?? null;
}

export async function listVariantsForProduct(productId) {
  const { rows } = await query(
    `SELECT v.*, c.name AS color_name, c.hex AS color_hex
     FROM product_variants v JOIN colors c ON c.id = v.color_id
     WHERE v.product_id = $1
     ORDER BY c.name, v.size`,
    [productId]
  );
  return rows;
}

export async function listImagesForProduct(productId) {
  const { rows } = await query(
    "SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_primary DESC, sort_order, id",
    [productId]
  );
  return rows;
}

export async function insertProduct(data) {
  const { rows } = await query(
    `INSERT INTO products
       (category_id, name, slug, collection, description, fabric_care, price, sale_price, badge, is_active, is_featured)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      data.category_id,
      data.name,
      data.slug,
      data.collection ?? null,
      data.description ?? null,
      data.fabric_care ?? null,
      data.price,
      data.sale_price ?? null,
      data.badge ?? null,
      data.is_active ?? true,
      data.is_featured ?? false,
    ]
  );
  return rows[0];
}

export async function updateProduct(id, data) {
  const { rows } = await updateById("products", id, data);
  return rows[0] ?? null;
}