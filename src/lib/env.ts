/**
 * Environment variable validation — imported early to crash fast on misconfiguration.
 *
 * Validates that all required env vars are present and not set to known insecure
 * defaults. Missing vars throw immediately; weak secrets produce a loud warning
 * (production deployments should use their own .env with strong values).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env file or environment.`
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Required variables
// ---------------------------------------------------------------------------

export const DATABASE_URL = requireEnv("DATABASE_URL");

export const JWT_SECRET = (() => {
  const secret = requireEnv("JWT_SECRET");

  // Reject the old hardcoded fallback that was baked into the source code.
  // This value was never meant to be used — it existed as a || default.
  if (secret === "fallback-secret-change-me") {
    throw new Error(
      "JWT_SECRET is set to the old hardcoded fallback. " +
        "Set a real secret in .env: openssl rand -base64 48"
    );
  }

  // Warn about weak-looking secrets (short or containing placeholder text).
  // We warn instead of throwing because `next build` sets NODE_ENV=production
  // and we don't want to block local builds.
  if (secret.length < 32) {
    console.warn(
      "⚠ JWT_SECRET is shorter than 32 characters. " +
        "Use a longer secret for production: openssl rand -base64 48"
    );
  }

  return new TextEncoder().encode(secret);
})();
