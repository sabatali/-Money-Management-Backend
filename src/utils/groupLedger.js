const Transaction = require("../models/transaction.model");

const getMonthFromDate = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const createPayerGroupExpenseTransactions = async ({
  userId,
  groupName,
  expense,
  payerSharePKR,
  advancePKR,
}) => {
  const month = getMonthFromDate(expense.date);
  const currency = expense.currency || "PKR";
  const shareOriginal =
    expense.totalAmountPKR > 0
      ? Math.round((payerSharePKR / expense.totalAmountPKR) * expense.totalAmountOriginal * 100) /
        100
      : 0;
  const advanceOriginal = Math.round((expense.totalAmountOriginal - shareOriginal) * 100) / 100;

  const shareTx = await Transaction.create({
    date: expense.date,
    type: "expense",
    category: "Group Expense",
    amount: shareOriginal,
    currency,
    amountPKR: payerSharePKR,
    account: expense.accountUsed,
    description: `${expense.title} (your share) · ${groupName}`,
    month,
    user: userId,
    groupExpense: expense._id,
    countInExpenseHistory: true,
  });

  let advanceTx = null;
  if (advancePKR > 0) {
    advanceTx = await Transaction.create({
      date: expense.date,
      type: "expense",
      category: "Group Advance",
      amount: advanceOriginal,
      currency,
      amountPKR: advancePKR,
      account: expense.accountUsed,
      description: `${expense.title} (paid for others) · ${groupName}`,
      month,
      user: userId,
      groupExpense: expense._id,
      countInExpenseHistory: false,
    });
  }

  return { shareTx, advanceTx };
};

/**
 * Records the personal-ledger side effects of a confirmed settlement.
 * `fromUserRealId`/`toUserRealId` must be the underlying User._id for
 * whichever side(s) are registered members — pass null/undefined for a
 * guest side, since guests have no personal Account/Transaction history
 * and that side is simply skipped.
 */
const createSettlementTransactions = async ({
  transfer,
  groupName,
  fromUserName,
  toUserName,
  fromUserRealId,
  toUserRealId,
}) => {
  const month = getMonthFromDate(transfer.date);
  const amountPKR = Number(transfer.amountPKR || 0);

  let payerTx = null;
  if (fromUserRealId) {
    payerTx = await Transaction.create({
      date: transfer.date,
      type: "expense",
      category: "Group Settlement",
      amount: amountPKR,
      currency: "PKR",
      amountPKR,
      account: transfer.account,
      description: `Paid ${toUserName} · ${groupName}`,
      month,
      user: fromUserRealId,
      groupTransfer: transfer._id,
      countInExpenseHistory: false,
    });
  }

  let receiverTx = null;
  if (toUserRealId) {
    receiverTx = await Transaction.create({
      date: transfer.date,
      type: "income",
      category: "Group Settlement",
      amount: amountPKR,
      currency: "PKR",
      amountPKR,
      account: transfer.toAccount,
      description: `Received from ${fromUserName} · ${groupName}`,
      month,
      user: toUserRealId,
      groupTransfer: transfer._id,
      countInIncomeHistory: false,
    });
  }

  return { payerTx, receiverTx };
};

module.exports = {
  createPayerGroupExpenseTransactions,
  createSettlementTransactions,
};
