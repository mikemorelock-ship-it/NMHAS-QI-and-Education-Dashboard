// ---------------------------------------------------------------------------
// Central permission definitions — single source of truth for server actions & UI
// Unified role hierarchy: admin > manager > data_entry > supervisor > fto > trainee
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "manager" | "data_entry" | "supervisor" | "fto" | "trainee";

// ---------------------------------------------------------------------------
// Unified permission matrix
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // Admin panel permissions
  manage_users: ["admin"],
  manage_departments: ["admin"],
  manage_metric_defs: ["admin"],
  manage_categories: ["admin"],
  manage_driver_diagrams: ["admin"],
  manage_campaigns: ["admin"],
  manage_action_items: ["admin", "manager"],
  manage_scorecards: ["admin"],
  enter_metric_data: ["admin", "data_entry"],
  upload_batch_data: ["admin", "data_entry"],
  manage_ftos_trainees: ["admin", "manager"],
  manage_dors_skills: ["admin", "manager"],
  export_reports: ["admin", "manager"],
  view_audit_log: ["admin"],

  // Dashboard access
  view_dashboard: ["admin", "manager", "data_entry"],
  view_admin: ["admin", "manager", "data_entry"],

  // Field training permissions
  create_edit_own_dors: ["fto", "supervisor", "manager", "admin"],
  view_own_trainees: ["fto", "supervisor", "manager", "admin"],
  review_approve_dors: ["supervisor", "manager", "admin"],
  view_all_trainees: ["supervisor", "manager", "admin"],
  manage_training_assignments: ["supervisor", "manager", "admin"],
  signoff_phases: ["supervisor", "manager", "admin"],
  access_field_training: ["fto", "supervisor", "manager", "admin", "trainee"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Keep old type names as aliases for backwards compatibility during migration
export type AdminPermission = Permission;
export type AdminRole = UserRole;
export type FtoRole = UserRole;
export type FtoPermission = Permission;

// ---------------------------------------------------------------------------
// Permission check helper
// ---------------------------------------------------------------------------

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// Keep old function names as aliases for backwards compatibility during migration
export const hasAdminPermission = hasPermission;
export const hasFtoPermission = hasPermission;

// ---------------------------------------------------------------------------
// Role display labels
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  manager: "Manager",
  data_entry: "Data Entry",
  supervisor: "Supervisor",
  fto: "FTO",
  trainee: "Trainee",
};

// Keep old name as alias
export const ADMIN_ROLE_LABELS = ROLE_LABELS;

export const USER_ROLES: UserRole[] = [
  "admin",
  "manager",
  "data_entry",
  "supervisor",
  "fto",
  "trainee",
];

// Keep old name as alias
export const ADMIN_ROLES = USER_ROLES;
