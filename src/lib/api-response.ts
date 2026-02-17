import { NextResponse } from "next/server";

/**
 * Standardized API response helpers.
 *
 * All API routes should use these helpers for consistent error shapes.
 * Success responses remain flexible (each endpoint returns its own shape),
 * but error responses are standardized to `{ error: string }` with proper
 * HTTP status codes.
 */

/** Return a JSON error response with the given status code. */
export function apiError(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status });
}

/** Return a 404 "not found" JSON error. */
export function apiNotFound(entity = "Resource") {
  return apiError(`${entity} not found`, 404);
}

/** Return a 400 "bad request" JSON error. */
export function apiBadRequest(message = "Invalid request") {
  return apiError(message, 400);
}

/**
 * Log an error server-side and return a generic 500 JSON response.
 * This is the API route equivalent of `handleActionError` from safe-error.ts.
 */
export function apiServerError(context: string, err: unknown, fallback?: string) {
  console.error(`${context} error:`, err);
  return apiError(fallback ?? `Failed to ${context.toLowerCase()}`);
}
