const normalizeName = (name) => String(name || "").trim();

const applyTransactions = (balances, transactions) => {
  transactions.forEach((tx) => {
    const account = tx.account;
    if (!account) return;
    const amount = Number(tx.amountPKR || 0);
    const type = String(tx.type || "").toLowerCase();
    if (type === "income") {
      balances[account] = (balances[account] || 0) + amount;
    } else if (type === "expense") {
      balances[account] = (balances[account] || 0) - amount;
    }
  });
};

const applyTransfers = (balances, transfers) => {
  transfers.forEach((tr) => {
    const amount = Number(tr.amountPKR || 0);
    if (tr.fromAccount) {
      balances[tr.fromAccount] = (balances[tr.fromAccount] || 0) - amount;
    }
    if (tr.toAccount) {
      balances[tr.toAccount] = (balances[tr.toAccount] || 0) + amount;
    }
  });
};

const applyLoans = (balances, loans) => {
  loans.forEach((loan) => {
    const amount = Number(loan.amountPKR || 0);
    const type = loan.type || "Lent";
    const status = loan.status || "Pending";

    if (type === "Lent") {
      if (status === "Pending") {
        if (loan.fromAccount) {
          balances[loan.fromAccount] = (balances[loan.fromAccount] || 0) - amount;
        }
      } else if (status === "Returned") {
        const lentFrom = loan.fromAccount || loan.toAccount;
        if (lentFrom) {
          balances[lentFrom] = (balances[lentFrom] || 0) - amount;
        }
        if (loan.toAccount) {
          balances[loan.toAccount] = (balances[loan.toAccount] || 0) + amount;
        }
      }
    } else if (type === "Borrowed") {
      if (status === "Pending") {
        if (loan.toAccount) {
          balances[loan.toAccount] = (balances[loan.toAccount] || 0) + amount;
        }
      } else if (status === "Returned") {
        const receivedIn = loan.toAccount || loan.fromAccount;
        if (receivedIn) {
          balances[receivedIn] = (balances[receivedIn] || 0) + amount;
        }
        if (loan.fromAccount) {
          balances[loan.fromAccount] = (balances[loan.fromAccount] || 0) - amount;
        }
      }
    }
  });
};

const calculateAccountBalances = ({ accounts, transactions, transfers, loans }) => {
  const balances = {};
  accounts.forEach((account) => {
    balances[account.name] = Number(account.openingBalancePKR || 0);
  });

  applyTransactions(balances, transactions);
  applyTransfers(balances, transfers);
  applyLoans(balances, loans);

  return balances;
};

const getAccountBalancePKR = (balances, accountName) => {
  const key = normalizeName(accountName);
  const match = Object.keys(balances).find((name) => normalizeName(name) === key);
  return Math.round((balances[match] || 0) * 100) / 100;
};

module.exports = {
  calculateAccountBalances,
  getAccountBalancePKR,
};
