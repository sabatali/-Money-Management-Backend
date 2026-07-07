const { validationResult } = require("express-validator");
const Category = require("../models/category.model");
const { resolveCategoryDetails } = require("../utils/masterDataResolver");
const { ValidationError } = require("../utils/nameValidation");

const createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { masterCategoryId, name, type } = req.body;
    const resolved = await resolveCategoryDetails({ masterCategoryId, name, type });

    const exists = await Category.findOne({
      normalizedName: resolved.normalizedName,
      type: resolved.type,
      user: req.user.id,
    });
    if (exists) {
      return res.status(409).json({ message: "Category already exists." });
    }

    const category = await Category.create({
      name: resolved.name,
      normalizedName: resolved.normalizedName,
      type: resolved.type,
      group: resolved.group,
      icon: resolved.icon,
      color: resolved.color,
      masterCategory: resolved.masterCategory,
      isCustom: resolved.isCustom,
      user: req.user.id,
    });
    return res.status(201).json({ message: "Category created.", data: category });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Category already exists." });
    }
    return res.status(500).json({ message: "Failed to create category.", error: error.message });
  }
};

/**
 * Accepts a list of categories (each either { masterCategoryId } or a custom
 * { name, type }) and creates as many as possible in one request, e.g. from
 * the onboarding screen.
 */
const bulkCreateCategories = async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items || items.length === 0) {
    return res.status(400).json({ message: "Provide a non-empty items array." });
  }

  const created = [];
  const skipped = [];
  const seenKeys = new Set();

  const existingCategories = await Category.find(
    { user: req.user.id },
    "normalizedName type"
  );
  existingCategories.forEach((category) =>
    seenKeys.add(`${category.type}:${category.normalizedName}`)
  );

  for (const item of items) {
    try {
      const resolved = await resolveCategoryDetails({
        masterCategoryId: item.masterCategoryId,
        name: item.name,
        type: item.type,
      });

      const key = `${resolved.type}:${resolved.normalizedName}`;
      if (seenKeys.has(key)) {
        skipped.push({ input: item, reason: "Already exists." });
        continue;
      }

      const category = await Category.create({
        name: resolved.name,
        normalizedName: resolved.normalizedName,
        type: resolved.type,
        group: resolved.group,
        icon: resolved.icon,
        color: resolved.color,
        masterCategory: resolved.masterCategory,
        isCustom: resolved.isCustom,
        user: req.user.id,
      });

      seenKeys.add(key);
      created.push(category);
    } catch (error) {
      skipped.push({ input: item, reason: error.message || "Failed to create." });
    }
  }

  return res.status(201).json({
    message: `Created ${created.length} category(ies), skipped ${skipped.length}.`,
    data: { created, skipped },
  });
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ user: req.user.id }).sort({ name: 1 });
    return res.status(200).json({ data: categories });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch categories.", error: error.message });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findOne({ _id: req.params.id, user: req.user.id });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }
    return res.status(200).json({ data: category });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch category.", error: error.message });
  }
};

const updateCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const current = await Category.findOne({ _id: req.params.id, user: req.user.id });
    if (!current) {
      return res.status(404).json({ message: "Category not found." });
    }

    const update = { ...req.body };

    if (typeof update.name === "string") {
      const resolved = await resolveCategoryDetails({
        name: update.name,
        type: update.type || current.type,
      });

      const duplicate = await Category.findOne({
        _id: { $ne: req.params.id },
        normalizedName: resolved.normalizedName,
        type: resolved.type,
        user: req.user.id,
      });
      if (duplicate) {
        return res.status(409).json({ message: "Category already exists." });
      }

      update.name = resolved.name;
      update.normalizedName = resolved.normalizedName;
      update.type = resolved.type;
      if (resolved.masterCategory) {
        update.group = resolved.group;
        update.icon = resolved.icon;
        update.color = resolved.color;
        update.masterCategory = resolved.masterCategory;
        update.isCustom = false;
      }
    }

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      update,
      { new: true }
    );
    return res.status(200).json({ message: "Category updated.", data: category });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Category already exists." });
    }
    return res.status(500).json({ message: "Failed to update category.", error: error.message });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }
    return res.status(200).json({ message: "Category deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete category.", error: error.message });
  }
};

module.exports = {
  createCategory,
  bulkCreateCategories,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
