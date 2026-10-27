// Catalogue URL paths, mounted at /api/v1/catalogue. All public (no login needed).
// Wishlist routes are added once customer login (Member 3) is ready.
import { Router } from "express";
import * as controller from "./catalogue.controller.js";

const router = Router();

router.get("/products", controller.listProducts);
router.get("/products/:slug", controller.getProduct);
router.get("/categories", controller.listCategories);
router.get("/filters", controller.getFilterOptions);

export default router;
