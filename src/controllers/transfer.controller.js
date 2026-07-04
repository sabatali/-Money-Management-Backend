const { validationResult } = require("express-validator");
const Transfer = require("../models/transfer.model");
const Transaction = require("../models/transaction.model");
const { convertToPKR } = require("../utils/currencyConverter");

const createTransfer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { amountOriginal, currency, fee, feeCurrency, fromAccount, date, description } = req.body;
    const amountPKR = convertToPKR(Number(amountOriginal), currency);
    const feePKR = fee && Number(fee) > 0 ? convertToPKR(Number(fee), feeCurrency || currency) : 0;

    const transfer = await Transfer.create({
      ...req.body,
      amountPKR,
      feePKR,
      user: req.user.id,
    });

    // Auto-create expense for transfer fee if fee > 0
    if (feePKR > 0) {
      const month = new Date(date).toISOString().slice(0, 7);
      await Transaction.create({
        date: new Date(date),
        type: "expense",
        category: "Transfer Fee",
        amount: Number(fee),
        currency: feeCurrency || currency,
        amountPKR: feePKR,
        account: fromAccount,
        description: `Transfer fee: ${description || "Transfer"} (${fromAccount} → ${req.body.toAccount})`,
        month,
        user: req.user.id,
      });
    }

    return res.status(201).json({ message: "Transfer created.", data: transfer });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create transfer.", error: error.message });
  }
};

const getTransfers = async (req, res) => {
  try {
    const transfers = await Transfer.find({ user: req.user.id }).sort({ date: -1 });
    return res.status(200).json({ data: transfers });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transfers.", error: error.message });
  }
};

const getTransferById = async (req, res) => {
  try {
    const transfer = await Transfer.findOne({ _id: req.params.id, user: req.user.id });
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }
    return res.status(200).json({ data: transfer });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch transfer.", error: error.message });
  }
};

const updateTransfer = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const updates = { ...req.body };
    const existing = await Transfer.findOne({ _id: req.params.id, user: req.user.id });
    if (!existing) {
      return res.status(404).json({ message: "Transfer not found." });
    }

    if (updates.amountOriginal !== undefined || updates.currency !== undefined) {
      const newAmount =
        updates.amountOriginal !== undefined ? Number(updates.amountOriginal) : existing.amountOriginal;
      const newCurrency = updates.currency || existing.currency;
      updates.amountPKR = convertToPKR(newAmount, newCurrency);
    }

    // Recalculate feePKR if fee or feeCurrency changed
    if (updates.fee !== undefined || updates.feeCurrency !== undefined) {
      const newFee = updates.fee !== undefined ? Number(updates.fee) : existing.fee;
      const newFeeCurrency = updates.feeCurrency || existing.feeCurrency;
      updates.feePKR = newFee > 0 ? convertToPKR(newFee, newFeeCurrency) : 0;
    }

    const transfer = await Transfer.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updates,
      { new: true }
    );
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }
    return res.status(200).json({ message: "Transfer updated.", data: transfer });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update transfer.", error: error.message });
  }
};

const deleteTransfer = async (req, res) => {
  try {
    const transfer = await Transfer.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!transfer) {
      return res.status(404).json({ message: "Transfer not found." });
    }
    return res.status(200).json({ message: "Transfer deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete transfer.", error: error.message });
  }
};

module.exports = {
  createTransfer,
  getTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
};
