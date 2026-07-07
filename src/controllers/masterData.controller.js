const MasterAccount = require("../models/masterAccount.model");
const MasterCategory = require("../models/masterCategory.model");

const getMasterAccounts = async (req, res) => {
  try {
    const accounts = await MasterAccount.find({ isActive: true }).sort({
      group: 1,
      sortOrder: 1,
      name: 1,
    });
    return res.status(200).json({ data: accounts });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch master accounts.", error: error.message });
  }
};

const getMasterCategories = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.type && ["income", "expense"].includes(req.query.type)) {
      filter.type = req.query.type;
    }
    const categories = await MasterCategory.find(filter).sort({
      type: 1,
      group: 1,
      sortOrder: 1,
      name: 1,
    });
    return res.status(200).json({ data: categories });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to fetch master categories.", error: error.message });
  }
};

module.exports = {
  getMasterAccounts,
  getMasterCategories,
};
