/**
 * Environment variable validation — crashes fast on misconfiguration at
 * runtime, but deferred so that `next build` can collect page data without
 * requiring every env var to be present in the build environment.
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
// Lazy accessors — the underlying requireEnv() only fires the first time each
// getter is called, which happens at request time rather than build time.
// ---------------------------------------------------------------------------

let _databaseUrl: string | undefined;
export function getDatabaseUrl(): string {
  if (!_databaseUrl) _databaseUrl = requireEnv("DATABASE_URL");
  return _databaseUrl;
}

let _jwtSecret: Uint8Array | undefined;
export function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;

  const secret = requireEnv("JWT_SECRET");

  if (secret === "fallback-secret-change-me") {
    throw new Error(
      "JWT_SECRET is set to the old hardcoded fallback. " +
        "Set a real secret in .env: openssl rand -base64 48"
    );
  }

  if (secret.length < 32) {
    console.warn(
      "⚠ JWT_SECRET is shorter than 32 characters. " +
        "Use a longer secret for production: openssl rand -base64 48"
    );
  }

  _jwtSecret = new TextEncoder().encode(secret);
  return _jwtSecret;
}

// Re-export for backwards compat — callers that import the named constants
// still work because `env` is a module-level object with live getters.
export { getDatabaseUrl as DATABASE_URL_GETTER, getJwtSecret as JWT_SECRET_GETTER };
