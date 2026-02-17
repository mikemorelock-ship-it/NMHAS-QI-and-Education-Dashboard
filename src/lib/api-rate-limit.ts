/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per IP address. Automatically cleans up
 * expired entries to prevent memory leaks.
 *
 * For login rate limiting (with account lockout), see `rate-limit.ts` which
 * uses the database. This module is for general API throttling where
 * persistence isn't needed.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // Unix ms
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

export interface ApiRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Check whether a request should be allowed.
 *
 * @param key - Unique identifier (typically IP address or IP + route)
 * @param maxRequests - Maximum requests per window (default: 60)
 * @param windowMs - Window size in milliseconds (default: 60 seconds)
 */
export function checkApiRateLimit(
  key: string,
  maxRequests = 60,
  windowMs = 60_000
): ApiRateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Get the client IP from a request.
 * Checks X-Forwarded-For (reverse proxy) first, falls back to connection IP.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs; use the first (client)
    return forwarded.split(",")[0].trim();
  }
  // Fallback — in production behind a proxy this shouldn't happen
  return "unknown";
}
