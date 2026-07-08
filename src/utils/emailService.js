const nodemailer = require("nodemailer");
const { getFrontendBaseUrl } = require("./frontendUrl");

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

const buildVerificationEmailHtml = ({ name, verificationUrl }) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
    <div style="width: 44px; height: 44px; border-radius: 12px; background: #10B981; color: #FFFFFF; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">LM</div>
    <h2 style="margin: 0 0 12px;">Verify your email</h2>
    <p>Hi ${name || "there"},</p>
    <p>Confirm your email address to unlock Group Expenses and future collaborative features on LibraMate.</p>
    <p style="margin: 24px 0;">
      <a href="${verificationUrl}" style="background:#10B981;color:#FFFFFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Verify Email</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">Or copy this link into your browser:</p>
    <p style="word-break: break-all; font-size: 13px; color: #4F46E5;">${verificationUrl}</p>
    <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">This link expires in 24 hours. If you didn't request this, you can ignore this email.</p>
  </div>
`;

const buildGuestInviteEmailHtml = ({ guestName, groupName, inviterName, registerUrl }) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
    <div style="width: 44px; height: 44px; border-radius: 12px; background: #10B981; color: #FFFFFF; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">LM</div>
    <h2 style="margin: 0 0 12px;">You've been added to a group on LibraMate</h2>
    <p>Hi ${guestName || "there"},</p>
    <p>${inviterName || "A group admin"} added you as a guest member of <strong>${groupName}</strong> to track shared expenses on LibraMate.</p>
    <p>Create a free account to log in, see your balances, and settle up directly — all your existing group history will carry over automatically.</p>
    <p style="margin: 24px 0;">
      <a href="${registerUrl}" style="background:#10B981;color:#FFFFFF;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Create your account</a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">Or copy this link into your browser:</p>
    <p style="word-break: break-all; font-size: 13px; color: #4F46E5;">${registerUrl}</p>
  </div>
`;

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
