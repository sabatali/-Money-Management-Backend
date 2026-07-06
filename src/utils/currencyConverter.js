const Setting = require("../models/setting.model");

const EXCHANGE_RATE_KEY = "USD_TO_PKR_RATE";
const EXCHANGE_RATE_MISSING =
  "Exchange rate not configured. Set USD to PKR rate in Accounts.";

const getUsdToPkrRate = async (userId) => {
  const setting = await Setting.findOne({ key: EXCHANGE_RATE_KEY, user: userId });
  if (!setting) {
    const error = new Error(EXCHANGE_RATE_MISSING);
    error.statusCode = 400;
    throw error;
  }

  const rate = Number(setting.value);
  if (!Number.isFinite(rate) || rate <= 0) {
    const error = new Error(EXCHANGE_RATE_MISSING);
    error.statusCode = 400;
    throw error;
  }

  return rate;
};

const convertToPKR = async (amount, currency, userId) => {
  if (!Number.isFinite(amount)) return 0;
  if (currency === "PKR") return amount;
  if (currency === "USD") {
    const rate = await getUsdToPkrRate(userId);
    return amount * rate;
  }
  return amount;
};

module.exports = {
  convertToPKR,
  getUsdToPkrRate,
  EXCHANGE_RATE_KEY,
  EXCHANGE_RATE_MISSING,
};
