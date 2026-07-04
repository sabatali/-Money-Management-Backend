const express = require("express");
const { body } = require("express-validator");
const { resetDatabase } = require("../controllers/dev.controller");

const router = express.Router();

router.post(
  "/reset-database",
  [body("confirm").equals("RESET").withMessage('confirm must be "RESET".')],
  resetDatabase
);

module.exports = router;
