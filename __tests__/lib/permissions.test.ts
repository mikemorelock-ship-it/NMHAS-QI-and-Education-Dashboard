import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAdminPermission,
  hasFtoPermission,
  PERMISSIONS,
  USER_ROLES,
  ROLE_LABELS,
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  type UserRole,
  type Permission,
} from "@/lib/permissions";

// ---------------------------------------------------------------------------
// hasPermission — admin role (should have ALL permissions)
// ---------------------------------------------------------------------------

describe("hasPermission", () => {
  describe("admin role", () => {
    it("has access to every permission", () => {
      const allPermissions = Object.keys(PERMISSIONS) as Permission[];
      for (const perm of allPermissions) {
        expect(hasPermission("admin", perm)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Admin panel permissions — role-specific grants
  // -------------------------------------------------------------------------

  describe("admin panel permissions", () => {
    it("data_entry can enter_metric_data", () => {
      expect(hasPermission("data_entry", "enter_metric_data")).toBe(true);
    });

    it("data_entry can upload_batch_data", () => {
      expect(hasPermission("data_entry", "upload_batch_data")).toBe(true);
    });

    it("manager can manage_ftos_trainees", () => {
      expect(hasPermission("manager", "manage_ftos_trainees")).toBe(true);
    });

    it("manager can manage_dors_skills", () => {
      expect(hasPermission("manager", "manage_dors_skills")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Admin panel permissions — role-specific denials
  // -------------------------------------------------------------------------

  describe("admin panel denials", () => {
    it("data_entry cannot manage_users", () => {
      expect(hasPermission("data_entry", "manage_users")).toBe(false);
    });

    it("data_entry cannot manage_departments", () => {
      expect(hasPermission("data_entry", "manage_departments")).toBe(false);
    });

    it("data_entry cannot manage_metric_defs", () => {
      expect(hasPermission("data_entry", "manage_metric_defs")).toBe(false);
    });

    it("manager cannot manage_users", () => {
      expect(hasPermission("manager", "manage_users")).toBe(false);
    });

    it("manager cannot enter_metric_data", () => {
      expect(hasPermission("manager", "enter_metric_data")).toBe(false);
    });

    it("fto cannot manage_users", () => {
      expect(hasPermission("fto", "manage_users")).toBe(false);
    });

    it("trainee cannot manage_users", () => {
      expect(hasPermission("trainee", "manage_users")).toBe(false);
    });

    it("supervisor cannot enter_metric_data", () => {
      expect(hasPermission("supervisor", "enter_metric_data")).toBe(false);
    });

    it("supervisor cannot manage_metric_defs", () => {
      expect(hasPermission("supervisor", "manage_metric_defs")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Dashboard / admin view access
  // -------------------------------------------------------------------------

  describe("dashboard access", () => {
    const dashboardRoles: UserRole[] = ["admin", "manager", "data_entry"];
    const noDashboardRoles: UserRole[] = ["supervisor", "fto", "trainee"];

    for (const role of dashboardRoles) {
      it(`${role} can view_dashboard`, () => {
        expect(hasPermission(role, "view_dashboard")).toBe(true);
      });
      it(`${role} can view_admin`, () => {
        expect(hasPermission(role, "view_admin")).toBe(true);
      });
    }

    for (const role of noDashboardRoles) {
      it(`${role} cannot view_dashboard`, () => {
        expect(hasPermission(role, "view_dashboard")).toBe(false);
      });
      it(`${role} cannot view_admin`, () => {
        expect(hasPermission(role, "view_admin")).toBe(false);
      });
    }
  });

  // -------------------------------------------------------------------------
  // Field training permissions
  // -------------------------------------------------------------------------

  describe("field training permissions", () => {
    it("fto can create_edit_own_dors", () => {
      expect(hasPermission("fto", "create_edit_own_dors")).toBe(true);
    });

    it("fto can view_own_trainees", () => {
      expect(hasPermission("fto", "view_own_trainees")).toBe(true);
    });

    it("fto can access_field_training", () => {
      expect(hasPermission("fto", "access_field_training")).toBe(true);
    });

    it("trainee can access_field_training", () => {
      expect(hasPermission("trainee", "access_field_training")).toBe(true);
    });

    it("trainee cannot create_edit_own_dors", () => {
      expect(hasPermission("trainee", "create_edit_own_dors")).toBe(false);
    });

    it("trainee cannot review_approve_dors", () => {
      expect(hasPermission("trainee", "review_approve_dors")).toBe(false);
    });

    it("fto cannot review_approve_dors", () => {
      expect(hasPermission("fto", "review_approve_dors")).toBe(false);
    });

    it("fto cannot signoff_phases", () => {
      expect(hasPermission("fto", "signoff_phases")).toBe(false);
    });

    it("supervisor can review_approve_dors", () => {
      expect(hasPermission("supervisor", "review_approve_dors")).toBe(true);
    });

    it("supervisor can manage_training_assignments", () => {
      expect(hasPermission("supervisor", "manage_training_assignments")).toBe(true);
    });

    it("supervisor can signoff_phases", () => {
      expect(hasPermission("supervisor", "signoff_phases")).toBe(true);
    });

    it("manager can manage_training_assignments", () => {
      expect(hasPermission("manager", "manage_training_assignments")).toBe(true);
    });

    it("fto cannot manage_training_assignments", () => {
      expect(hasPermission("fto", "manage_training_assignments")).toBe(false);
    });

    it("trainee cannot manage_training_assignments", () => {
      expect(hasPermission("trainee", "manage_training_assignments")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Backward-compatible aliases
// ---------------------------------------------------------------------------

describe("backward-compatible aliases", () => {
  it("hasAdminPermission is the same function as hasPermission", () => {
    expect(hasAdminPermission).toBe(hasPermission);
  });

  it("hasFtoPermission is the same function as hasPermission", () => {
    expect(hasFtoPermission).toBe(hasPermission);
  });

  it("ADMIN_ROLES is the same array as USER_ROLES", () => {
    expect(ADMIN_ROLES).toBe(USER_ROLES);
  });

  it("ADMIN_ROLE_LABELS is the same object as ROLE_LABELS", () => {
    expect(ADMIN_ROLE_LABELS).toBe(ROLE_LABELS);
  });
});

// ---------------------------------------------------------------------------
// Constants integrity
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("USER_ROLES has exactly 6 entries", () => {
    expect(USER_ROLES).toHaveLength(6);
  });

  it("USER_ROLES contains all expected roles", () => {
    expect(USER_ROLES).toContain("admin");
    expect(USER_ROLES).toContain("manager");
    expect(USER_ROLES).toContain("data_entry");
    expect(USER_ROLES).toContain("supervisor");
    expect(USER_ROLES).toContain("fto");
    expect(USER_ROLES).toContain("trainee");
  });

  it("ROLE_LABELS has a label for every role", () => {
    for (const role of USER_ROLES) {
      expect(ROLE_LABELS[role]).toBeDefined();
      expect(typeof ROLE_LABELS[role]).toBe("string");
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it("every role in every permission array is a valid UserRole", () => {
    const validRoles = new Set(USER_ROLES);
    for (const [, roles] of Object.entries(PERMISSIONS)) {
      for (const role of roles) {
        expect(validRoles.has(role as UserRole)).toBe(true);
      }
    }
  });
});
