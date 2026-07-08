// Falls back to the known production LibraMate domain (instead of
// localhost) when FRONTEND_URL isn't configured in a production
// environment, so links in emails never silently point at localhost.
// The correct fix is always to set FRONTEND_URL in the environment —
// this is just a safety net against misconfiguration.
const PRODUCTION_FALLBACK_URL = "https://libra-mate.vercel.app";
const DEV_FALLBACK_URL = "http://localhost:5173";

const getFrontendBaseUrl = () => {
  const configured = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const fallback =
    process.env.NODE_ENV === "production" ? PRODUCTION_FALLBACK_URL : DEV_FALLBACK_URL;
  return fallback.replace(/\/$/, "");
};

module.exports = { getFrontendBaseUrl };
