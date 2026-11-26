// Finance SQL queries only. Dynamic UPDATE columns are passed from validation allowlists.
import { query } from "../../config/database.js";

const expenseColumns = new Set(["category_id", "beneficiary", "description", "amount", "expense_date", "payment_method", "reference_no", "notes"]);

// The pool query helper is a function, while pg transactions provide a Client
// with a .query method. Accept both so transaction-bound repository calls work.
function execute(executor, text, params) {
  if (typeof executor === "function") return executor(text, params);
  if (executor && typeof executor.query === "function") return executor.query(text, params);
  throw new TypeError("A database query executor is required");
}

function makeFilters(filters) {
  const clauses = [];
  const params = [];
  if (filters.from) { params.push(filters.from); clauses.push(`e.expense_date >= $${params.length}`); }
  if (filters.to) { params.push(filters.to); clauses.push(`e.expense_date <= $${params.length}`); }
  if (filters.categoryId) { params.push(filters.categoryId); clauses.push(`e.category_id = $${params.length}`); }
  if (filters.search) {
    params.push(`%${filters.search.replace(/[\\%_]/g, "\\$&")}%`);
    clauses.push(`(e.reference_no ILIKE $${params.length} OR e.beneficiary ILIKE $${params.length} OR COALESCE(e.description, '') ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export async function listExpenses(filters, { limit, offset }) {
  const { where, params } = makeFilters(filters);
  const [result, count] = await Promise.all([
    query(
      `SELECT e.id, e.category_id, c.name AS category_name, e.beneficiary, e.description,
              e.amount, to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date, e.payment_method, e.reference_no, e.notes,
              e.created_at, e.updated_at
       FROM expenses e JOIN expense_categories c ON c.id = e.category_id
       ${where}
       ORDER BY e.expense_date DESC, e.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*)::int AS total, COALESCE(SUM(e.amount), 0)::numeric(12,2)::text AS total_amount FROM expenses e JOIN expense_categories c ON c.id = e.category_id ${where}`, params),
  ]);
  return { rows: result.rows, total: count.rows[0].total, totalAmount: Number(count.rows[0].total_amount) };
}

export async function findExpenseById(id, executor = query) {
  const { rows } = await execute(executor,
    `SELECT e.id, e.category_id, c.name AS category_name, e.beneficiary, e.description,
            e.amount, to_char(e.expense_date, 'YYYY-MM-DD') AS expense_date, e.payment_method, e.reference_no, e.notes,
            e.created_at, e.updated_at
     FROM expenses e JOIN expense_categories c ON c.id = e.category_id
     WHERE e.id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function insertExpense(data, createdBy, executor) {
  const { rows } = await execute(executor,
    `INSERT INTO expenses (category_id, beneficiary, description, amount, expense_date, payment_method, reference_no, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.category_id, data.beneficiary, data.description, data.amount, data.expense_date, data.payment_method, data.reference_no, data.notes, createdBy]
  );
  return rows[0];
}

export async function updateExpense(id, data, executor) {
  const entries = Object.entries(data);
  const safeEntries = entries.filter(([key]) => expenseColumns.has(key));
  const values = safeEntries.map(([, value]) => value);
  const setters = safeEntries.map(([key], index) => `${key} = $${index + 1}`).join(", ");
  const { rows } = await execute(executor,
    `UPDATE expenses SET ${setters} WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id]
  );
  return rows[0] ?? null;
}

export async function deleteExpense(id, executor) {
  const { rows } = await execute(executor, "DELETE FROM expenses WHERE id = $1 RETURNING id", [id]);
  return rows[0] ?? null;
}

export async function listCategories({ includeInactive = false } = {}, executor = query) {
  const { rows } = await execute(executor,
    `SELECT c.id, c.name, c.is_active, c.created_at, c.updated_at,
            COUNT(e.id)::int AS expense_count
     FROM expense_categories c LEFT JOIN expenses e ON e.category_id = c.id
     ${includeInactive ? "" : "WHERE c.is_active = TRUE"}
     GROUP BY c.id ORDER BY c.name`
  );
  return rows;
}

export async function findCategoryById(id, executor = query) {
  const { rows } = await execute(executor, "SELECT id, name, is_active FROM expense_categories WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function findCategoryByName(name, executor = query) {
  const { rows } = await execute(executor, "SELECT id, name, is_active FROM expense_categories WHERE lower(name) = lower($1)", [name]);
  return rows[0] ?? null;
}

export async function insertCategory({ name }, executor) {
  const { rows } = await execute(executor, "INSERT INTO expense_categories (name) VALUES ($1) RETURNING id, name, is_active", [name]);
  return rows[0];
}

export async function deactivateCategory(id, executor) {
  const { rows } = await execute(executor, "UPDATE expense_categories SET is_active = FALSE WHERE id = $1 AND is_active = TRUE RETURNING id, name, is_active", [id]);
  return rows[0] ?? null;
}

export async function activateCategory(id, executor) {
  const { rows } = await execute(executor, "UPDATE expense_categories SET is_active = TRUE WHERE id = $1 RETURNING id, name, is_active", [id]);
  return rows[0] ?? null;
}
