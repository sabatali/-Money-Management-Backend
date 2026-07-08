const User = require("../models/user.model");
const {
  generateVerificationToken,
  hashToken,
  TOKEN_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
} = require("../utils/emailVerification");
const { sendVerificationEmail: deliverVerificationEmail } = require("../utils/emailService");
const { getFrontendBaseUrl } = require("../utils/frontendUrl");

// Verification links are only useful for development/testing when the raw
// token is surfaced somewhere other than the (possibly unconfigured) email
// inbox, mirroring the existing dev-tools convention in this codebase.
const isDevEnvironment = process.env.NODE_ENV !== "production";

const buildVerificationUrl = (token) => `${getFrontendBaseUrl()}/verify-email?token=${token}`;

const sendVerificationEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified." });
    }

    if (user.emailVerificationLastSentAt) {
      const elapsedMs = Date.now() - user.emailVerificationLastSentAt.getTime();
      if (elapsedMs < RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          message: `Please wait ${retryAfterSeconds}s before requesting another verification email.`,
          retryAfterSeconds,
        });
      }
    }

    const { token, tokenHash } = generateVerificationToken();
    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationTokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);
    user.emailVerificationLastSentAt = new Date();
    await user.save();

    const verificationUrl = buildVerificationUrl(token);
    await deliverVerificationEmail({ to: user.email, name: user.name, verificationUrl });

    return res.status(200).json({
      message: "Verification email sent. Please check your inbox.",
      data: {
        cooldownSeconds: RESEND_COOLDOWN_MS / 1000,
        ...(isDevEnvironment ? { devVerificationToken: token } : {}),
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to send verification email.", error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  const token = req.body?.token || req.query?.token;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Verification token is required." });
  }

  try {
    const tokenHash = hashToken(token);
    const user = await User.findOne({ emailVerificationTokenHash: tokenHash }).select(
      "+emailVerificationTokenHash"
    );

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification link." });
    }

    if (user.emailVerified) {
      return res.status(200).json({
        message: "Email already verified.",
        data: { emailVerified: true, verifiedAt: user.verifiedAt },
      });
    }

    if (
      !user.emailVerificationTokenExpiresAt ||
      user.emailVerificationTokenExpiresAt.getTime() < Date.now()
    ) {
      return res
        .status(400)
        .json({ message: "Verification link has expired. Please request a new one." });
    }

    user.emailVerified = true;
    user.verifiedAt = new Date();
    user.emailVerificationTokenHash = null;
    user.emailVerificationTokenExpiresAt = null;
    await user.save();

    return res.status(200).json({
      message: "Email successfully verified.",
      data: { emailVerified: true, verifiedAt: user.verifiedAt },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify email.", error: error.message });
  }
};

module.exports = { sendVerificationEmail, verifyEmail };
