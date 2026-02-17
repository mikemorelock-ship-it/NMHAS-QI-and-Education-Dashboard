import { verifySession, type Session } from "./auth";
import {
  hasPermission,
  type Permission,
} from "./permissions";

// ---------------------------------------------------------------------------
// Unified auth guards — for use in server actions
// ---------------------------------------------------------------------------

/**
 * Require an authenticated user with a specific permission.
 * Throws if not authenticated or lacks the required permission.
 */
export async function requirePermission(
  permission: Permission
): Promise<Session> {
  const session = await verifySession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  if (!hasPermission(session.role, permission)) {
    throw new Error("Insufficient permissions");
  }
  return session;
}

// Keep old function name as alias for backwards compatibility
export const requireAdmin = requirePermission;

/**
 * Require any authenticated user (no specific permission check).
 * Use for pages where all authenticated users have access.
 */
export async function requireAuth(): Promise<Session> {
  const session = await verifySession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session;
}

// Keep old function name as alias
export const requireAdminSession = requireAuth;
