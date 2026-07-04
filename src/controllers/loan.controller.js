const { validationResult } = require("express-validator");
const Loan = require("../models/loan.model");
const { validateLoanAccounts } = require("../utils/loanValidation");

const accountValidationResponse = (res, errors) =>
  res.status(400).json({
    message: "Validation failed",
    errors: errors.map((error) => ({ msg: error })),
  });

const createLoan = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  const accountErrors = validateLoanAccounts(req.body);
  if (accountErrors.length) {
    return accountValidationResponse(res, accountErrors);
  }

  try {
    const loan = await Loan.create({ ...req.body, user: req.user.id });
    return res.status(201).json({ message: "Loan created.", data: loan });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create loan.", error: error.message });
  }
};

const getLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ user: req.user.id }).sort({ dateGiven: -1 });
    return res.status(200).json({ data: loans });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch loans.", error: error.message });
  }
};

const getLoanById = async (req, res) => {
  try {
    const loan = await Loan.findOne({ _id: req.params.id, user: req.user.id });
    if (!loan) {
      return res.status(404).json({ message: "Loan not found." });
    }
    return res.status(200).json({ data: loan });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch loan.", error: error.message });
  }
};

const updateLoan = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const existing = await Loan.findOne({ _id: req.params.id, user: req.user.id });
    if (!existing) {
      return res.status(404).json({ message: "Loan not found." });
    }

    const merged = {
      type: req.body.type ?? existing.type,
      status: req.body.status ?? existing.status,
      fromAccount: req.body.fromAccount ?? existing.fromAccount,
      toAccount: req.body.toAccount ?? existing.toAccount,
    };
    const accountErrors = validateLoanAccounts(merged);
    if (accountErrors.length) {
      return accountValidationResponse(res, accountErrors);
    }

    const loan = await Loan.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    return res.status(200).json({ message: "Loan updated.", data: loan });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update loan.", error: error.message });
  }
};

const deleteLoan = async (req, res) => {
  try {
    const loan = await Loan.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!loan) {
      return res.status(404).json({ message: "Loan not found." });
    }
    return res.status(200).json({ message: "Loan deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete loan.", error: error.message });
  }
};

module.exports = {
  createLoan,
  getLoans,
  getLoanById,
  updateLoan,
  deleteLoan,
};
