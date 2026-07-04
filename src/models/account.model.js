const mongoose = require("mongoose");

const accountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    currency: { type: String, enum: ["USD", "PKR"], default: "PKR" },
    openingBalance: { type: Number, default: 0 },
    openingBalancePKR: { type: Number, default: 0 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Account", accountSchema);
