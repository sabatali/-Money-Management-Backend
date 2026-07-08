const express = require("express");
const auth = require("../middleware/auth.middleware");
const { getPendingClaims, claimGuestMember } = require("../controllers/groupMember.controller");

const router = express.Router();

// Claiming a guest profile isn't itself a collaborative-trust action, so
// it's intentionally not gated behind requireVerifiedEmail — a brand new,
// unverified user should still be able to claim their guest history.
router.use(auth);

router.get("/pending-claims", getPendingClaims);
router.post("/:memberId/claim", claimGuestMember);

module.exports = router;
