const { validationResult } = require("express-validator");
const Group = require("../models/group.model");
const User = require("../models/user.model");
const GroupMember = require("../models/groupMember.model");
const GroupTransfer = require("../models/groupTransfer.model");
const GroupMemberAccount = require("../models/groupMemberAccount.model");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Transfer = require("../models/transfer.model");
const Loan = require("../models/loan.model");
const { calculateAccountBalances, getAccountBalancePKR } = require("../utils/accountBalanceCalculator");
const { createSettlementTransactions } = require("../utils/groupLedger");
const { ValidationError } = require("../utils/nameValidation");
const {
  resolveGroupMember,
  listGroupMembers,
  serializeMemberRef,
  serializeMemberFull,
  ensureRegisteredMember,
  createGuestMember,
  updateGuestMember: applyGuestUpdate,
} = require("../utils/groupMemberService");
const { sendGuestInviteEmail } = require("../utils/emailService");

const GUEST_INVITE_COOLDOWN_MS = 60 * 1000;

const ensureMember = (group, userId) =>
  group.members.some((member) => {
    const memberId = member.user?._id || member.user;
    return String(memberId) === String(userId);
  });

const ensureAdmin = (group, userId) =>
  group.members.some((member) => {
    const memberId = member.user?._id || member.user;
    return String(memberId) === String(userId) && member.role === "admin";
  });

const getUserAccountBalance = async (userId, accountName) => {
  const accounts = await Account.find({ user: userId });
  const [transactions, transfers, loans] = await Promise.all([
    Transaction.find({ user: userId }),
    Transfer.find({ user: userId }),
    Loan.find({ user: userId }),
  ]);
  const balances = calculateAccountBalances({
    accounts,
    transactions,
    transfers,
    loans,
  });
  return getAccountBalancePKR(balances, accountName);
};

const ensureLinkedAccount = async (groupId, userId, accountName) => {
  const linked = await GroupMemberAccount.findOne({ group: groupId, user: userId });
  if (!linked?.accounts?.length) {
    return "Link at least one account to this group first.";
  }
  if (!linked.accounts.includes(accountName)) {
    return "Account must be one of your linked group accounts.";
  }
  return null;
};

const withGroupMembers = async (group) => {
  const groupObj = group.toObject ? group.toObject() : group;
  const members = await listGroupMembers(groupObj._id);
  groupObj.groupMembers = members.map(serializeMemberFull);
  return groupObj;
};

const serializeTransfer = (transferDoc) => {
  const obj = transferDoc.toObject ? transferDoc.toObject() : transferDoc;
  return {
    ...obj,
    fromUser: serializeMemberRef(transferDoc.fromUser),
    toUser: serializeMemberRef(transferDoc.toUser),
  };
};

const populateTransfer = (query) =>
  query
    .populate({ path: "fromUser", populate: { path: "user", select: "name email" } })
    .populate({ path: "toUser", populate: { path: "user", select: "name email" } });

const createGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { name } = req.body;
    const group = await Group.create({
      name,
      createdBy: req.user.id,
      members: [{ user: req.user.id, role: "admin" }],
    });

    await ensureRegisteredMember({
      group: group._id,
      userId: req.user.id,
      role: "admin",
      joinedAt: group.createdAt,
    });

    const populated = await Group.findById(group._id).populate("members.user", "name email");
    const data = await withGroupMembers(populated);
    return res.status(201).json({ message: "Group created.", data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create group.", error: error.message });
  }
};

const getUserGroups = async (req, res) => {
  try {
    const groups = await Group.find({ "members.user": req.user.id })
      .sort({ createdAt: -1 })
      .populate("members.user", "name email");
    return res.status(200).json({ data: groups });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch groups.", error: error.message });
  }
};

const getGroupDetails = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate("members.user", "name email");
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: req.params.id },
      });
    }
    const data = await withGroupMembers(group);
    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch group.", error: error.message });
  }
};

