const mongoose = require("mongoose");

// `user` stores a GroupMember._id (not a raw User._id) so both registered
// and guest members can be split participants. See groupMemberService.js.
const splitSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "GroupMember", required: true },
    shareAmountPKR: { type: Number, required: true },
  },
  { _id: false }
);

const groupExpenseSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    title: { type: String, required: true, trim: true },
    totalAmountOriginal: { type: Number, required: true },
    currency: { type: String, enum: ["USD", "PKR"], required: true },
    totalAmountPKR: { type: Number, required: true },
    // GroupMember._id of the payer (see splitSchema comment above).
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "GroupMember", required: true },
    splitType: { type: String, enum: ["EQUAL", "MANUAL"], required: true },
    splits: { type: [splitSchema], default: [] },
    accountUsed: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("GroupExpense", groupExpenseSchema);
