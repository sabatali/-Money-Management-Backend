const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, lowercase: true, trim: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    group: { type: String, default: "Other" },
    icon: { type: String, default: "🏷️" },
    color: { type: String, default: "#94a3b8" },
    masterCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MasterCategory",
      default: null,
    },
    isCustom: { type: Boolean, default: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false }
);

categorySchema.index({ user: 1, normalizedName: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
