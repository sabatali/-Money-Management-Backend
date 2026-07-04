const { validationResult } = require("express-validator");
const Transaction = require("../models/transaction.model");
const { convertToPKR } = require("../utils/currencyConverter");

const getMonthFromDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const createTransaction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { date, type, category, amount, currency, account, description } = req.body;
    const amountPKR = convertToPKR(Number(amount), currency);
    const month = getMonthFromDate(date);

    const transaction = await Transaction.create({
      date,
      type,
      category,
      amount,
      currency,
      amountPKR,
      account,
      description,
      month,
      user: req.user.id,
    });

    return res.status(201).json({ message: "Transaction created.", data: transaction });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create transaction.", error: error.message });
  }
};

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });
    return res.status(200).json({ data: transactions });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transactions.", error: error.message });
  }
};

const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    return res.status(200).json({ data: transaction });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transaction.", error: error.message });
  }
};

const updateTransaction = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const updates = { ...req.body };
    if (updates.amount !== undefined || updates.currency !== undefined) {
      const amountValue = updates.amount !== undefined ? Number(updates.amount) : undefined;
      const currencyValue = updates.currency || undefined;
      const existing = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
      if (!existing) {
        return res.status(404).json({ message: "Transaction not found." });
      }
      const newAmount = amountValue !== undefined ? amountValue : existing.amount;
      const newCurrency = currencyValue || existing.currency;
      updates.amountPKR = convertToPKR(newAmount, newCurrency);
    }
    if (updates.date) {
      updates.month = getMonthFromDate(updates.date);
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updates,
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    return res.status(200).json({ message: "Transaction updated.", data: transaction });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update transaction.", error: error.message });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found." });
    }
    return res.status(200).json({ message: "Transaction deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete transaction.", error: error.message });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
