/**
 * Minimal in-memory sliding-window rate limiter factory. Good enough for a
 * single-instance deployment; swap the store for Redis if this ever runs
 * behind multiple server instances.
 */
const createRateLimiter = ({ windowMs, max, keyGenerator, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      hits.set(key, { windowStart: now, count: 1 });
      return next();
    }

    if (entry.count >= max) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        message: message || "Too many requests. Please try again later.",
        retryAfterSeconds,
      });
    }

    entry.count += 1;
    return next();
  };
};

module.exports = { createRateLimiter };
