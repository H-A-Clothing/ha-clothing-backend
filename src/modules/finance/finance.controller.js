// Finance request and response handling.
import * as service from "./finance.service.js";
import { parseId } from "./finance.validation.js";

const handle = (fn) => (req, res, next) => fn(req, res, next).catch(next);

export const listExpenses = handle(async (req, res) => {
  res.json(await service.listExpenses(req.query));
});

export const getExpense = handle(async (req, res) => {
  res.json({ data: await service.getExpense(parseId(req.params.id)) });
});

export const createExpense = handle(async (req, res) => {
  res.status(201).json({ data: await service.createExpense(req.body, req.user?.id ?? null) });
});

export const updateExpense = handle(async (req, res) => {
  res.json({ data: await service.updateExpense(parseId(req.params.id), req.body) });
});

export const deleteExpense = handle(async (req, res) => {
  await service.deleteExpense(parseId(req.params.id));
  res.status(204).end();
});

export const listExpenseCategories = handle(async (req, res) => {
  res.json({ data: await service.listExpenseCategories({ includeInactive: req.query.includeInactive === "true" }) });
});

export const createExpenseCategory = handle(async (req, res) => {
  res.status(201).json({ data: await service.createExpenseCategory(req.body) });
});

export const removeExpenseCategory = handle(async (req, res) => {
  res.json({ data: await service.removeExpenseCategory(parseId(req.params.id)) });
});
