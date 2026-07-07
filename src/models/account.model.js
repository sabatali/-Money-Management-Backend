const mongoose = require("mongoose");

const ACCOUNT_TYPES = [
  "cash",
  "bank",
  "wallet",
  "international",
  "crypto",
  "credit_card",
  "custom",
];

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, lowercase: true, trim: true },
    currency: { type: String, enum: ["USD", "PKR"], default: "PKR" },
    openingBalance: { type: Number, default: 0 },
    openingBalancePKR: { type: Number, default: 0 },
    type: { type: String, enum: ACCOUNT_TYPES, default: "custom" },
    icon: { type: String, default: "💰" },
    masterAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterAccount",
      default: null,
    },
    isCustom: { type: Boolean, default: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

accountSchema.index({ user: 1, normalizedName: 1 }, { unique: true });

module.exports = mongoose.model("Account", accountSchema);
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
