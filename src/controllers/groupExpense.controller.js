const { validationResult } = require("express-validator");
const Group = require("../models/group.model");
const GroupExpense = require("../models/groupExpense.model");
const GroupMember = require("../models/groupMember.model");
const GroupMemberAccount = require("../models/groupMemberAccount.model");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Transfer = require("../models/transfer.model");
const Loan = require("../models/loan.model");
const { convertToPKR } = require("../utils/currencyConverter");
const { calculateAccountBalances, getAccountBalancePKR } = require("../utils/accountBalanceCalculator");
const { createPayerGroupExpenseTransactions } = require("../utils/groupLedger");
const { listGroupMembers, serializeMemberRef } = require("../utils/groupMemberService");

const ensureMember = (group, userId) =>
  group.members.some((member) => {
    const memberId = member.user?._id || member.user;
    return String(memberId) === String(userId);
  });

/** Builds a lookup so a client-supplied ref (GroupMember._id OR, for
 * backward compatibility, a raw User._id) resolves to the canonical
 * GroupMember doc for this group. */
const buildMemberRefMap = (members) => {
  const map = new Map();
  members.forEach((member) => {
    map.set(String(member._id), member);
    if (member.memberType === "registered" && member.user) {
      map.set(String(member.user._id || member.user), member);
    }
  });
  return map;
};

const normalizeSplits = (members, totalAmountPKR) => {
  const memberIds = members.map((member) => String(member._id));
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

const validateManualSplits = ({ splits, refMap, totalAmountPKR }) => {
  if (!Array.isArray(splits) || splits.length === 0) {
    return { error: "Splits are required for manual split." };
  }

  const resolved = [];
  for (const split of splits) {
    const member = refMap.get(String(split.user));
    if (!member) {
      return { error: "Split users must be group members." };
    }
    resolved.push({ user: String(member._id), shareAmountPKR: Number(split.shareAmountPKR || 0) });
  }

  const sum = resolved.reduce((acc, split) => acc + split.shareAmountPKR, 0);
  const diff = Math.abs(sum - totalAmountPKR);
  if (diff > 1) {
    return { error: "Manual split amounts must match total amount." };
  }

  return { splits: resolved };
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

const populateExpense = (query) =>
  query
    .populate({ path: "paidBy", populate: { path: "user", select: "name email" } })
    .populate({ path: "splits.user", populate: { path: "user", select: "name email" } });

const serializeExpense = (expenseDoc) => {
  const obj = expenseDoc.toObject ? expenseDoc.toObject() : expenseDoc;
  return {
    ...obj,
    paidBy: serializeMemberRef(expenseDoc.paidBy),
    splits: (expenseDoc.splits || []).map((split) => ({
      shareAmountPKR: split.shareAmountPKR,
      user: serializeMemberRef(split.user),
    })),
  };
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

    const allMembers = await GroupMember.find({ group: group._id }).populate("user", "name email");
    const refMap = buildMemberRefMap(allMembers);

    const paidByMember = refMap.get(String(paidBy));
    if (!paidByMember) {
      return res.status(400).json({ message: "PaidBy must be a group member." });
    }
    if (paidByMember.memberType !== "registered") {
      return res.status(400).json({ message: "Only registered members can pay for group expenses." });
    }
    if (String(paidByMember.user._id || paidByMember.user) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the payer can add this expense." });
    }

    const payerAccounts = await GroupMemberAccount.findOne({
      group: group._id,
      user: req.user.id,
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
    const availableBalance = await getUserAccountBalance(req.user.id, accountUsed);
    if (totalAmountPKR > availableBalance) {
      return res.status(400).json({
        message: `Insufficient balance. Available PKR ${availableBalance.toLocaleString()}.`,
      });
    }

    let finalSplits = [];

    if (splitType === "EQUAL") {
      finalSplits = normalizeSplits(allMembers, totalAmountPKR);
    } else {
      const { error, splits: resolvedSplits } = validateManualSplits({
        splits,
        refMap,
        totalAmountPKR,
      });
      if (error) {
        return res.status(400).json({ message: error });
      }
      finalSplits = resolvedSplits;
    }

    const expense = await GroupExpense.create({
      group: group._id,
      title,
      totalAmountOriginal,
      currency,
      totalAmountPKR,
      paidBy: paidByMember._id,
      splitType,
      splits: finalSplits,
      accountUsed,
      date,
      createdBy: req.user.id,
    });

    const payerSharePKR = getPayerSharePKR(paidByMember._id, finalSplits);
    const advancePKR = Math.round((totalAmountPKR - payerSharePKR) * 100) / 100;

    await createPayerGroupExpenseTransactions({
      userId: req.user.id,
      groupName: group.name,
      expense,
      payerSharePKR,
      advancePKR,
    });

    const populated = await populateExpense(GroupExpense.findById(expense._id));
    return res.status(201).json({ message: "Group expense created.", data: serializeExpense(populated) });
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

    const expenses = await populateExpense(GroupExpense.find({ group: groupId }).sort({ date: -1 }));
    return res.status(200).json({ data: expenses.map(serializeExpense) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch expenses.", error: error.message });
  }
};

const getGroupExpenseById = async (req, res) => {
  try {
    const expense = await populateExpense(GroupExpense.findById(req.params.id));
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

    return res.status(200).json({ data: serializeExpense(expense) });
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
    const allMembers = await GroupMember.find({ group: group._id }).populate("user", "name email");
    const refMap = buildMemberRefMap(allMembers);

    const paidByMember = refMap.get(String(payload.paidBy));
    if (!paidByMember) {
      return res.status(400).json({ message: "PaidBy must be a group member." });
    }
    if (paidByMember.memberType !== "registered") {
      return res.status(400).json({ message: "Only registered members can pay for group expenses." });
    }

    const totalAmountPKR = await convertToPKR(
      Number(payload.totalAmountOriginal),
      payload.currency,
      req.user.id
    );
    let finalSplits = [];
    if (payload.splitType === "EQUAL") {
      finalSplits = normalizeSplits(allMembers, totalAmountPKR);
    } else {
      const { error, splits: resolvedSplits } = validateManualSplits({
        splits: payload.splits,
        refMap,
        totalAmountPKR,
      });
      if (error) {
        return res.status(400).json({ message: error });
      }
      finalSplits = resolvedSplits;
    }

    const expense = await GroupExpense.findByIdAndUpdate(
      req.params.id,
      {
        title: payload.title,
        totalAmountOriginal: payload.totalAmountOriginal,
        currency: payload.currency,
        totalAmountPKR,
        paidBy: paidByMember._id,
        splitType: payload.splitType,
        splits: finalSplits,
        accountUsed: payload.accountUsed,
        date: payload.date,
      },
      { new: true }
    );

    const populated = await populateExpense(GroupExpense.findById(expense._id));
    return res.status(200).json({ message: "Group expense updated.", data: serializeExpense(populated) });
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
