const { validationResult } = require("express-validator");
const Category = require("../models/category.model");

const createCategory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: "Validation failed", errors: errors.array() });
  }

  try {
    const { name, type } = req.body;
    const exists = await Category.findOne({ name, type, user: req.user.id });
    if (exists) {
      return res.status(409).json({ message: "Category already exists." });
    }
    const category = await Category.create({ name, type, user: req.user.id });
    return res.status(201).json({ message: "Category created.", data: category });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create category.", error: error.message });
  }
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
    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }
    return res.status(200).json({ message: "Category updated.", data: category });
  } catch (error) {
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
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
