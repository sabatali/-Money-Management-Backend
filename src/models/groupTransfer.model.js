const mongoose = require("mongoose");

const groupTransferSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountPKR: { type: Number, required: true },
    account: { type: String, required: true, trim: true },
    toAccount: { type: String, trim: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["Pending", "Confirmed", "Rejected"], default: "Pending" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    confirmedAt: { type: Date },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("GroupTransfer", groupTransferSchema);
