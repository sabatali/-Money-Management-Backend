const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema(
  {
    fromAccount: { type: String, required: true, trim: true },
    toAccount: { type: String, required: true, trim: true },
    amountOriginal: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "PKR"], required: true },
    amountPKR: { type: Number, required: true },
    fee: { type: Number, default: 0 },
    feeCurrency: { type: String, enum: ["USD", "PKR"], default: "PKR" },
    feePKR: { type: Number, default: 0 },
    description: { type: String, trim: true },
    date: { type: Date, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Transfer", transferSchema);
