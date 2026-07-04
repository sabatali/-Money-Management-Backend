const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transaction.controller");

const router = express.Router();

router.use(auth);

router.post(
  "/",
  [
    body("date").notEmpty().withMessage("Date is required."),
    body("type").isIn(["income", "expense"]).withMessage("Type must be income or expense."),
    body("category").notEmpty().withMessage("Category is required."),
    body("amount").isNumeric().withMessage("Amount must be a number."),
    body("currency").isIn(["USD", "PKR"]).withMessage("Currency must be USD or PKR."),
    body("account").trim().notEmpty().withMessage("Account is required."),
  ],
  createTransaction
);

router.get("/", getTransactions);
router.get("/:id", getTransactionById);

router.put(
  "/:id",
  [
    body("type").optional().isIn(["income", "expense"]).withMessage("Type must be income or expense."),
    body("amount").optional().isNumeric().withMessage("Amount must be a number."),
    body("currency").optional().isIn(["USD", "PKR"]).withMessage("Currency must be USD or PKR."),
    body("account").optional().trim().notEmpty().withMessage("Account is required."),
  ],
  updateTransaction
);

router.delete("/:id", deleteTransaction);

module.exports = router;
