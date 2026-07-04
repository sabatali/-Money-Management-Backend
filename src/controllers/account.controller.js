const { validationResult } = require("express-validator");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Transfer = require("../models/transfer.model");
const Loan = require("../models/loan.model");

const { convertToPKR } = require("../utils/currencyConverter");
const { calculateAccountBalances, getAccountBalancePKR } = require("../utils/accountBalanceCalculator");

const createAccount = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { name, currency, openingBalance } = req.body;
    const exists = await Account.findOne({ name, user: req.user.id });
    if (exists) {
      return res.status(409).json({ message: "Account already exists." });
    }

    const balance = Number(openingBalance || 0);
    const openingBalancePKR = currency === "USD" ? convertToPKR(balance, "USD") : balance;

    const account = await Account.create({
      name,
      currency: currency || "PKR",
      openingBalance: balance,
      openingBalancePKR,
      user: req.user.id,
    });
    return res.status(201).json({ message: "Account created.", data: account });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create account.", error: error.message });
  }
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
    const account = await Account.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    if (!account) {
      return res.status(404).json({ message: "Account not found." });
    }
    return res.status(200).json({ message: "Account updated.", data: account });
  } catch (error) {
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
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountBalances,
};
