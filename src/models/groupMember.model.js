const mongoose = require("mongoose");

// Unified identity for anyone participating in a group's expenses —
// either a registered LibraMate user or a guest with no account. This is
// the canonical reference used everywhere financial data is recorded
// (GroupExpense.paidBy/splits, GroupTransfer.fromUser/toUser), so that
// "claiming" a guest profile later is just an in-place update of this one
// document — every historical record automatically resolves correctly
// with zero data migration.
const groupMemberSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    memberType: { type: String, enum: ["registered", "guest"], required: true, default: "registered" },

    // Registered members only
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // Guest members only
    guestName: { type: String, trim: true, default: null },
    normalizedGuestName: { type: String, default: null },
    guestEmail: { type: String, trim: true, lowercase: true, default: null },
    guestPhone: { type: String, trim: true, default: null },
    notes: { type: String, trim: true, default: null, maxlength: 300 },
    guestInviteSentAt: { type: Date, default: null },

    role: { type: String, enum: ["admin", "member"], default: "member" },
    // True for registered members always; for guests, flips to true once
    // they register and claim this profile (memberType becomes "registered").
    claimed: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false }
);

// A registered user can only appear once per group.
groupMemberSchema.index(
  { group: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: "objectId" } } }
);

// Fast lookup for "find unclaimed guest profiles matching this email"
// (used by the claim-detection flow after a guest registers).
groupMemberSchema.index({ memberType: 1, guestEmail: 1, claimed: 1 });

module.exports = mongoose.model("GroupMember", groupMemberSchema);
