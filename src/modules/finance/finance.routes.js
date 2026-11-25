// Finance URL paths.
import { Router } from "express";
import * as controller from "./finance.controller.js";

const router = Router();

// Match the current project pattern; wire authenticate + requireRole when the shared
// Member 3/8 middleware is merged. Do not edit their middleware from this module.
// router.use(authenticate, requireRole("admin", "manager"));

router.get("/categories", controller.listExpenseCategories);
router.post("/categories", controller.createExpenseCategory);
router.delete("/categories/:id", controller.removeExpenseCategory);

router.get("/", controller.listExpenses);
router.post("/", controller.createExpense);
router.get("/:id", controller.getExpense);
router.patch("/:id", controller.updateExpense);
router.delete("/:id", controller.deleteExpense);

export default router;
