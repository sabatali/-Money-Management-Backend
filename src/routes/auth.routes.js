const express = require("express");
const { body } = require("express-validator");
const { register, login, getMe } = require("../controllers/auth.controller");
const {
  sendVerificationEmail,
  verifyEmail,
} = require("../controllers/emailVerification.controller");
const auth = require("../middleware/auth.middleware");
const { createRateLimiter } = require("../middleware/rateLimit.middleware");

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").isEmail().withMessage("Valid email is required."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters."),
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  login
);

router.get("/me", auth, getMe);

// Cooldown for repeat sends is already enforced per-user in the controller;
// this is a coarser defense-in-depth limit against scripted abuse.
const sendVerificationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => `send-verify:${req.user?.id || req.ip}`,
  message: "Too many verification requests. Please wait a moment and try again.",
});

const verifyLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `verify:${req.ip}`,
  message: "Too many attempts. Please wait a moment and try again.",
});

router.post("/verify-email/send", auth, sendVerificationLimiter, sendVerificationEmail);
router.post("/verify-email", verifyLimiter, verifyEmail);

module.exports = router;
