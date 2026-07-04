const express = require("express");
const auth = require("../middleware/auth.middleware");
const { getExchangeRate, updateExchangeRate } = require("../controllers/setting.controller");

const router = express.Router();

router.use(auth);

router.get("/exchange-rate", getExchangeRate);
router.put("/exchange-rate", updateExchangeRate);

module.exports = router;
