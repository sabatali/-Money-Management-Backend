const nodemailer = require("nodemailer");
const { getFrontendBaseUrl } = require("./frontendUrl");
const { COLORS, renderEmailShell, renderButton, renderLinkFallback } = require("./emailTemplates");

let cachedTransporter;

const isEmailConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!isEmailConfigured()) return null;
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
};

const buildVerificationEmailHtml = ({ name, verificationUrl }) =>
  renderEmailShell({
    bodyHtml: `
      <h1 style="margin: 0 0 14px; font-size: 20px; font-weight: 800; color: ${COLORS.ink}; letter-spacing: -0.01em;">
        Verify your email
      </h1>
      <p style="margin: 0 0 12px;">Hi ${name || "there"},</p>
      <p style="margin: 0 0 4px;">
        Confirm your email address to unlock Group Expenses and other collaborative
        features on LibraMate.
      </p>
      ${renderButton(verificationUrl, "Verify Email")}
      ${renderLinkFallback(verificationUrl)}
      <p style="font-size: 12px; color: ${COLORS.muted}; margin: 16px 0 0;">
        This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
      </p>
    `,
    footerNote: "You're receiving this because you signed up for LibraMate.",
  });

const buildGuestInviteEmailHtml = ({ guestName, groupName, inviterName, registerUrl }) =>
  renderEmailShell({
    bodyHtml: `
      <h1 style="margin: 0 0 14px; font-size: 20px; font-weight: 800; color: ${COLORS.ink}; letter-spacing: -0.01em;">
        You've been added to a group
      </h1>
      <p style="margin: 0 0 12px;">Hi ${guestName || "there"},</p>
      <p style="margin: 0 0 12px;">
        ${inviterName || "A group admin"} added you as a guest member of
        <strong style="color: ${COLORS.ink};">${groupName}</strong> to track shared expenses
        on LibraMate.
      </p>
      <p style="margin: 0 0 4px;">
        Create a free account to log in, see your balances, and settle up directly —
        all your existing group history will carry over automatically, nothing is duplicated.
      </p>
      ${renderButton(registerUrl, "Create your account")}
      ${renderLinkFallback(registerUrl)}
    `,
    footerNote: `You're receiving this because you were added to "${groupName}" on LibraMate.`,
  });

/**
 * Invites a guest group-member to create a real LibraMate account. Reuses
 * the same graceful dev fallback as sendVerificationEmail (logs the link
 * instead of throwing when SMTP isn't configured).
 */
const sendGuestInviteEmail = async ({ to, guestName, groupName, inviterName }) => {
  const registerUrl = `${getFrontendBaseUrl()}/register?email=${encodeURIComponent(to)}`;

  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `\n[emailService] SMTP not configured. Guest invite link for ${to}:\n${registerUrl}\n`
    );
    return { delivered: false };
  }

  const fromAddress = process.env.EMAIL_FROM || '"LibraMate" <no-reply@libramate.app>';
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: `${inviterName || "Someone"} added you to "${groupName}" on LibraMate`,
    html: buildGuestInviteEmailHtml({ guestName, groupName, inviterName, registerUrl }),
  });

  return { delivered: true };
};

/**
 * Sends the verification email. When SMTP credentials aren't configured
 * (e.g. local development or CI), the link is logged instead of throwing,
 * so the rest of the flow remains fully testable without real email
 * infrastructure.
 */
const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.log(
      `\n[emailService] SMTP not configured. Verification link for ${to}:\n${verificationUrl}\n`
    );
    return { delivered: false };
  }

  const fromAddress = process.env.EMAIL_FROM || '"LibraMate" <no-reply@libramate.app>';
  await transporter.sendMail({
    from: fromAddress,
    to,
    subject: "Verify your LibraMate email address",
    html: buildVerificationEmailHtml({ name, verificationUrl }),
  });

  return { delivered: true };
};

module.exports = {
  sendVerificationEmail,
  sendGuestInviteEmail,
  isEmailConfigured,
};
