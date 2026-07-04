const express = require("express");
const auth = require("../middleware/auth.middleware");
const { getGroupBalances } = require("../controllers/settlement.controller");

const router = express.Router();

router.use(auth);

router.get("/groups/:id/balances", getGroupBalances);

module.exports = router;
