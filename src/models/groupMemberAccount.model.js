const mongoose = require("mongoose");

const groupMemberAccountSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    accounts: [{ type: String, required: true }], // Account names (1-2 max)
  },
  { timestamps: true, versionKey: false }
);

// Ensure unique user per group
groupMemberAccountSchema.index({ group: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("GroupMemberAccount", groupMemberAccountSchema);
