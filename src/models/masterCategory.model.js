const mongoose = require("mongoose");

const masterCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, lowercase: true, trim: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    group: { type: String, required: true, trim: true },
    icon: { type: String, default: "🏷️" },
    color: { type: String, default: "#94a3b8" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

masterCategorySchema.index({ normalizedName: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("MasterCategory", masterCategorySchema);
