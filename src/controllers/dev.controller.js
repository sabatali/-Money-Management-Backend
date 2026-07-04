const User = require("../models/user.model");
const Account = require("../models/account.model");
const Transaction = require("../models/transaction.model");
const Loan = require("../models/loan.model");
const Transfer = require("../models/transfer.model");
const Category = require("../models/category.model");
const Group = require("../models/group.model");
const GroupExpense = require("../models/groupExpense.model");
const GroupTransfer = require("../models/groupTransfer.model");
const GroupMemberAccount = require("../models/groupMemberAccount.model");
const Setting = require("../models/setting.model");

const resetDatabase = async (req, res) => {
  if (req.body?.confirm !== "RESET") {
    return res.status(400).json({
      message: 'Send { "confirm": "RESET" } to wipe all data.',
    });
  }

  try {
    const results = await Promise.all([
      GroupTransfer.deleteMany({}),
      GroupExpense.deleteMany({}),
      GroupMemberAccount.deleteMany({}),
      Group.deleteMany({}),
      Transaction.deleteMany({}),
      Transfer.deleteMany({}),
      Loan.deleteMany({}),
      Account.deleteMany({}),
      Category.deleteMany({}),
      Setting.deleteMany({}),
      User.deleteMany({}),
    ]);

    const deleted = {
      groupTransfers: results[0].deletedCount,
      groupExpenses: results[1].deletedCount,
      groupMemberAccounts: results[2].deletedCount,
      groups: results[3].deletedCount,
      transactions: results[4].deletedCount,
      transfers: results[5].deletedCount,
      loans: results[6].deletedCount,
      accounts: results[7].deletedCount,
      categories: results[8].deletedCount,
      settings: results[9].deletedCount,
      users: results[10].deletedCount,
    };

    return res.status(200).json({
      message: "Database cleared. You can register and test from scratch.",
      data: deleted,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to reset database.",
      error: error.message,
    });
  }
};

module.exports = {
  resetDatabase,
};
