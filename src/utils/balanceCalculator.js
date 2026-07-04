const normalizeId = (value) => String(value);

const calculateBalances = ({ members, expenses, transfers }) => {
  const balances = {};
  members.forEach((memberId) => {
    balances[normalizeId(memberId)] = 0;
  });

  expenses.forEach((expense) => {
    const paidById = normalizeId(expense.paidBy);
    balances[paidById] = (balances[paidById] || 0) + Number(expense.totalAmountPKR || 0);

    expense.splits.forEach((split) => {
      const userId = normalizeId(split.user);
      balances[userId] = (balances[userId] || 0) - Number(split.shareAmountPKR || 0);
    });
  });

  // Only count confirmed transfers in balance calculations
  transfers.forEach((transfer) => {
    if (transfer.status === "Confirmed" || !transfer.status) {
      const fromId = normalizeId(transfer.fromUser);
      const toId = normalizeId(transfer.toUser);
      balances[fromId] = (balances[fromId] || 0) + Number(transfer.amountPKR || 0);
      balances[toId] = (balances[toId] || 0) - Number(transfer.amountPKR || 0);
    }
  });

  return balances;
};

module.exports = {
  calculateBalances,
};
