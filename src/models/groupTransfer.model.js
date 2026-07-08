const mongoose = require("mongoose");

const groupTransferSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    // GroupMember._id values — either side may be a registered or guest
    // member. See groupMemberService.js.
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: "GroupMember", required: true },
    toUser: { type: mongoose.Schema.Types.ObjectId, ref: "GroupMember", required: true },
    amountPKR: { type: Number, required: true },
    // Only meaningful when the payer is a registered member — guests have
    // no personal accounts, so this is optional.
    account: { type: String, trim: true },
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
