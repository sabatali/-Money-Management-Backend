const { validationResult } = require("express-validator");
const Group = require("../models/group.model");
const GroupExpense = require("../models/groupExpense.model");
const GroupMemberAccount = require("../models/groupMemberAccount.model");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Transfer = require("../models/transfer.model");
const Loan = require("../models/loan.model");
const { convertToPKR } = require("../utils/currencyConverter");
const { calculateAccountBalances, getAccountBalancePKR } = require("../utils/accountBalanceCalculator");
const { createPayerGroupExpenseTransactions } = require("../utils/groupLedger");

const ensureMember = (group, userId) =>
  group.members.some((member) => {
    const memberId = member.user?._id || member.user;
    return String(memberId) === String(userId);
  });

const normalizeSplits = (members, totalAmountPKR) => {
  const memberIds = members.map((member) => String(member.user));
  const count = memberIds.length || 1;
  const rawShare = totalAmountPKR / count;
  const roundedShare = Math.round(rawShare * 100) / 100;
  const splits = memberIds.map((id) => ({
    user: id,
    shareAmountPKR: roundedShare,
  }));

  const totalRounded = splits.reduce((sum, item) => sum + item.shareAmountPKR, 0);
  const diff = Math.round((totalAmountPKR - totalRounded) * 100) / 100;
  if (diff !== 0) {
    splits[splits.length - 1].shareAmountPKR =
      Math.round((splits[splits.length - 1].shareAmountPKR + diff) * 100) / 100;
  }
  return splits;
};

const validateManualSplits = ({ splits, memberIds, totalAmountPKR }) => {
  if (!Array.isArray(splits) || splits.length === 0) {
    return "Splits are required for manual split.";
  }

  const invalidMember = splits.find(
    (split) => !memberIds.has(String(split.user))
  );
  if (invalidMember) {
    return "Split users must be group members.";
  }

  const sum = splits.reduce((acc, split) => acc + Number(split.shareAmountPKR || 0), 0);
  const diff = Math.abs(sum - totalAmountPKR);
  if (diff > 1) {
    return "Manual split amounts must match total amount.";
  }

  return null;
};

const getPayerSharePKR = (paidById, splits) => {
  const payerSplit = splits.find((split) => String(split.user) === String(paidById));
  return Number(payerSplit?.shareAmountPKR || 0);
};

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

const createGroupExpense = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const {
      group: groupId,
      title,
      totalAmountOriginal,
      currency,
      paidBy,
      splitType,
      splits,
      accountUsed,
      date,
    } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId },
      });
    }

    const memberIds = new Set(group.members.map((member) => String(member.user)));
    if (!memberIds.has(String(paidBy))) {
      return res.status(400).json({ message: "PaidBy must be a group member." });
    }
    if (String(paidBy) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the payer can add this expense." });
    }

    const payerAccounts = await GroupMemberAccount.findOne({
      group: group._id,
      user: paidBy,
    });
    if (!payerAccounts?.accounts?.length) {
      return res.status(400).json({
        message: "Link at least one account to this group before adding expenses.",
      });
    }
    if (!payerAccounts.accounts.includes(accountUsed)) {
      return res.status(400).json({
        message: "Account must be one of your linked group accounts.",
      });
    }

    const totalAmountPKR = await convertToPKR(Number(totalAmountOriginal), currency, req.user.id);
    const availableBalance = await getUserAccountBalance(paidBy, accountUsed);
    if (totalAmountPKR > availableBalance) {
      return res.status(400).json({
        message: `Insufficient balance. Available PKR ${availableBalance.toLocaleString()}.`,
      });
    }

    let finalSplits = [];

    if (splitType === "EQUAL") {
      finalSplits = normalizeSplits(group.members, totalAmountPKR);
    } else {
      const errorMessage = validateManualSplits({
        splits,
        memberIds,
        totalAmountPKR,
      });
      if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
      }
      finalSplits = splits.map((split) => ({
        user: split.user,
        shareAmountPKR: Number(split.shareAmountPKR),
      }));
    }

    const expense = await GroupExpense.create({
      group: group._id,
      title,
      totalAmountOriginal,
      currency,
      totalAmountPKR,
      paidBy,
      splitType,
      splits: finalSplits,
      accountUsed,
      date,
      createdBy: req.user.id,
    });

    const payerSharePKR = getPayerSharePKR(paidBy, finalSplits);
    const advancePKR = Math.round((totalAmountPKR - payerSharePKR) * 100) / 100;

    await createPayerGroupExpenseTransactions({
      userId: paidBy,
      groupName: group.name,
      expense,
      payerSharePKR,
      advancePKR,
    });

    const populated = await GroupExpense.findById(expense._id)
      .populate("paidBy", "name email")
      .populate("splits.user", "name email");
    return res.status(201).json({ message: "Group expense created.", data: populated });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to create expense.", error: error.message });
  }
};

const getGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ message: "groupId is required." });
    }
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found." });
    }
    if (!ensureMember(group, req.user.id)) {
      return res.status(403).json({ message: "Access denied." });
    }

    const expenses = await GroupExpense.find({ group: groupId })
      .sort({ date: -1 })
      .populate("paidBy", "name email")
      .populate("splits.user", "name email");
    return res.status(200).json({ data: expenses });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch expenses.", error: error.message });
  }
};

const getGroupExpenseById = async (req, res) => {
  try {
    const expense = await GroupExpense.findById(req.params.id)
      .populate("paidBy", "name email")
      .populate("splits.user", "name email");
    if (!expense) {
      return res.status(404).json({ message: "Expense not found." });
    }

    const group = await Group.findById(expense.group);
    if (!group || !ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: String(expense.group) },
      });
    }

    return res.status(200).json({ data: expense });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch expense.", error: error.message });
  }
};

const updateGroupExpense = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const existing = await GroupExpense.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Expense not found." });
    }

    const group = await Group.findById(existing.group);
    if (!group || !ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: String(existing.group) },
      });
    }

    const payload = { ...existing.toObject(), ...req.body };
    const memberIds = new Set(group.members.map((member) => String(member.user)));
    if (!memberIds.has(String(payload.paidBy))) {
      return res.status(400).json({ message: "PaidBy must be a group member." });
    }

    const totalAmountPKR = await convertToPKR(
      Number(payload.totalAmountOriginal),
      payload.currency,
      req.user.id
    );
    let finalSplits = [];
    if (payload.splitType === "EQUAL") {
      finalSplits = normalizeSplits(group.members, totalAmountPKR);
    } else {
      const errorMessage = validateManualSplits({
        splits: payload.splits,
        memberIds,
        totalAmountPKR,
      });
      if (errorMessage) {
        return res.status(400).json({ message: errorMessage });
      }
      finalSplits = payload.splits.map((split) => ({
        user: split.user,
        shareAmountPKR: Number(split.shareAmountPKR),
      }));
    }

    const expense = await GroupExpense.findByIdAndUpdate(
      req.params.id,
      {
        title: payload.title,
        totalAmountOriginal: payload.totalAmountOriginal,
        currency: payload.currency,
        totalAmountPKR,
        paidBy: payload.paidBy,
        splitType: payload.splitType,
        splits: finalSplits,
        accountUsed: payload.accountUsed,
        date: payload.date,
      },
      { new: true }
    )
      .populate("paidBy", "name email")
      .populate("splits.user", "name email");

    return res.status(200).json({ message: "Group expense updated.", data: expense });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to update expense.", error: error.message });
  }
};

const deleteGroupExpense = async (req, res) => {
  try {
    const expense = await GroupExpense.findById(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found." });
    }

    const group = await Group.findById(expense.group);
    if (!group || !ensureMember(group, req.user.id)) {
      return res.status(403).json({
        message: "Access denied.",
        meta: { userId: req.user.id, groupId: String(expense.group) },
      });
    }

    await GroupExpense.deleteOne({ _id: req.params.id });
    return res.status(200).json({ message: "Group expense deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete expense.", error: error.message });
  }
};

module.exports = {
  createGroupExpense,
  getGroupExpenses,
  getGroupExpenseById,
  updateGroupExpense,
  deleteGroupExpense,
};
