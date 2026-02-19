import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Rate Limiting & Account Lockout
//
// Uses the existing LoginAttempt table to enforce brute-force protection.
// No schema changes needed — just queries against existing data.
// ---------------------------------------------------------------------------

/** Rate limit window: 5 failed attempts per 15 minutes */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_ATTEMPTS = 5;

/** Account lockout: 10 failed attempts in 1 hour → 30-minute lockout */
const LOCKOUT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const LOCKOUT_MAX_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  reason?: "rate_limited" | "account_locked";
}

/**
 * Check whether a login attempt should be allowed based on recent failure history.
 *
 * Returns `{ allowed: true }` if the login can proceed, or
 * `{ allowed: false, reason, retryAfterSeconds }` if blocked.
 */
export async function checkLoginAllowed(identifier: string): Promise<RateLimitResult> {
  const now = new Date();

  try {
    // 1. Check account lockout (10 failures in 1 hour)
    const lockoutWindowStart = new Date(now.getTime() - LOCKOUT_WINDOW_MS);
    const lockoutFailures = await prisma.loginAttempt.count({
      where: {
        identifier,
        success: false,
        createdAt: { gte: lockoutWindowStart },
      },
    });

    if (lockoutFailures >= LOCKOUT_MAX_ATTEMPTS) {
      // Find when the oldest failure in the window was — lockout expires
      // LOCKOUT_DURATION_MS after the Nth failure
      const nthFailure = await prisma.loginAttempt.findFirst({
        where: {
          identifier,
          success: false,
          createdAt: { gte: lockoutWindowStart },
        },
        orderBy: { createdAt: "desc" },
        skip: LOCKOUT_MAX_ATTEMPTS - 1,
        select: { createdAt: true },
      });

      if (nthFailure) {
        const lockoutExpiresAt = new Date(nthFailure.createdAt.getTime() + LOCKOUT_DURATION_MS);
        if (now < lockoutExpiresAt) {
          const retryAfterSeconds = Math.ceil((lockoutExpiresAt.getTime() - now.getTime()) / 1000);
          return {
            allowed: false,
            retryAfterSeconds,
            reason: "account_locked",
          };
        }
      }
    }

    // 2. Check rate limit (5 failures in 15 minutes)
    const rateLimitWindowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
    const recentFailures = await prisma.loginAttempt.count({
      where: {
        identifier,
        success: false,
        createdAt: { gte: rateLimitWindowStart },
      },
    });

    if (recentFailures >= RATE_LIMIT_MAX_ATTEMPTS) {
      // Find the oldest failure in the window to compute retry time
      const oldestInWindow = await prisma.loginAttempt.findFirst({
        where: {
          identifier,
          success: false,
          createdAt: { gte: rateLimitWindowStart },
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      });

      const retryAfterSeconds = oldestInWindow
        ? Math.ceil(
            (oldestInWindow.createdAt.getTime() + RATE_LIMIT_WINDOW_MS - now.getTime()) / 1000
          )
        : Math.ceil(RATE_LIMIT_WINDOW_MS / 1000);

      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
        reason: "rate_limited",
      };
    }

    return { allowed: true };
  } catch (err) {
    // If rate limit check fails, allow the login attempt to proceed
    // (don't lock users out due to a DB error)
    console.error("Rate limit check failed:", err);
    return { allowed: true };
  }
}