const addMemberToGroup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only admins can add members." });
    }

    const { userId, email, role } = req.body;
    const user =
      userId ? await User.findById(userId) : await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const alreadyMember = group.members.some(
      (member) => String(member.user) === String(user._id)
    );
    if (alreadyMember) {
      return res.status(409).json({ message: "User already in group." });
    }

    group.members.push({ user: user._id, role: role || "member" });
    await group.save();
    await ensureRegisteredMember({ group: group._id, userId: user._id, role: role || "member" });

    const populated = await Group.findById(group._id).populate("members.user", "name email");
    const data = await withGroupMembers(populated);
    return res.status(200).json({ message: "Member added.", data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add member.", error: error.message });
  }
};

const addGuestMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only admins can add members." });
    }

    const { name, email, phone, notes } = req.body;
    const guest = await createGuestMember({
      group: group._id,
      name,
      email,
      phone,
      notes,
      addedBy: req.user.id,
    });

    const data = await withGroupMembers(group);
    return res.status(201).json({ message: "Guest added.", data, member: serializeMemberFull(guest) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to add guest.", error: error.message });
  }
};

const updateGuestMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only admins can edit members." });
    }

    const member = await GroupMember.findOne({ _id: req.params.memberId, group: group._id });
    if (!member || member.memberType !== "guest") {
      return res.status(404).json({ message: "Guest member not found." });
    }

    const { name, email, phone, notes } = req.body;
    await applyGuestUpdate(member, { name, email, phone, notes });

    const data = await withGroupMembers(group);
    return res.status(200).json({ message: "Guest updated.", data, member: serializeMemberFull(member) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to update guest.", error: error.message });
  }
};

const inviteGuestMember = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only admins can invite guests." });
    }

    const member = await GroupMember.findOne({ _id: req.params.memberId, group: group._id });
    if (!member || member.memberType !== "guest") {
      return res.status(404).json({ message: "Guest member not found." });
    }

    if (req.body?.email && !member.guestEmail) {
      await applyGuestUpdate(member, { email: req.body.email });
    }

    if (!member.guestEmail) {
      return res.status(400).json({
        message: "This guest has no email address yet. Add one before sending an invite.",
      });
    }

    if (member.guestInviteSentAt) {
      const elapsedMs = Date.now() - member.guestInviteSentAt.getTime();
      if (elapsedMs < GUEST_INVITE_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((GUEST_INVITE_COOLDOWN_MS - elapsedMs) / 1000);
        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          message: `Please wait ${retryAfterSeconds}s before resending this invite.`,
          retryAfterSeconds,
        });
      }
    }

    const inviter = await User.findById(req.user.id).select("name");
    await sendGuestInviteEmail({
      to: member.guestEmail,
      guestName: member.guestName,
      groupName: group.name,
      inviterName: inviter?.name || "A group admin",
    });

    member.guestInviteSentAt = new Date();
    await member.save();

    return res.status(200).json({ message: "Invitation email sent.", member: serializeMemberFull(member) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to send invite.", error: error.message });
  }
};

const removeMemberFromGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureAdmin(group, req.user.id)) {
      return res.status(403).json({ message: "Only admins can remove members." });
    }

    const member = await resolveGroupMember(group._id, req.params.memberId);
    if (!member) {
      return res.status(404).json({ message: "Member not found in group." });
    }

    if (member.memberType === "registered") {
      group.members = group.members.filter(
        (groupMember) => String(groupMember.user) !== String(member.user)
      );
      await group.save();
    }
    await GroupMember.deleteOne({ _id: member._id });

    const populated = await Group.findById(group._id).populate("members.user", "name email");
    const data = await withGroupMembers(populated);
    return res.status(200).json({ message: "Member removed.", data });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove member.", error: error.message });
  }
};

