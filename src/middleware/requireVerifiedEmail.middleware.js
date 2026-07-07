const User = require("../models/user.model");

/**
 * Route guard for features that require a trusted (verified) identity, e.g.
 * anything involving multiple users such as Group Expenses. Attach this
 * after `auth` on any router/route that should declare
 * `requiresVerifiedEmail = true` — it's intentionally a drop-in middleware
 * so new features can opt in without touching controller logic.
 */
const requireVerifiedEmail = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("emailVerified");
    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email to use this feature.",
        code: "EMAIL_VERIFICATION_REQUIRED",
      });
    }

    return next();
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to check verification status.", error: error.message });
  }
};

module.exports = requireVerifiedEmail;
