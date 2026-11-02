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