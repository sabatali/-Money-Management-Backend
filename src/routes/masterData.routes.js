const express = require("express");
const auth = require("../middleware/auth.middleware");
const {
  getMasterAccounts,
  getMasterCategories,
} = require("../controllers/masterData.controller");

const router = express.Router();

router.use(auth);

router.get("/accounts", getMasterAccounts);
router.get("/categories", getMasterCategories);

module.exports = router;
