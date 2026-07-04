const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} = require("../controllers/category.controller");

const router = express.Router();

router.use(auth);

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("type").isIn(["income", "expense"]).withMessage("Type must be income or expense."),
  ],
  createCategory
);

router.get("/", getCategories);
router.get("/:id", getCategoryById);

router.put(
  "/:id",
  [
    body("name").optional().trim().notEmpty().withMessage("Name is required."),
    body("type").optional().isIn(["income", "expense"]).withMessage("Type must be income or expense."),
  ],
  updateCategory
);

router.delete("/:id", deleteCategory);

module.exports = router;
