const Setting = require("../models/setting.model");

const getExchangeRate = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: "USD_TO_PKR_RATE", user: req.user.id });
    const rate = setting ? Number(setting.value) : 280;
    return res.status(200).json({ data: { rate: Number.isFinite(rate) && rate > 0 ? rate : 280 } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch exchange rate.", error: error.message });
  }
};

const updateExchangeRate = async (req, res) => {
  try {
    const { rate } = req.body;
    const rateNumber = Number(rate);
    if (!Number.isFinite(rateNumber) || rateNumber <= 0) {
      return res.status(400).json({ message: "Invalid exchange rate. Must be a positive number." });
    }

    const setting = await Setting.findOneAndUpdate(
      { key: "USD_TO_PKR_RATE", user: req.user.id },
      { value: rateNumber },
      { new: true, upsert: true }
    );

    return res.status(200).json({ message: "Exchange rate updated.", data: { rate: Number(setting.value) } });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update exchange rate.", error: error.message });
  }
};

module.exports = {
  getExchangeRate,
  updateExchangeRate,
};
