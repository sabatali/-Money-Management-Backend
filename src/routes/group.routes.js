const express = require("express");
const { body } = require("express-validator");
const auth = require("../middleware/auth.middleware");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail.middleware");
const {
  createGroup,
  getUserGroups,
  getGroupDetails,
  addMemberToGroup,
  addGuestMember,
  updateGuestMember,
  inviteGuestMember,
  removeMemberFromGroup,
  createGroupTransfer,
  getGroupTransfers,
  confirmGroupTransfer,
  rejectGroupTransfer,
  getGroupMemberAccounts,
  getMyGroupAccounts,
  linkGroupAccounts,
} = require("../controllers/group.controller");
const { getGroupBalances } = require("../controllers/settlement.controller");

const router = express.Router();

// requiresVerifiedEmail = true — Group Expenses is a collaborative feature
// that needs trusted user identity (see requireVerifiedEmail.middleware.js).
router.use(auth);
router.use(requireVerifiedEmail);

router.post("/", [body("name").trim().notEmpty().withMessage("Name is required.")], createGroup);
router.get("/", getUserGroups);
router.get("/:id/balances", getGroupBalances);
router.get("/:id", getGroupDetails);

router.post(
  "/:id/members",
  [
    body("userId").optional().isMongoId().withMessage("Valid userId is required."),
    body("email").optional().isEmail().withMessage("Valid email is required."),
  ],
  addMemberToGroup
);

router.post(
  "/:id/members/guest",
  [
    body("name").trim().notEmpty().withMessage("Guest name is required."),
    body("email").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("Valid email is required."),
  ],
  addGuestMember
);
router.put(
  "/:id/members/:memberId/guest",
  [
    body("email").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("Valid email is required."),
  ],
  updateGuestMember
);
router.post("/:id/members/:memberId/invite", inviteGuestMember);

router.delete("/:id/members/:memberId", removeMemberFromGroup);

router.post(
  "/:id/transfers",
  [
    body("fromUser").isMongoId().withMessage("fromUser is required."),
    body("toUser").isMongoId().withMessage("toUser is required."),
    body("amountPKR").isNumeric().withMessage("amountPKR must be a number."),
    body("account").optional({ nullable: true, checkFalsy: true }).trim(),
    body("date").notEmpty().withMessage("date is required."),
  ],
  createGroupTransfer
);
router.get("/:id/transfers", getGroupTransfers);
router.post("/:id/transfers/:transferId/confirm", [
  body("toAccount").trim().notEmpty().withMessage("toAccount is required."),
], confirmGroupTransfer);
router.post("/:id/transfers/:transferId/reject", rejectGroupTransfer);

router.get("/:id/member-accounts", getGroupMemberAccounts);
router.get("/:id/my-accounts", getMyGroupAccounts);
router.post(
  "/:id/link-accounts",
  [body("accounts").isArray({ min: 1, max: 2 }).withMessage("Link 1-2 accounts.")],
  linkGroupAccounts
);

module.exports = router;
