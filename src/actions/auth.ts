"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  verifyPassword,
  hashPassword,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  verifySession,
} from "@/lib/auth";
import { requireAdmin } from "@/lib/require-auth";
import { prisma } from "@/lib/db";
import { logLoginAttempt } from "@/lib/login-audit";
import { checkLoginAllowed } from "@/lib/rate-limit";
import { validatePasswordStrength, PASSWORD_REQUIREMENTS } from "@/lib/password-validation";
import { validateCsrf } from "@/lib/csrf";
import { headers } from "next/headers";
import type { UserRole } from "@/lib/permissions";
import { createAuditLog, computeChanges } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult = {
  success: boolean;
  error?: string;
};

export type AuthResult = {
  error?: string;
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const LoginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

const RegisterSchema = z
  .object({
    email: z.string().email("Valid email is required"),
    password: z
      .string()
      .min(1, "Password is required")
      .refine((val) => validatePasswordStrength(val).valid, { message: PASSWORD_REQUIREMENTS }),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required").max(50),
    lastName: z.string().min(1, "Last name is required").max(50),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const CreateAdminUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .refine((val) => validatePasswordStrength(val).valid, { message: PASSWORD_REQUIREMENTS }),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  role: z.enum(["admin", "manager", "data_entry", "supervisor", "fto", "trainee"]),
});

// ---------------------------------------------------------------------------
// Login / Logout
// ---------------------------------------------------------------------------

export async function loginAction(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  // CSRF check — reject cross-origin form submissions
  if (!(await validateCsrf())) {
    return { error: "Invalid request origin. Please refresh and try again." };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  const parsed = LoginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  // Rate limiting & account lockout check
  const rateCheck = await checkLoginAllowed(parsed.data.email);
  if (!rateCheck.allowed) {
    await logLoginAttempt({
      identifier: parsed.data.email,
      success: false,
      reason: rateCheck.reason ?? "rate_limited",
    });
    return {
      error:
        rateCheck.reason === "account_locked"
          ? "Account temporarily locked due to too many failed attempts. Please try again later."
          : `Too many login attempts. Please try again in ${rateCheck.retryAfterSeconds ?? 60} seconds.`,
    };
  }

  // Look up admin user by email
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user) {
    await logLoginAttempt({
      identifier: parsed.data.email,
      success: false,
      reason: "invalid_credentials",
    });
    return { error: "Invalid email or password" };
  }

  if (user.status === "pending") {
    await logLoginAttempt({
      identifier: parsed.data.email,
      success: false,
      reason: "account_pending",
    });
    return { error: "Your account is pending approval by an administrator" };
  }

  if (user.status === "disabled") {
    await logLoginAttempt({
      identifier: parsed.data.email,
      success: false,
      reason: "account_disabled",
    });
    return { error: "Your account has been disabled" };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    await logLoginAttempt({
      identifier: parsed.data.email,
      success: false,
      reason: "invalid_credentials",
    });
    return { error: "Invalid email or password" };
  }

  // Create session with full user info (includes sessionVersion for invalidation)
  const token = await createSession({
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    firstName: user.firstName,
    lastName: user.lastName,
    sessionVersion: user.sessionVersion,
  });
  await setSessionCookie(token);

  // Record login metadata for concurrent session awareness
  let clientIp: string | null = null;
  try {
    const h = await headers();
    clientIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  } catch {
    /* headers unavailable */
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: clientIp },
  });

  await logLoginAttempt({ identifier: parsed.data.email, success: true });

  await prisma.auditLog.create({
    data: {
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      details: `Login: ${user.email} (${user.role})`,
      actorId: user.id,
      actorType: "user",
    },
  });

  // Role-based redirect: dashboard roles → /, field training roles → /fieldtraining
  const dashboardRoles = ["admin", "manager", "data_entry"];
  const destination = dashboardRoles.includes(user.role) ? "/" : "/fieldtraining";
  redirect(destination);
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Registration (self-service — creates pending account)
// ---------------------------------------------------------------------------

export async function registerAction(
  _prevState: AuthResult | null,
  formData: FormData
): Promise<AuthResult & { success?: boolean }> {
  if (!(await validateCsrf())) {
    return { error: "Invalid request origin. Please refresh and try again." };
  }

  const raw = {
    email: (formData.get("email") as string)?.trim().toLowerCase(),
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
    firstName: (formData.get("firstName") as string)?.trim(),
    lastName: (formData.get("lastName") as string)?.trim(),
  };

  const parsed = RegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { email, password, firstName, lastName } = parsed.data;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: "data_entry", // default role, admin will assign on approval
      status: "pending",
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "REGISTER",
      entity: "User",
      entityId: email,
      details: `Account registration request from ${firstName} ${lastName} (${email})`,
      actorType: "system",
    },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Account Management (admin only)
// ---------------------------------------------------------------------------

