const MasterAccount = require("../models/masterAccount.model");
const MasterCategory = require("../models/masterCategory.model");
const {
  ValidationError,
  sanitizeName,
  buildNormalizedKey,
  capitalizeName,
} = require("./nameValidation");

/**
 * Resolves the final name/type/icon for an account being created, whether it
 * comes from the master catalogue (masterAccountId) or is a free-text custom
 * entry. Falls back to matching the catalogue by name so a custom entry that
 * happens to match a known account (e.g. "mcb bank") gets its canonical
 * casing/icon instead of naive title-casing.
 */
const resolveAccountDetails = async ({ masterAccountId, name }) => {
  if (masterAccountId) {
    const master = await MasterAccount.findOne({ _id: masterAccountId, isActive: true });
    if (!master) {
      throw new ValidationError("Selected account is not available.");
    }
    return {
      name: master.name,
      normalizedName: master.normalizedName,
      type: master.type,
      icon: master.icon,
      masterAccount: master._id,
      isCustom: false,
    };
  }

  const cleaned = sanitizeName(name);
  const normalizedName = buildNormalizedKey(cleaned);
  const master = await MasterAccount.findOne({ normalizedName, isActive: true });
  if (master) {
    return {
      name: master.name,
      normalizedName: master.normalizedName,
      type: master.type,
      icon: master.icon,
      masterAccount: master._id,
      isCustom: false,
    };
  }

  return {
    name: capitalizeName(cleaned),
    normalizedName,
    type: "custom",
    icon: "💰",
    masterAccount: null,
    isCustom: true,
  };
};

/**
 * Same idea for categories. `type` (income/expense) is required for custom
 * entries since the master catalogue is keyed by name + type.
 */
const resolveCategoryDetails = async ({ masterCategoryId, name, type }) => {
  if (masterCategoryId) {
    const master = await MasterCategory.findOne({ _id: masterCategoryId, isActive: true });
    if (!master) {
      throw new ValidationError("Selected category is not available.");
    }
    return {
      name: master.name,
      normalizedName: master.normalizedName,
      type: master.type,
      group: master.group,
      icon: master.icon,
      color: master.color,
      masterCategory: master._id,
      isCustom: false,
    };
  }

  if (!["income", "expense"].includes(type)) {
    throw new ValidationError("Type must be income or expense.");
  }

  const cleaned = sanitizeName(name);
  const normalizedName = buildNormalizedKey(cleaned);
  const master = await MasterCategory.findOne({ normalizedName, type, isActive: true });
  if (master) {
    return {
      name: master.name,
      normalizedName: master.normalizedName,
      type: master.type,
      group: master.group,
      icon: master.icon,
      color: master.color,
      masterCategory: master._id,
      isCustom: false,
    };
  }

  return {
    name: capitalizeName(cleaned),
    normalizedName,
    type,
    group: "Other",
    icon: "🏷️",
    color: "#94a3b8",
    masterCategory: null,
    isCustom: true,
  };
};

module.exports = {
  resolveAccountDetails,
  resolveCategoryDetails,
};
