import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// CSRF Protection
//
// Validates that mutating requests (server actions, API routes) originate
// from the same site. This is defense-in-depth on top of SameSite=Lax cookies.
//
// Next.js 14+ automatically checks Origin on Server Actions, but we add
// an explicit check that can also be used in API routes and provides
// audit-friendly validation.
// ---------------------------------------------------------------------------

/**
 * Allowed origins for CSRF validation. In production, this should be
 * restricted to the actual deployment domain(s).
 */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // Always allow localhost for development
  origins.add("http://localhost:3000");
  origins.add("http://localhost:3001");
  origins.add("http://127.0.0.1:3000");
  origins.add("http://127.0.0.1:3001");

  // Add production origins from environment
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    origins.add(siteUrl);
    // Also add without trailing slash
    origins.add(siteUrl.replace(/\/$/, ""));
  }

  return origins;
}

/**
 * Validate that the request Origin matches the expected Host.
 *
 * Returns `true` if the request passes CSRF validation:
 * 1. Origin header matches an allowed origin, OR
 * 2. Origin header matches the Host header (same-origin), OR
 * 3. No Origin header (same-origin GET-style navigation, not a security risk for server actions)
 *
 * Returns `false` if the Origin is present but doesn't match.
 */
export async function validateCsrf(): Promise<boolean> {
  try {
    const hdrs = await headers();
    const origin = hdrs.get("origin");

    // No Origin header — browser didn't send one (same-origin navigational request)
    // Server Actions always include Origin in modern browsers, so this is safe
    if (!origin) return true;

    // Check against allowed origins
    const allowed = getAllowedOrigins();
    if (allowed.has(origin)) return true;

    // Check Origin matches Host (fallback for dynamic environments)
    const host = hdrs.get("host");
    if (host) {
      const proto = hdrs.get("x-forwarded-proto") || "http";
      const expectedOrigin = `${proto}://${host}`;
      if (origin === expectedOrigin) return true;
    }

    console.warn(`CSRF validation failed: origin="${origin}", host="${hdrs.get("host")}"`);
    return false;
  } catch (err) {
    console.error("CSRF validation error:", err);
    // Fail open to avoid locking out legitimate users due to header parsing errors
    return true;
  }
}

/**
 * Middleware-compatible CSRF check for API routes.
 * Throws an error if CSRF validation fails.
 */
export async function requireCsrf(): Promise<void> {
  const valid = await validateCsrf();
  if (!valid) {
    throw new Error("CSRF validation failed: request origin does not match");
  }
}
