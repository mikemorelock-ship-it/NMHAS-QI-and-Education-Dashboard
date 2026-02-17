/**
 * Safe error handling utilities.
 *
 * All server actions and API routes should use these helpers to ensure
 * error details are only logged server-side and never leaked to the client.
 */

/**
 * Log an error server-side and return a generic message for the client.
 * Handles Prisma unique constraint violations with a friendly message.
 */
export function handleActionError(
  context: string,
  err: unknown,
  fallback = "An unexpected error occurred."
): string {
  console.error(`${context} error:`, err);

  // Prisma unique constraint — return a helpful but non-leaky message
  if (err instanceof Error && err.message.includes("Unique constraint")) {
    return "A record with that value already exists. Please use a different value.";
  }

  return fallback;
}

/**
 * Type guard to check if an error is a Prisma unique constraint violation.
 * Use when you want to provide a context-specific message for duplicates.
 */
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Unique constraint");
}
