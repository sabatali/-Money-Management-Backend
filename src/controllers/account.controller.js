const { validationResult } = require("express-validator");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Transfer = require("../models/transfer.model");
const Loan = require("../models/loan.model");

const { convertToPKR } = require("../utils/currencyConverter");
const { calculateAccountBalances, getAccountBalancePKR } = require("../utils/accountBalanceCalculator");
const { resolveAccountDetails } = require("../utils/masterDataResolver");
const { ValidationError } = require("../utils/nameValidation");

const createAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { masterAccountId, name, currency, openingBalance } = req.body;
    const resolved = await resolveAccountDetails({ masterAccountId, name });

    const exists = await Account.findOne({
      normalizedName: resolved.normalizedName,
      user: req.user.id,
    });
    if (exists) {
      return res.status(409).json({ message: "Account already exists." });
    }

    const balance = Number(openingBalance || 0);
    const openingBalancePKR =
      currency === "USD" ? await convertToPKR(balance, "USD", req.user.id) : balance;

    const account = await Account.create({
      name: resolved.name,
      normalizedName: resolved.normalizedName,
      type: resolved.type,
      icon: resolved.icon,
      masterAccount: resolved.masterAccount,
      isCustom: resolved.isCustom,
      currency: currency || "PKR",
      openingBalance: balance,
      openingBalancePKR,
      user: req.user.id,
    });
    return res.status(201).json({ message: "Account created.", data: account });
  } catch (error) {
    if (error instanceof ValidationError || error.statusCode === 400) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Account already exists." });
    }
    return res.status(500).json({ message: "Failed to create account.", error: error.message });
  }
};

/**
 * Accepts a list of accounts (each either { masterAccountId } or a custom
 * { name }) and creates as many as possible in one request, e.g. from the
 * onboarding screen. Duplicates (within the request or already saved) are
 * reported as skipped rather than failing the whole batch.
 */
const bulkCreateAccounts = async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Provide a non-empty items array." });
  }

  const created = [];
  const skipped = [];
  const seenNormalizedNames = new Set();

  const existingAccounts = await Account.find({ user: req.user.id }, "normalizedName");
  existingAccounts.forEach((account) => seenNormalizedNames.add(account.normalizedName));

  for (const item of items) {
    try {
      const resolved = await resolveAccountDetails({
        masterAccountId: item.masterAccountId,
        name: item.name,
      });

      if (seenNormalizedNames.has(resolved.normalizedName)) {
        skipped.push({ input: item, reason: "Already exists." });
        continue;
      }

      const balance = Number(item.openingBalance || 0);
      const currency = item.currency === "USD" ? "USD" : "PKR";
      const openingBalancePKR =
        currency === "USD" ? await convertToPKR(balance, "USD", req.user.id) : balance;

      const account = await Account.create({
        name: resolved.name,
        normalizedName: resolved.normalizedName,
        type: resolved.type,
        icon: resolved.icon,
        masterAccount: resolved.masterAccount,
        isCustom: resolved.isCustom,
        currency,
        openingBalance: balance,
        openingBalancePKR,
        user: req.user.id,
      });

      seenNormalizedNames.add(resolved.normalizedName);
      created.push(account);
    } catch (error) {
      skipped.push({ input: item, reason: error.message || "Failed to create." });
    }
  }

  return res.status(201).json({
    message: `Created ${created.length} account(s), skipped ${skipped.length}.`,
    data: { created, skipped },
  });
};

const getAccounts = async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user.id }).sort({ name: 1 });
    return res.status(200).json({ data: accounts });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch accounts.", error: error.message });
  }
};

const getAccountById = async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, user: req.user.id });
    if (!account) {
      return res.status(404).json({ message: "Account not found." });
    }
    return res.status(200).json({ data: account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch account.", error: error.message });
  }
};

const updateAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const update = { ...req.body };

    if (typeof update.name === "string") {
      const resolved = await resolveAccountDetails({ name: update.name });

      const duplicate = await Account.findOne({
        _id: { $ne: req.params.id },
        normalizedName: resolved.normalizedName,
        user: req.user.id,
      });
      if (duplicate) {
        return res.status(409).json({ message: "Account already exists." });
      }

      update.name = resolved.name;
      update.normalizedName = resolved.normalizedName;
      if (resolved.masterAccount) {
        update.type = resolved.type;
        update.icon = resolved.icon;
        update.masterAccount = resolved.masterAccount;
        update.isCustom = false;
      }
    }

    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      update,
      { new: true }
    );
    if (!account) {
      return res.status(404).json({ message: "Account not found." });
    }
    return res.status(200).json({ message: "Account updated.", data: account });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Account already exists." });
    }
    return res.status(500).json({ message: "Failed to update account.", error: error.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!account) {
      return res.status(404).json({ message: "Account not found." });
    }
    return res.status(200).json({ message: "Account deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete account.", error: error.message });
  }
};

const getAccountBalances = async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user.id }).sort({ name: 1 });
    const transactions = await Transaction.find({ user: req.user.id });
    const transfers = await Transfer.find({ user: req.user.id });
    const loans = await Loan.find({ user: req.user.id });

    const balances = calculateAccountBalances({
      accounts,
      transactions,
      transfers,
      loans,
    });

    const result = accounts.map((account) => ({
      id: account._id,
      name: account.name,
      openingBalancePKR: Number(account.openingBalancePKR || 0),
      currentBalancePKR: Math.round((balances[account.name] || 0) * 100) / 100,
    }));

    return res.status(200).json({ data: result });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch account balances.", error: error.message });
  }
};

module.exports = {
  createAccount,
  bulkCreateAccounts,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountBalances,
};