export async function approveAccountAction(userId: string, role: UserRole): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_users");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }
    if (user.status !== "pending") {
      return { success: false, error: "User is not in pending status" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: "active", role },
    });

    await prisma.auditLog.create({
      data: {
        action: "APPROVE",
        entity: "User",
        entityId: userId,
        details: `Approved account for ${user.email} with role "${role}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("approveAccount error:", err);
    return { success: false, error: "Failed to approve account" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

export async function rejectAccountAction(userId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_users");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }
    if (user.status !== "pending") {
      return { success: false, error: "User is not in pending status" };
    }

    await prisma.user.delete({ where: { id: userId } });

    await prisma.auditLog.create({
      data: {
        action: "REJECT",
        entity: "User",
        entityId: userId,
        details: `Rejected account request for ${user.email}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("rejectAccount error:", err);
    return { success: false, error: "Failed to reject account" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

export async function createAdminUserAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_users");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = {
    email: (formData.get("email") as string)?.trim().toLowerCase(),
    password: formData.get("password") as string,
    firstName: (formData.get("firstName") as string)?.trim(),
    lastName: (formData.get("lastName") as string)?.trim(),
    role: formData.get("role") as string,
  };

  const parsed = CreateAdminUserSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { email, password, firstName, lastName, role } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "An account with this email already exists" };
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        status: "active", // pre-approved
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        details: `Created admin user ${email} with role "${role}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createAdminUser error:", err);
    return { success: false, error: "Failed to create admin user" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

export async function updateAdminUserAction(
  userId: string,
  data: { role?: UserRole; status?: "active" | "disabled" }
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_users");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  // Prevent editing own account
  if (userId === session.userId) {
    return { success: false, error: "You cannot modify your own account" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Prevent disabling the last admin
    if (user.role === "admin" && (data.role !== "admin" || data.status === "disabled")) {
      const superAdminCount = await prisma.user.count({
        where: { role: "admin", status: "active" },
      });
      if (superAdminCount <= 1) {
        return {
          success: false,
          error: "Cannot remove the last active super admin",
        };
      }
    }

    const updateData: Record<string, string | object> = {};
    const changes: string[] = [];
    let shouldInvalidateSessions = false;

    if (data.role && data.role !== user.role) {
      updateData.role = data.role;
      changes.push(`role: ${user.role} → ${data.role}`);
      shouldInvalidateSessions = true; // role embedded in JWT
    }
    if (data.status && data.status !== user.status) {
      updateData.status = data.status;
      changes.push(`status: ${user.status} → ${data.status}`);
      if (data.status === "disabled") {
        shouldInvalidateSessions = true;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true };
    }

    // Increment sessionVersion to invalidate active sessions when role/status changes
    if (shouldInvalidateSessions) {
      updateData.sessionVersion = { increment: 1 };
      changes.push("sessions invalidated");
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    const auditChanges = computeChanges(
      { role: user.role, status: user.status },
      { role: data.role ?? user.role, status: data.status ?? user.status },
    );

    await createAuditLog({
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      details: `Updated admin user ${user.email}: ${changes.join(", ")}`,
      changes: auditChanges ?? undefined,
      actorId: session.userId,
      actorType: "user",
    });
  } catch (err) {
    console.error("updateAdminUser error:", err);
    return { success: false, error: "Failed to update admin user" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteAdminUserAction(userId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_users");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  // Prevent deleting self
  if (userId === session.userId) {
    return { success: false, error: "You cannot delete your own account" };
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Prevent deleting the last admin
    if (user.role === "admin") {
      const superAdminCount = await prisma.user.count({
        where: { role: "admin", status: "active" },
      });
      if (superAdminCount <= 1) {
        return {
          success: false,
          error: "Cannot delete the last super admin",
        };
      }
    }

    await prisma.user.delete({ where: { id: userId } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "User",
        entityId: userId,
        details: `Deleted admin user ${user.email}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteAdminUser error:", err);
    return { success: false, error: "Failed to delete admin user" };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Change own password
// ---------------------------------------------------------------------------

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  const strengthResult = validatePasswordStrength(newPassword);
  if (!strengthResult.valid) {
    return { success: false, error: strengthResult.errors.join(". ") };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return { success: false, error: "Current password is incorrect" };
    }

    const passwordHash = await hashPassword(newPassword);

    // Increment sessionVersion to invalidate all other active sessions,
    // then immediately re-issue a new session for the current user
    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    // Re-issue session with new version so the current user stays logged in
    const newToken = await createSession({
      userId: updated.id,
      email: updated.email,
      role: updated.role as UserRole,
      firstName: updated.firstName,
      lastName: updated.lastName,
      sessionVersion: updated.sessionVersion,
    });
    await setSessionCookie(newToken);

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: session.userId,
        details: `Password changed for ${user.email} (sessions invalidated)`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("changePassword error:", err);
    return { success: false, error: "Failed to change password" };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Log out all other devices
// ---------------------------------------------------------------------------

/**
 * Invalidate all other sessions by incrementing sessionVersion,
 * then re-issue a new session for the current user.
 */
export async function logoutOtherDevicesAction(): Promise<ActionResult> {
  const session = await verifySession();
  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: { sessionVersion: { increment: 1 } },
    });

    // Re-issue session with new version so the current user stays logged in
    const newToken = await createSession({
      userId: updated.id,
      email: updated.email,
      role: updated.role as UserRole,
      firstName: updated.firstName,
      lastName: updated.lastName,
      sessionVersion: updated.sessionVersion,
    });
    await setSessionCookie(newToken);

    await prisma.auditLog.create({
      data: {
        action: "SECURITY",
        entity: "User",
        entityId: session.userId,
        details: `Logged out all other devices for ${updated.email}`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    return { success: true };
  } catch (err) {
    console.error("logoutOtherDevices error:", err);
    return { success: false, error: "Failed to log out other devices" };
  }
}

// ---------------------------------------------------------------------------
// Admin Password Reset (manage_users — admin only)
// ---------------------------------------------------------------------------

export async function adminResetPassword(
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  const session = await verifySession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Not authorized." };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.errors.join(". ") };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
      select: { firstName: true, lastName: true, email: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "SECURITY",
        entity: "User",
        entityId: userId,
        details: `Admin reset password for "${user.firstName} ${user.lastName}" (${user.email}). All active sessions invalidated.`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (err) {
    console.error("adminResetPassword error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to reset password: ${msg.slice(0, 200)}` };
  }
}
