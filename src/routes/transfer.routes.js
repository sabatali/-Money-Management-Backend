const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const {
  createTransfer,
  getTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
} = require("../controllers/transfer.controller");

const router = express.Router();

router.use(auth);

router.post(
  "/",
  [
    body("fromAccount").trim().notEmpty().withMessage("fromAccount is required."),
    body("toAccount").trim().notEmpty().withMessage("toAccount is required."),
    body("amountOriginal").isNumeric().withMessage("Amount must be a number."),
    body("currency").isIn(["USD", "PKR"]).withMessage("Currency must be USD or PKR."),
    body("date").notEmpty().withMessage("Date is required."),
    body("fee").optional().isNumeric().withMessage("Fee must be a number."),
    body("feeCurrency").optional().isIn(["USD", "PKR"]).withMessage("Fee currency must be USD or PKR."),
  ],
  createTransfer
);

router.get("/", getTransfers);
router.get("/:id", getTransferById);

router.put(
  "/:id",
  [
    body("fromAccount").optional().trim().notEmpty().withMessage("fromAccount is required."),
    body("toAccount").optional().trim().notEmpty().withMessage("toAccount is required."),
    body("amountOriginal").optional().isNumeric().withMessage("Amount must be a number."),
    body("currency").optional().isIn(["USD", "PKR"]).withMessage("Currency must be USD or PKR."),
    body("fee").optional().isNumeric().withMessage("Fee must be a number."),
    body("feeCurrency").optional().isIn(["USD", "PKR"]).withMessage("Fee currency must be USD or PKR."),
  ],
  updateTransfer
);

router.delete("/:id", deleteTransfer);

module.exports = router;
