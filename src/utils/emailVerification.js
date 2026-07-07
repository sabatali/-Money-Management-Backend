const crypto = require("crypto");

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

/**
 * Generates a random verification token. The raw token is emailed to the
 * user and never stored; only its SHA-256 hash is persisted so a leaked
 * database can't be used to mint valid verification links.
 */
const generateVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
};

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  generateVerificationToken,
  hashToken,
  TOKEN_EXPIRY_MS,
  RESEND_COOLDOWN_MS,
};
