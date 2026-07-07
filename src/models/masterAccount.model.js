const mongoose = require("mongoose");

const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "wallet",
  "international",
  "crypto",
  "credit_card",
];

const masterAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, lowercase: true, trim: true },
    group: { type: String, required: true, trim: true },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    icon: { type: String, default: "💰" },
    country: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

masterAccountSchema.index({ normalizedName: 1 }, { unique: true });

module.exports = mongoose.model("MasterAccount", masterAccountSchema);
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
