// Catalogue request and response handling.
import * as service from "./catalogue.service.js";
import { validateProductQuery, validateSlug } from "./catalogue.validation.js";

// Express 4 doesn't catch errors from async handlers, so pass them to the error middleware.
const handle = (fn) => (req, res, next) => fn(req, res).catch(next);

export const listProducts = handle(async (req, res) => {
  const filters = validateProductQuery(req.query);
  res.json(await service.listProducts(filters));
});

export const getProduct = handle(async (req, res) => {
  const slug = validateSlug(req.params.slug);
  res.json(await service.getProduct(slug));
});

export const listCategories = handle(async (req, res) => {
  res.json(await service.listCategories());
});

export const getFilterOptions = handle(async (req, res) => {
  res.json(await service.getFilterOptions());
});
