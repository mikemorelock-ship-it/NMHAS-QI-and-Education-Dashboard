import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Middleware runs on the Edge runtime — we can't import env.ts (Node-only).
// Construct JWT_SECRET directly here; the same env var is validated at app
// startup by env.ts so we know it's present and non-fallback.
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// ---------------------------------------------------------------------------
// CORS Configuration
// ---------------------------------------------------------------------------

/**
 * Allowed origins for CORS. In dev, allow localhost; in production,
 * restrict to the deployment domain via NEXT_PUBLIC_SITE_URL.
 */
function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  origins.add("http://localhost:3000");
  origins.add("http://localhost:3001");
  origins.add("http://127.0.0.1:3000");
  origins.add("http://127.0.0.1:3001");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    origins.add(siteUrl.replace(/\/$/, ""));
  }

  return origins;
}

function setCorsHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  const allowed = getAllowedOrigins();
  if (origin && allowed.has(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  // Never allow credentials from untrusted origins
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Max-Age", "86400"); // 24h preflight cache
  return response;
}

// ---------------------------------------------------------------------------
// API Rate Limiting (in-memory, per IP)
// ---------------------------------------------------------------------------

/** 60 requests per minute per IP for API routes */
const API_RATE_LIMIT = 60;
const API_RATE_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const apiRateStore = new Map<string, RateBucket>();
let lastRateCleanup = Date.now();

function getIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

function checkApiRate(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  // Periodic cleanup (every 2 min)
  if (now - lastRateCleanup > 120_000) {
    lastRateCleanup = now;
    for (const [k, v] of apiRateStore) {
      if (now >= v.resetAt) apiRateStore.delete(k);
    }
  }

  const bucket = apiRateStore.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    apiRateStore.set(ip, { count: 1, resetAt: now + API_RATE_WINDOW_MS });
    return { allowed: true };
  }
  bucket.count += 1;
  if (bucket.count > API_RATE_LIMIT) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// JWT Verification
// ---------------------------------------------------------------------------

/**
 * Verify a JWT token's signature and expiration.
 * Returns true if valid, false otherwise.
 */
async function isValidToken(token: string): Promise<boolean> {
  if (!JWT_SECRET.length) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    // Expired, tampered, or malformed — all rejected
    return false;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // Handle CORS preflight (OPTIONS) requests for API routes
  if (request.method === "OPTIONS" && pathname.startsWith("/api")) {
    const response = new NextResponse(null, { status: 204 });
    return setCorsHeaders(response, origin);
  }

  // Allow logout endpoint without valid session (needed for idle timeout cleanup)
  if (pathname === "/api/auth/logout" && request.method === "POST") {
    return NextResponse.next();
  }

  // Protect all routes except login, register, and static assets
  // The matcher below already filters to only matched routes
  const token = request.cookies.get("session")?.value;
  if (!token || !(await isValidToken(token))) {
    // For API routes, return 401 instead of redirecting
    if (pathname.startsWith("/api")) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Clear the invalid cookie so the user isn't stuck in a redirect loop
    const response = NextResponse.redirect(
      new URL("/login", request.url)
    );
    if (token) response.cookies.delete("session");
    return response;
  }

  // Rate limit API routes (60 req/min per IP)
  if (pathname.startsWith("/api")) {
    const ip = getIp(request);
    const rateResult = checkApiRate(ip);
    if (!rateResult.allowed) {
      const res = new NextResponse(
        JSON.stringify({
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateResult.retryAfter ?? 60),
          },
        }
      );
      return setCorsHeaders(res, origin);
    }
  }

  // Set CORS headers on API responses
  const response = NextResponse.next();
  if (pathname.startsWith("/api")) {
    setCorsHeaders(response, origin);
  }
  return response;
}

export const config = {
  // Match everything EXCEPT: login, register, static assets, favicon
  matcher: [
    "/((?!login|register|_next/static|_next/image|favicon\\.ico|api/public).*)",
    "/api/:path*",
  ],
};