const createGroupTransfer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: req.params.id },
      });
    }

    const { fromUser: fromRef, toUser: toRef, amountPKR, account, toAccount, date } = req.body;

    const [fromMember, toMember] = await Promise.all([
      resolveGroupMember(group._id, fromRef),
      resolveGroupMember(group._id, toRef),
    ]);
    if (!fromMember || !toMember) {
      return res.status(400).json({ message: "Transfer users must be group members." });
    }
    if (String(fromMember._id) === String(toMember._id)) {
      return res.status(400).json({ message: "Cannot record a payment to the same member." });
    }

    const requesterIsAdmin = ensureAdmin(group, req.user.id);
    const requesterIsFromUser =
      fromMember.memberType === "registered" && String(fromMember.user) === String(req.user.id);
    const requesterIsToUser =
      toMember.memberType === "registered" && String(toMember.user) === String(req.user.id);

    if (!requesterIsFromUser && !requesterIsToUser && !requesterIsAdmin) {
      return res.status(403).json({
        message: "Only the payer, the receiver, or a group admin can record this payment.",
      });
    }

    const involvesGuest = fromMember.memberType === "guest" || toMember.memberType === "guest";

    if (fromMember.memberType === "registered") {
      const accountError = await ensureLinkedAccount(group._id, fromMember.user, account);
      if (accountError) {
        return res.status(400).json({ message: accountError });
      }
      const availableBalance = await getUserAccountBalance(fromMember.user, account);
      if (Number(amountPKR) > availableBalance) {
        return res.status(400).json({
          message: `Insufficient balance. Available PKR ${availableBalance.toLocaleString()}.`,
        });
      }
    }

    let status = "Pending";
    let confirmedAt = null;
    let confirmedBy = null;
    let finalToAccount = toAccount;

    if (involvesGuest) {
      // A guest can't log in to confirm, so whoever records this (the
      // registered counterparty or an admin) is asserting the real-world
      // payment already happened — skip the Pending handshake entirely.
      status = "Confirmed";
      confirmedAt = new Date();
      confirmedBy = req.user.id;

      if (toMember.memberType === "registered") {
        if (!toAccount) {
          return res.status(400).json({
            message: "toAccount is required when the receiver is a registered member.",
          });
        }
        const receiverAccountError = await ensureLinkedAccount(group._id, toMember.user, toAccount);
        if (receiverAccountError) {
          return res.status(400).json({ message: receiverAccountError });
        }
        finalToAccount = toAccount;
      } else {
        finalToAccount = undefined;
      }
    }

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromUser: fromMember._id,
      toUser: toMember._id,
      amountPKR,
      account: fromMember.memberType === "registered" ? account : undefined,
      toAccount: finalToAccount,
      date,
      status,
      createdBy: req.user.id,
      confirmedAt,
      confirmedBy,
    });

    if (status === "Confirmed") {
      const [fromUserDoc, toUserDoc] = await Promise.all([
        fromMember.memberType === "registered" ? User.findById(fromMember.user).select("name") : null,
        toMember.memberType === "registered" ? User.findById(toMember.user).select("name") : null,
      ]);
      await createSettlementTransactions({
        transfer,
        groupName: group.name,
        fromUserName: fromUserDoc?.name || fromMember.guestName || "Member",
        toUserName: toUserDoc?.name || toMember.guestName || "Member",
        fromUserRealId: fromMember.memberType === "registered" ? fromMember.user : null,
        toUserRealId: toMember.memberType === "registered" ? toMember.user : null,
      });
    }

    const populated = await populateTransfer(GroupTransfer.findById(transfer._id));
    return res.status(201).json({
      message:
        status === "Confirmed"
          ? "Payment recorded."
          : "Transfer recorded. Waiting for confirmation.",
      data: serializeTransfer(populated),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to record transfer.", error: error.message });
  }
};

