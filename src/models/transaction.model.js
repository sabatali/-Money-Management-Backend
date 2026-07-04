const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "PKR"], required: true },
    amountPKR: { type: Number, required: true },
    account: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    month: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    groupExpense: { type: mongoose.Schema.Types.ObjectId, ref: "GroupExpense" },
    groupTransfer: { type: mongoose.Schema.Types.ObjectId, ref: "GroupTransfer" },
    countInExpenseHistory: { type: Boolean, default: true },
    countInIncomeHistory: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Transaction", transactionSchema);
