import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiError, apiNotFound, apiBadRequest, apiServerError } from "@/lib/api-response";

describe("apiError", () => {
  it("returns a response with the specified status code", () => {
    const res = apiError("fail", 500);
    expect(res.status).toBe(500);
  });

  it("returns the error message in the response body", async () => {
    const res = apiError("something broke", 500);
    const body = await res.json();
    expect(body).toEqual({ error: "something broke" });
  });

  it("defaults to status 500", () => {
    const res = apiError("fail");
    expect(res.status).toBe(500);
  });

  it("supports custom status codes", () => {
    const res = apiError("unauthorized", 401);
    expect(res.status).toBe(401);
  });
});

describe("apiNotFound", () => {
  it("returns 404 with default entity name", async () => {
    const res = apiNotFound();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "Resource not found" });
  });

  it("returns 404 with custom entity name", async () => {
    const res = apiNotFound("User");
    const body = await res.json();
    expect(body).toEqual({ error: "User not found" });
  });
});

describe("apiBadRequest", () => {
  it("returns 400 with default message", async () => {
    const res = apiBadRequest();
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid request" });
  });

  it("returns 400 with custom message", async () => {
    const res = apiBadRequest("Missing email field");
    const body = await res.json();
    expect(body).toEqual({ error: "Missing email field" });
  });
});

describe("apiServerError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("logs the error via console.error", () => {
    const err = new Error("db failed");
    apiServerError("fetch users", err);
    expect(console.error).toHaveBeenCalledWith("fetch users error:", err);
  });

  it("returns 500 with an auto-generated message from context", async () => {
    const res = apiServerError("fetch users", new Error("db"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Failed to fetch users" });
  });

  it("uses a custom fallback message when provided", async () => {
    const res = apiServerError("fetch users", new Error("db"), "Custom error");
    const body = await res.json();
    expect(body).toEqual({ error: "Custom error" });
  });
});