const confirmGroupTransfer = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const { toAccount } = req.body;

    const transfer = await GroupTransfer.findOne({
      _id: req.params.transferId,
      group: group._id,
    });

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    const [fromMember, toMember] = await Promise.all([
      GroupMember.findById(transfer.fromUser),
      GroupMember.findById(transfer.toUser),
    ]);

    // Only the toUser (receiver) can confirm
    if (!toMember || toMember.memberType !== "registered" || String(toMember.user) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the receiver can confirm this payment." });
    }

    if (transfer.status !== "Pending") {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}.` });
    }

    if (!toAccount) {
      return res.status(400).json({ message: "toAccount is required to confirm payment." });
    }

    const receiverAccountError = await ensureLinkedAccount(group._id, toMember.user, toAccount);
    if (receiverAccountError) {
      return res.status(400).json({ message: receiverAccountError });
    }

    const payerAccountError = await ensureLinkedAccount(
      group._id,
      fromMember.user,
      transfer.account
    );
    if (payerAccountError) {
      return res.status(400).json({ message: "Payer no longer has a valid linked account." });
    }

    const availableBalance = await getUserAccountBalance(fromMember.user, transfer.account);
    if (Number(transfer.amountPKR) > availableBalance) {
      return res.status(400).json({
        message: `Payer has insufficient balance. Available PKR ${availableBalance.toLocaleString()}.`,
      });
    }

    const [fromUserDoc, toUserDoc] = await Promise.all([
      User.findById(fromMember.user).select("name"),
      User.findById(toMember.user).select("name"),
    ]);

    transfer.status = "Confirmed";
    transfer.toAccount = toAccount;
    transfer.confirmedAt = new Date();
    transfer.confirmedBy = req.user.id;
    await transfer.save();

    await createSettlementTransactions({
      transfer,
      groupName: group.name,
      fromUserName: fromUserDoc?.name || "Member",
      toUserName: toUserDoc?.name || "Member",
      fromUserRealId: fromMember.user,
      toUserRealId: toMember.user,
    });

    const populated = await populateTransfer(GroupTransfer.findById(transfer._id));
    return res.status(200).json({ message: "Payment confirmed.", data: serializeTransfer(populated) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to confirm transfer.", error: error.message });
  }
};

const rejectGroupTransfer = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const transfer = await GroupTransfer.findOne({
      _id: req.params.transferId,
      group: group._id,
    });

    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    const toMember = await GroupMember.findById(transfer.toUser);

    // Only the toUser (receiver) can reject
    if (!toMember || toMember.memberType !== "registered" || String(toMember.user) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the receiver can reject this payment." });
    }

    if (transfer.status !== "Pending") {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}.` });
    }

    transfer.status = "Rejected";
    await transfer.save();

    const populated = await populateTransfer(GroupTransfer.findById(transfer._id));
    return res.status(200).json({ message: "Payment rejected.", data: serializeTransfer(populated) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reject transfer.", error: error.message });
  }
};

const getGroupTransfers = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: req.params.id },
      });
    }

    const transfers = await populateTransfer(
      GroupTransfer.find({ group: group._id }).sort({ date: -1 })
    );
    return res.status(200).json({ data: transfers.map(serializeTransfer) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transfers.", error: error.message });
  }
};

const getGroupMemberAccounts = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Get all member accounts for this group
    const memberAccounts = await GroupMemberAccount.find({ group: group._id })
      .populate("user", "name email");

    // Format response - only show account names, not balances
    const formatted = memberAccounts.map((ma) => ({
      userId: ma.user._id,
      userName: ma.user.name,
      accounts: ma.accounts,
    }));

    return res.status(200).json({ data: formatted });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch member accounts.", error: error.message });
  }
};

const getMyGroupAccounts = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Get current user's linked accounts for this group
    const myAccounts = await GroupMemberAccount.findOne({
      group: group._id,
      user: req.user.id,
    });

    // Get user's available accounts from main accounts
    const availableAccounts = await Account.find({ user: req.user.id }).select("name currency");

    return res.status(200).json({
      data: {
        linkedAccounts: myAccounts?.accounts || [],
        availableAccounts: availableAccounts.map((a) => ({
          name: a.name,
          currency: a.currency,
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch my accounts.", error: error.message });
  }
};

const linkGroupAccounts = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const { accounts } = req.body;

    // Validate 1-2 accounts
    if (!accounts || accounts.length < 1 || accounts.length > 2) {
      return res.status(400).json({ message: "You must link 1-2 accounts." });
    }

    // Verify accounts belong to user
    const userAccounts = await Account.find({ user: req.user.id }).select("name");
    const userAccountNames = userAccounts.map((a) => a.name);
    const invalidAccounts = accounts.filter((acc) => !userAccountNames.includes(acc));

    if (invalidAccounts.length > 0) {
      return res.status(400).json({
        message: "Invalid accounts.",
        invalid: invalidAccounts,
      });
    }

    // Upsert the group member accounts
    const linked = await GroupMemberAccount.findOneAndUpdate(
      { group: group._id, user: req.user.id },
      { accounts },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      message: "Accounts linked successfully.",
      data: { accounts: linked.accounts },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to link accounts.", error: error.message });
  }
};

module.exports = {
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
};
