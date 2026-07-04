const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const {
  createLoan,
  getLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
} = require("../controllers/loan.controller");

const router = express.Router();

router.use(auth);

const loanAccountRules = (isUpdate = false) => {
  const optional = isUpdate ? { values: "undefined" } : {};
  return [
    body("person")
      .if((value, { req }) => !isUpdate)
      .notEmpty()
      .withMessage("Person name is required."),
    body("amountPKR")
      .if((value, { req }) => !isUpdate)
      .isNumeric()
      .withMessage("Amount must be a number."),
    body("amountPKR")
      .if((value, { req }) => isUpdate)
      .optional(optional)
      .isNumeric()
      .withMessage("Amount must be a number."),
    body("fromAccount").optional(optional).trim(),
    body("toAccount").optional(optional).trim(),
    body("status")
      .optional(optional)
      .isIn(["Pending", "Returned"])
      .withMessage("Invalid status."),
    body("dateGiven")
      .if((value, { req }) => !isUpdate)
      .notEmpty()
      .withMessage("dateGiven is required."),
  ];
};

router.post("/", loanAccountRules(false), createLoan);

router.get("/", getLoans);
router.get("/:id", getLoanById);

router.put("/:id", loanAccountRules(true), updateLoan);

router.delete("/:id", deleteLoan);

module.exports = router;
