import type { NextConfig } from "next";
import path from "path";

const securityHeaders = [
  {
    // Prevent clickjacking — only allow this site to frame itself
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    // Prevent MIME-type sniffing
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Control referrer information sent with requests
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict permissions for browser features
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Enforce HTTPS in production (1 year, include subdomains)
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    // Content Security Policy — restricts script/style/image sources
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval for dev; tighten with nonces in production
      "style-src 'self' 'unsafe-inline'", // Tailwind injects styles inline
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:", // ws/wss needed for Next.js HMR WebSocket in dev
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Prevent bundler from trying to resolve native addons (used only in local dev)
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  headers: async () => [
    {
      // Apply security headers to all routes
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
