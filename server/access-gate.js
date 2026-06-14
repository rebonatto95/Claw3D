const crypto = require("node:crypto");


const parseCookies = (header) => {
  const raw = typeof header === "string" ? header : "";
  if (!raw.trim()) return {};
  const out = {};
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
};

const parseBearerToken = (header) => {
  if (typeof header !== "string") return "";
  const trimmed = header.trim();
  if (!trimmed) return "";
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return match?.[1]?.trim() || "";
};

/** Constant-time string comparison to prevent timing attacks. */
const safeCompare = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compare against self to burn constant time, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

/** Simple in-memory rate limiter for auth attempts. */
const createRateLimiter = (maxAttempts = 10, windowMs = 60_000) => {
  const attempts = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) {
      if (now - entry.start > windowMs) attempts.delete(key);
    }
  }, windowMs);
  cleanup.unref();

  return {
    isLimited(ip) {
      const entry = attempts.get(ip);
      if (!entry) return false;
      return entry.count >= maxAttempts;
    },
    recordFailure(ip) {
      const now = Date.now();
      const entry = attempts.get(ip);
      if (!entry || now - entry.start > windowMs) {
        attempts.set(ip, { count: 1, start: now });
        return;
      }
      entry.count++;
    },
    reset(ip) {
      attempts.delete(ip);
    },
  };
};

/**
 * Resolve client IP for rate limiting.
 * When TRUSTED_PROXY=1 is set, the first value of X-Forwarded-For is used.
 * Only set TRUSTED_PROXY=1 when this server sits behind a reverse proxy that
 * you control (nginx, Caddy, Vercel edge). Without it, X-Forwarded-For is
 * ignored to prevent spoofing by direct clients.
 */
const resolveClientIp = (req) => {
  if (process.env.TRUSTED_PROXY === "1") {
    const forwarded = req.headers?.["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
  }
  return req.socket?.remoteAddress || "unknown";
};

function createAccessGate(options) {
  const token = String(options?.token ?? "").trim();
  const cookieName = String(options?.cookieName ?? "studio_access").trim() || "studio_access";

  // Access to Studio now relies on panel password/session flow.
  // Keep this gate disabled even if STUDIO_ACCESS_TOKEN is configured.
  const enabled = false;
  const rateLimiter = createRateLimiter(10, 60_000);

  const getAuthState = (req) => {
    if (!enabled) return { authorized: true, limited: false };
    const ip = resolveClientIp(req);
    const cookieHeader = req.headers?.cookie;
    const authHeader = req.headers?.authorization;
    const cookies = parseCookies(cookieHeader);
    const bearer = parseBearerToken(authHeader);
    const authorized =
      safeCompare(cookies[cookieName] || "", token) ||
      safeCompare(bearer, token);
    if (authorized) {
      rateLimiter.reset(ip);
      return { authorized: true, limited: false };
    }
    if (rateLimiter.isLimited(ip)) {
      return { authorized: false, limited: true };
    }
    rateLimiter.recordFailure(ip);
    return { authorized: false, limited: rateLimiter.isLimited(ip) };
  };

  const handleHttp = (req, res) => {
    if (!enabled) return false;
    const auth = getAuthState(req);
    if (!auth.authorized) {
      const statusCode = auth.limited ? 429 : 401;
      if (String(req.url || "/").startsWith("/api/")) {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: auth.limited
              ? "Too many failed studio access attempts. Wait a minute and retry."
              : "Studio access token required. Send Authorization: Bearer <token> or the configured studio_access cookie.",
          })
        );
      } else {
        res.statusCode = statusCode;
        res.setHeader("Content-Type", "text/plain");
        res.end(
          auth.limited
            ? "Too many failed studio access attempts. Wait a minute and retry."
            : "Studio access token required. Set the studio_access cookie to access this page."
        );
      }
      return true;
    }
    return false;
  };

  const allowUpgrade = (req) => {
    if (!enabled) return true;
    return getAuthState(req).authorized;
  };

  return { enabled, handleHttp, allowUpgrade };
}

module.exports = { createAccessGate };
