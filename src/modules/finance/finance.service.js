// Finance business rules. Keep validation and multi-step writes inside service functions.
import { withTransaction } from "../../config/database.js";
import { AppError } from "../../utils/errors.js";
import * as repo from "./finance.repository.js";
import { parseExpenseListQuery, validateCategory, validateExpense } from "./finance.validation.js";

const UNIQUE_VIOLATION = "23505";

function translateConflict(error) {
  if (error.code === UNIQUE_VIOLATION && error.constraint?.includes("reference_no")) {
    throw AppError.conflict("That reference / voucher number is already in use");
  }
  if (error.code === UNIQUE_VIOLATION && error.constraint?.includes("expense_categories_name")) {
    throw AppError.conflict("An expense category with that name already exists");
  }
  throw error;
}

function formatExpense(row) {
  if (!row) return null;
  return { ...row, amount: Number(row.amount) };
}

async function assertActiveCategory(categoryId, executor) {
  const category = await repo.findCategoryById(categoryId, executor);
  if (!category || !category.is_active) throw AppError.badRequest("Validation failed", { category_id: "Choose an active expense category" });
}

export async function listExpenses(query) {
  const { page, limit, offset, filters } = parseExpenseListQuery(query);
  const { rows, total, totalAmount } = await repo.listExpenses(filters, { limit, offset });
  return { data: rows.map(formatExpense), meta: { page, limit, total, totalAmount } };
}

export async function getExpense(id) {
  const expense = await repo.findExpenseById(id);
  if (!expense) throw AppError.notFound("Expense not found");
  return formatExpense(expense);
}

export async function createExpense(body, createdBy = null) {
  const data = validateExpense(body);
  try {
    const created = await withTransaction(async (client) => {
      await assertActiveCategory(data.category_id, client);
      const inserted = await repo.insertExpense(data, createdBy, client);
      return repo.findExpenseById(inserted.id, client);
    });
    return formatExpense(created);
  } catch (error) {
    translateConflict(error);
  }
}

export async function updateExpense(id, body) {
  const data = validateExpense(body, { partial: true });
  if (!Object.keys(data).length) throw AppError.badRequest("Nothing to update");
  try {
    const updated = await withTransaction(async (client) => {
      const existing = await repo.findExpenseById(id, client);
      if (!existing) throw AppError.notFound("Expense not found");
      if (data.category_id !== undefined && data.category_id !== existing.category_id) await assertActiveCategory(data.category_id, client);
      await repo.updateExpense(id, data, client);
      return repo.findExpenseById(id, client);
    });
    return formatExpense(updated);
  } catch (error) {
    translateConflict(error);
  }
}

export async function deleteExpense(id) {
  return withTransaction(async (client) => {
    const deleted = await repo.deleteExpense(id, client);
    if (!deleted) throw AppError.notFound("Expense not found");
    return { id: deleted.id };
  });
}

export const listExpenseCategories = (options) => repo.listCategories(options);

export async function createExpenseCategory(body) {
  const data = validateCategory(body);
  try {
    return await withTransaction(async (client) => {
      const existing = await repo.findCategoryByName(data.name, client);
      if (existing) {
        if (existing.is_active) throw AppError.conflict("An expense category with that name already exists");
        return repo.activateCategory(existing.id, client);
      }
      return repo.insertCategory(data, client);
    });
  } catch (error) {
    translateConflict(error);
  }
}

export async function removeExpenseCategory(id) {
  return withTransaction(async (client) => {
    const category = await repo.findCategoryById(id, client);
    if (!category || !category.is_active) throw AppError.notFound("Expense category not found");
    const removed = await repo.deactivateCategory(id, client);
    return removed;
  });
}
