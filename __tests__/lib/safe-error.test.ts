import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleActionError, isUniqueConstraintError } from "@/lib/safe-error";

describe("handleActionError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the default fallback message for a generic error", () => {
    const result = handleActionError("test", new Error("db broke"));
    expect(result).toBe("An unexpected error occurred.");
  });

  it("returns a custom fallback message when provided", () => {
    const result = handleActionError("test", new Error("db broke"), "Custom msg");
    expect(result).toBe("Custom msg");
  });

  it("returns a friendly message for Prisma unique constraint errors", () => {
    const result = handleActionError(
      "test",
      new Error("Unique constraint failed on field `email`")
    );
    expect(result).toContain("already exists");
  });

  it("handles non-Error values gracefully", () => {
    const result = handleActionError("test", "string error");
    expect(result).toBe("An unexpected error occurred.");
  });

  it("logs the error with the context prefix", () => {
    const err = new Error("some problem");
    handleActionError("createUser", err);
    expect(console.error).toHaveBeenCalledWith("createUser error:", err);
  });
});

describe("isUniqueConstraintError", () => {
  it("returns true for a unique constraint Error", () => {
    expect(isUniqueConstraintError(new Error("Unique constraint failed on field"))).toBe(true);
  });

  it("returns false for a generic Error", () => {
    expect(isUniqueConstraintError(new Error("Some other error"))).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isUniqueConstraintError("not an error")).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
    expect(isUniqueConstraintError(42)).toBe(false);
  });
});
