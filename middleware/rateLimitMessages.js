const WINDOW_MS = 10 * 1000;
const MAX_MESSAGES = 6;

const buckets = new Map();

const rateLimitMessages = (req, res, next) => {
  const userId = res.locals.user?._id?.toString();
  if (!userId) {
    return res.status(401).send({ error: "Unauthorized." });
  }

  const now = Date.now();
  const bucket = buckets.get(userId) || { count: 0, resetAt: now + WINDOW_MS };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }

  bucket.count += 1;
  buckets.set(userId, bucket);

  if (bucket.count > MAX_MESSAGES) {
    const retryAfter = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
    res.set("Retry-After", retryAfter.toString());
    return res.status(429).send({
      error: "Slow down. You're sending messages too quickly.",
      retryAfter,
    });
  }

  next();
};

module.exports = rateLimitMessages;
