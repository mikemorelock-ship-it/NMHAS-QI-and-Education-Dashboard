import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { UserRole } from "./permissions";
import { JWT_SECRET } from "./env";
import { prisma } from "./db";

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export interface Session {
  userId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  sessionVersion: number;
}

// Keep old type name as alias for backwards compatibility
export type AdminSession = Session;

// ---------------------------------------------------------------------------
// Password hashing / verification
// ---------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function createSession(user: Session): Promise<string> {
  return new SignJWT({
    userId: user.userId,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    sv: user.sessionVersion, // session version — checked against DB to allow invalidation
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

/**
 * Verify the session cookie and return the full session payload.
 * Returns null if not authenticated, JWT is invalid/expired, or the
 * session version in the token doesn't match the user's current version
 * (i.e., the session was invalidated by a password change or account disable).
 */
export async function verifySession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.firstName !== "string" ||
      typeof payload.lastName !== "string"
    ) {
      return null;
    }

    const tokenVersion = typeof payload.sv === "number" ? payload.sv : 0;

    // Check session version against the database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { sessionVersion: true, status: true, isActive: true },
    });

    // User deleted, disabled, or version mismatch → session invalid
    if (
      !user ||
      user.status === "disabled" ||
      !user.isActive ||
      user.sessionVersion !== tokenVersion
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      firstName: payload.firstName,
      lastName: payload.lastName,
      sessionVersion: tokenVersion,
    };
  } catch {
    return null;
  }
}
