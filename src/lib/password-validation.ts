// ---------------------------------------------------------------------------
// Password Strength Validation
//
// Enforces password requirements for new passwords and registrations.
// Existing passwords are NOT affected — only new/changed passwords.
// ---------------------------------------------------------------------------

export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength against requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export function validatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Must include at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Must include at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Must include at least one number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Must include at least one special character");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Zod-compatible refinement for password strength.
 * Usage: `z.string().refine(isStrongPassword, { message: "..." })`
 */
export function isStrongPassword(password: string): boolean {
  return validatePasswordStrength(password).valid;
}

/** Human-readable description of password requirements */
export const PASSWORD_REQUIREMENTS =
  "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";
