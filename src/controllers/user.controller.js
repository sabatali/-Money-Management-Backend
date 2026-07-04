const User = require("../models/user.model");

const searchUsers = async (req, res) => {
  try {
    const emailQuery = (req.query.email || "").trim().toLowerCase();
    if (!emailQuery) {
      return res.status(400).json({ message: "email query is required." });
    }

    const users = await User.find({
      email: { $regex: emailQuery, $options: "i" },
    })
      .limit(10)
      .select("_id name email");

    return res.status(200).json({
      data: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
      })),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to search users.", error: error.message });
  }
};

module.exports = { searchUsers };
