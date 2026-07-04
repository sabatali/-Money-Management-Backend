const getUsdToPkrRate = () => {
  const rate = Number(process.env.USD_TO_PKR_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 280;
};

const convertToPKR = (amount, currency) => {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "PKR") return amount;
  if (currency === "USD") return amount * getUsdToPkrRate();
  return amount;
};

module.exports = {
  convertToPKR,
  getUsdToPkrRate,
};
