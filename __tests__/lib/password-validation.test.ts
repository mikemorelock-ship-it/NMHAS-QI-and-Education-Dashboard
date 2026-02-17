import { describe, it, expect } from "vitest";
import {
  validatePasswordStrength,
  isStrongPassword,
  PASSWORD_REQUIREMENTS,
} from "@/lib/password-validation";

describe("validatePasswordStrength", () => {
  // -------------------------------------------------------------------------
  // Valid passwords
  // -------------------------------------------------------------------------

  describe("valid passwords", () => {
    it("accepts a password meeting all requirements", () => {
      const result = validatePasswordStrength("Admin123!");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a complex password", () => {
      const result = validatePasswordStrength("C0mpl3x!Pass");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a minimal valid password (exactly 8 chars)", () => {
      const result = validatePasswordStrength("Aa1!aaaa");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts a very long password", () => {
      const result = validatePasswordStrength("A1!" + "a".repeat(200));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Individual rule failures
  // -------------------------------------------------------------------------

  describe("individual rule failures", () => {
    it("rejects a password that is too short", () => {
      const result = validatePasswordStrength("Aa1!aaa"); // 7 chars
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Must be at least 8 characters");
    });

    it("rejects a password missing uppercase", () => {
      const result = validatePasswordStrength("admin123!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Must include at least one uppercase letter");
      expect(result.errors).toHaveLength(1);
    });

    it("rejects a password missing lowercase", () => {
      const result = validatePasswordStrength("ADMIN123!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Must include at least one lowercase letter");
      expect(result.errors).toHaveLength(1);
    });

    it("rejects a password missing a number", () => {
      const result = validatePasswordStrength("AdminPass!");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Must include at least one number");
      expect(result.errors).toHaveLength(1);
    });

    it("rejects a password missing a special character", () => {
      const result = validatePasswordStrength("Admin1234");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Must include at least one special character");
      expect(result.errors).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple failures
  // -------------------------------------------------------------------------

  describe("multiple failures", () => {
    it("reports all errors for a short lowercase-only string", () => {
      const result = validatePasswordStrength("abc");
      expect(result.valid).toBe(false);
      // Too short + no uppercase + no number + no special char = 4 errors
      expect(result.errors).toHaveLength(4);
    });

    it("reports all errors for an empty string", () => {
      const result = validatePasswordStrength("");
      expect(result.valid).toBe(false);
      // All 5 rules fail
      expect(result.errors).toHaveLength(5);
    });

    it("reports errors for digits-only string", () => {
      const result = validatePasswordStrength("12345678");
      expect(result.valid).toBe(false);
      // Missing uppercase + lowercase + special char = 3 errors
      expect(result.errors).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Boundary cases
  // -------------------------------------------------------------------------

  describe("boundary cases", () => {
    it("rejects 7-char password", () => {
      expect(validatePasswordStrength("Aa1!aaa").valid).toBe(false);
    });

    it("accepts 8-char password", () => {
      expect(validatePasswordStrength("Aa1!aaaa").valid).toBe(true);
    });

    it("treats spaces as special characters", () => {
      const result = validatePasswordStrength("Admin 123");
      expect(result.valid).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// isStrongPassword
// ---------------------------------------------------------------------------

describe("isStrongPassword", () => {
  it("returns true for a valid password", () => {
    expect(isStrongPassword("Admin123!")).toBe(true);
  });

  it("returns false for an invalid password", () => {
    expect(isStrongPassword("weak")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PASSWORD_REQUIREMENTS constant
// ---------------------------------------------------------------------------

describe("PASSWORD_REQUIREMENTS", () => {
  it("is a non-empty string", () => {
    expect(typeof PASSWORD_REQUIREMENTS).toBe("string");
    expect(PASSWORD_REQUIREMENTS.length).toBeGreaterThan(0);
  });

  it("mentions key requirements", () => {
    expect(PASSWORD_REQUIREMENTS).toContain("8");
    expect(PASSWORD_REQUIREMENTS).toContain("uppercase");
    expect(PASSWORD_REQUIREMENTS).toContain("lowercase");
  });
});
