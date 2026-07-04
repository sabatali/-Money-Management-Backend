const { validationResult } = require("express-validator");
const Group = require("../models/group.model");
const User = require("../models/user.model");
const GroupTransfer = require("../models/groupTransfer.model");
const GroupMemberAccount = require("../models/groupMemberAccount.model");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Transfer = require("../models/transfer.model");
const Loan = require("../models/loan.model");
const { calculateAccountBalances, getAccountBalancePKR } = require("../utils/accountBalanceCalculator");
const { createSettlementTransactions } = require("../utils/groupLedger");

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

    const populated = await Group.findById(group._id).populate("members.user", "name email");
    return res.status(201).json({ message: "Group created.", data: populated });
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
    return res.status(200).json({ data: group });
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

    const populated = await Group.findById(group._id).populate("members.user", "name email");
    return res.status(200).json({ message: "Member added.", data: populated });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add member.", error: error.message });
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

    const memberId = req.params.memberId;
    const wasMember = group.members.some(
      (member) => String(member.user) === String(memberId)
    );
    if (!wasMember) {
      return res.status(404).json({ message: "Member not found in group." });
    }

    group.members = group.members.filter(
      (member) => String(member.user) !== String(memberId)
    );
    await group.save();

    const populated = await Group.findById(group._id).populate("members.user", "name email");
    return res.status(200).json({ message: "Member removed.", data: populated });
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

    const { fromUser, toUser, amountPKR, account, toAccount, date } = req.body;
    const membersSet = new Set(group.members.map((member) => String(member.user)));
    if (!membersSet.has(String(fromUser)) || !membersSet.has(String(toUser))) {
      return res.status(400).json({ message: "Transfer users must be group members." });
    }

    // Only the fromUser can initiate a payment
    if (String(fromUser) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the payer can initiate a payment." });
    }

    const accountError = await ensureLinkedAccount(group._id, fromUser, account);
    if (accountError) {
      return res.status(400).json({ message: accountError });
    }

    const transfer = await GroupTransfer.create({
      group: group._id,
      fromUser,
      toUser,
      amountPKR,
      account,
      toAccount,
      date,
      status: "Pending",
      createdBy: req.user.id,
    });

    const populated = await GroupTransfer.findById(transfer._id)
      .populate("fromUser", "name email")
      .populate("toUser", "name email");
    return res.status(201).json({ message: "Transfer recorded. Waiting for confirmation.", data: populated });
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

    // Only the toUser (receiver) can confirm
    if (String(transfer.toUser) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the receiver can confirm this payment." });
    }

    if (transfer.status !== "Pending") {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}.` });
    }

    if (!toAccount) {
      return res.status(400).json({ message: "toAccount is required to confirm payment." });
    }

    const receiverAccountError = await ensureLinkedAccount(
      group._id,
      transfer.toUser,
      toAccount
    );
    if (receiverAccountError) {
      return res.status(400).json({ message: receiverAccountError });
    }

    const payerAccountError = await ensureLinkedAccount(
      group._id,
      transfer.fromUser,
      transfer.account
    );
    if (payerAccountError) {
      return res.status(400).json({ message: "Payer no longer has a valid linked account." });
    }

    const availableBalance = await getUserAccountBalance(transfer.fromUser, transfer.account);
    if (Number(transfer.amountPKR) > availableBalance) {
      return res.status(400).json({
        message: `Payer has insufficient balance. Available PKR ${availableBalance.toLocaleString()}.`,
      });
    }

    const [fromUserDoc, toUserDoc] = await Promise.all([
      User.findById(transfer.fromUser).select("name"),
      User.findById(transfer.toUser).select("name"),
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
    });

    const populated = await GroupTransfer.findById(transfer._id)
      .populate("fromUser", "name email")
      .populate("toUser", "name email");
    return res.status(200).json({ message: "Payment confirmed.", data: populated });
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
      group: group._id 
    });
    
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    // Only the toUser (receiver) can reject
    if (String(transfer.toUser) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the receiver can reject this payment." });
    }

    if (transfer.status !== "Pending") {
      return res.status(400).json({ message: `Transfer is already ${transfer.status}.` });
    }

    transfer.status = "Rejected";
    await transfer.save();

    const populated = await GroupTransfer.findById(transfer._id)
      .populate("fromUser", "name email")
      .populate("toUser", "name email");
    return res.status(200).json({ message: "Payment rejected.", data: populated });
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

    const transfers = await GroupTransfer.find({ group: group._id })
      .sort({ date: -1 })
      .populate("fromUser", "name email")
      .populate("toUser", "name email");
    return res.status(200).json({ data: transfers });
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
  removeMemberFromGroup,
  createGroupTransfer,
  getGroupTransfers,
  confirmGroupTransfer,
  rejectGroupTransfer,
  getGroupMemberAccounts,
  getMyGroupAccounts,
  linkGroupAccounts,
};
