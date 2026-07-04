const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const {
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountBalances,
} = require("../controllers/account.controller");

const router = express.Router();

router.use(auth);

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("currency")
      .optional()
      .isIn(["USD", "PKR"])
      .withMessage("Currency must be USD or PKR."),
    body("openingBalance")
      .optional()
      .isNumeric()
      .withMessage("Opening balance must be a number."),
  ],
  createAccount
);

router.get("/", getAccounts);
router.get("/balances", getAccountBalances);
router.get("/:id", getAccountById);

router.put(
  "/:id",
  [
    body("name").optional().trim().notEmpty().withMessage("Name is required."),
    body("currency")
      .optional()
      .isIn(["USD", "PKR"])
      .withMessage("Currency must be USD or PKR."),
    body("openingBalance")
      .optional()
      .isNumeric()
      .withMessage("Opening balance must be a number."),
  ],
  updateAccount
);

router.delete("/:id", deleteAccount);

module.exports = router;
