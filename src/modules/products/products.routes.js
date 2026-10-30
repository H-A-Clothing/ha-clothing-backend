// Product URL paths (admin). Mounted at /api/v1/admin in app.js.
import { Router } from "express";
import * as controller from "./products.controller.js";

const router = Router();

// TODO: once Members 3/8 merge the auth middleware, protect everything here with
// router.use(authenticate, requireRole("admin", "manager"));

router.get("/categories", controller.listCategories);
router.post("/categories", controller.createCategory);
router.patch("/categories/:id", controller.updateCategory);

router.get("/colors", controller.listColors);
router.post("/colors", controller.createColor);
router.patch("/colors/:id", controller.updateColor);

export default router;