import { headers } from "next/headers";
import { prisma } from "./db";

type LoginAttemptInput = {
  identifier: string;
  success: boolean;
  reason?: string | null;
};

/**
 * Record a login attempt for security auditing.
 * Captures IP address and user agent from the request headers.
 * Failures are logged asynchronously — never blocks the login response.
 */
export async function logLoginAttempt(input: LoginAttemptInput): Promise<void> {
  try {
    const hdrs = await headers();
    const ipAddress =
      hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      hdrs.get("x-real-ip") ??
      null;
    const userAgent = hdrs.get("user-agent") ?? null;

    await prisma.loginAttempt.create({
      data: {
        identifier: input.identifier,
        success: input.success,
        reason: input.reason ?? null,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Never let audit logging break authentication
    console.error("Failed to log login attempt:", err);
  }
}
