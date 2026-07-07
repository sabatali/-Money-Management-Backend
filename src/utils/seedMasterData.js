const MasterAccount = require("../models/masterAccount.model");
const MasterCategory = require("../models/masterCategory.model");
const masterAccountsData = require("../data/masterAccounts.data");
const masterCategoriesData = require("../data/masterCategories.data");

/**
 * Idempotently upserts the built-in master account/category catalogue so it
 * can be queried, extended, or deactivated from the database directly
 * without redeploying code.
 */
const seedMasterAccounts = async () => {
  const operations = masterAccountsData.map((item) => {
    const normalizedName = item.name.trim().toLowerCase();
    return {
      updateOne: {
        filter: { normalizedName },
        update: {
          $set: {
            name: item.name,
            normalizedName,
            group: item.group,
            type: item.type,
            icon: item.icon,
            country: item.country || null,
            sortOrder: item.sortOrder,
          },
          $setOnInsert: { isActive: true },
        },
        upsert: true,
      },
    };
  });

  if (operations.length) {
    await MasterAccount.bulkWrite(operations, { ordered: false });
  }
};

const seedMasterCategories = async () => {
  const operations = masterCategoriesData.map((item) => {
    const normalizedName = item.name.trim().toLowerCase();
    return {
      updateOne: {
        filter: { normalizedName, type: item.type },
        update: {
          $set: {
            name: item.name,
            normalizedName,
            type: item.type,
            group: item.group,
            icon: item.icon,
            color: item.color,
            sortOrder: item.sortOrder,
          },
          $setOnInsert: { isActive: true },
        },
        upsert: true,
      },
    };
  });

  if (operations.length) {
    await MasterCategory.bulkWrite(operations, { ordered: false });
  }
};

const seedMasterData = async () => {
  try {
    await Promise.all([seedMasterAccounts(), seedMasterCategories()]);
    console.log("Master account/category catalogue is up to date.");
  } catch (error) {
    console.error("Failed to seed master data:", error.message);
  }
};

module.exports = seedMasterData;
