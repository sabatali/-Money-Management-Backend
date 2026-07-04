const validateLoanAccounts = ({ type = "Lent", status = "Pending", fromAccount, toAccount }) => {
  const errors = [];
  const needsFrom =
    (type === "Lent" && status === "Pending") ||
    (type === "Borrowed" && status === "Returned");
  const needsTo =
    (type === "Lent" && status === "Returned") ||
    (type === "Borrowed" && (status === "Pending" || status === "Returned"));

  if (needsFrom && !fromAccount) {
    errors.push("fromAccount is required for this loan type and status.");
  }
  if (needsTo && !toAccount) {
    errors.push("toAccount is required for this loan type and status.");
  }

  return errors;
};

module.exports = {
  validateLoanAccounts,
};
