// Shared HTML email shell for all transactional emails, so every message
// (verification, guest invites, future notifications) shares one
// consistent, on-brand LibraMate look. Emails use inline styles and a
// light card (rather than the app's dark theme) for maximum
// compatibility across email clients, while still carrying the same
// logo mark, colors and typography used across the product.

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const COLORS = {
  accent: "#10B981",
  accentDark: "#059669",
  ink: "#0F172A",
  body: "#334155",
  muted: "#94A3B8",
  border: "#E2E8F0",
  panel: "#F8FAFC",
};

// Inline SVG mark mirroring the in-app <Logo /> component (a balanced
// ledger stroke with an accent dot) so the brand mark is pixel-consistent
// between the product and its emails.
const LOGO_MARK_SVG = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 4V15.5C7 16.8807 8.11929 18 9.5 18H18" stroke="${COLORS.accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="7" r="2.2" fill="${COLORS.accent}"/>
  </svg>
`;

const renderHeader = () => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
    <tr>
      <td style="width: 40px; height: 40px; border-radius: 12px; background: ${COLORS.ink}; text-align: center; vertical-align: middle;">
        ${LOGO_MARK_SVG}
      </td>
      <td style="padding-left: 12px; vertical-align: middle;">
        <div style="font-size: 16px; font-weight: 800; color: ${COLORS.ink}; letter-spacing: -0.01em; line-height: 1.2;">LibraMate</div>
        <div style="font-size: 10px; font-weight: 600; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 2px;">Balance. Simplified.</div>
      </td>
    </tr>
  </table>
`;

const renderButton = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
    <tr>
      <td style="border-radius: 12px; background: ${COLORS.accent};">
        <a href="${href}" style="display: inline-block; padding: 13px 26px; font-size: 14px; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 12px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>
`;

const renderLinkFallback = (href) => `
  <p style="font-size: 12px; color: ${COLORS.muted}; margin: 0 0 4px;">Or copy and paste this link into your browser:</p>
  <p style="word-break: break-all; font-size: 12px; color: ${COLORS.accentDark}; margin: 0 0 4px;">${href}</p>
`;

const renderFooter = (note) => `
  <div style="margin-top: 8px; padding-top: 20px; border-top: 1px solid ${COLORS.border};">
    ${note ? `<p style="font-size: 12px; color: ${COLORS.muted}; margin: 0 0 12px;">${note}</p>` : ""}
    <p style="font-size: 11px; color: ${COLORS.muted}; margin: 0;">
      © ${new Date().getFullYear()} LibraMate. Balance, simplified.
    </p>
  </div>
`;

/**
 * Wraps arbitrary body HTML in the shared LibraMate email card. `bodyHtml`
 * should only contain content-level markup (heading, paragraphs, button) —
 * layout, header and footer are handled here so every email stays visually
 * consistent.
 */
const renderEmailShell = ({ bodyHtml, footerNote }) => `
  <div style="background: ${COLORS.panel}; padding: 40px 16px; font-family: ${FONT_STACK};">
    <div style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border: 1px solid ${COLORS.border}; border-radius: 20px; padding: 32px;">
      ${renderHeader()}
      <div style="color: ${COLORS.body}; font-size: 14px; line-height: 1.6;">
        ${bodyHtml}
      </div>
      ${renderFooter(footerNote)}
    </div>
  </div>
`;

module.exports = {
  COLORS,
  renderEmailShell,
  renderButton,
  renderLinkFallback,
};
