// Product request and response handling.
import * as service from "./products.service.js";
import { parseId } from "./products.validation.js";

// Express 4 does not catch errors from async handlers, so pass them to next().
const handle = (fn) => (req, res, next) => fn(req, res, next).catch(next);

export const listCategories = handle(async (req, res) => {
  res.json({ data: await service.listCategories() });
});

export const createCategory = handle(async (req, res) => {
  res.status(201).json({ data: await service.createCategory(req.body) });
});

export const updateCategory = handle(async (req, res) => {
  res.json({ data: await service.updateCategory(parseId(req.params.id), req.body) });
});

export const listColors = handle(async (req, res) => {
  res.json({ data: await service.listColors() });
});

export const createColor = handle(async (req, res) => {
  res.status(201).json({ data: await service.createColor(req.body) });
});

export const updateColor = handle(async (req, res) => {
  res.json({ data: await service.updateColor(parseId(req.params.id), req.body) });
});

export const listProducts = handle(async (req, res) => {
  res.json(await service.listProducts(req.query));
});

export const getProduct = handle(async (req, res) => {
  res.json({ data: await service.getProduct(parseId(req.params.id)) });
});

export const createProduct = handle(async (req, res) => {
  res.status(201).json({ data: await service.createProduct(req.body) });
});

export const updateProduct = handle(async (req, res) => {
  res.json({ data: await service.updateProduct(parseId(req.params.id), req.body) });
});