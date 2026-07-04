const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const {
  createGroupExpense,
  getGroupExpenses,
  getGroupExpenseById,
  updateGroupExpense,
  deleteGroupExpense,
} = require("../controllers/groupExpense.controller");

const router = express.Router();

router.use(auth);

const expenseValidators = [
  body("group").isMongoId().withMessage("group is required."),
  body("title").trim().notEmpty().withMessage("title is required."),
  body("totalAmountOriginal").isNumeric().withMessage("totalAmountOriginal is required."),
  body("currency").isIn(["USD", "PKR"]).withMessage("currency is required."),
  body("paidBy").isMongoId().withMessage("paidBy is required."),
  body("splitType").isIn(["EQUAL", "MANUAL"]).withMessage("splitType is required."),
  body("accountUsed").trim().notEmpty().withMessage("accountUsed is required."),
  body("date").notEmpty().withMessage("date is required."),
];

router.post("/", expenseValidators, createGroupExpense);
router.get("/", getGroupExpenses);
router.get("/:id", getGroupExpenseById);
router.put("/:id", expenseValidators, updateGroupExpense);
router.delete("/:id", deleteGroupExpense);

module.exports = router;
