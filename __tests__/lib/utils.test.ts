import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatMetricValue,
  toUTCDate,
  formatPeriod,
  calculateTrend,
  slugify,
  parseDateRangeFilter,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// formatMetricValue
// ---------------------------------------------------------------------------

describe("formatMetricValue", () => {
  it("formats currency", () => {
    expect(formatMetricValue(1234, "currency")).toBe("$1,234");
  });

  it("rounds currency to whole numbers", () => {
    expect(formatMetricValue(1234.56, "currency")).toBe("$1,235");
  });

  it("formats percentage with one decimal", () => {
    expect(formatMetricValue(95.123, "percentage")).toBe("95.1%");
  });

  it("formats duration with one decimal and min suffix", () => {
    expect(formatMetricValue(12.75, "duration")).toBe("12.8 min");
  });

  it("formats score with one decimal and /10 suffix", () => {
    expect(formatMetricValue(8.33, "score")).toBe("8.3/10");
  });

  it("formats count with comma separators", () => {
    expect(formatMetricValue(10500, "count")).toBe("10,500");
  });

  it("rounds count to whole numbers", () => {
    expect(formatMetricValue(10.7, "count")).toBe("11");
  });

  it("formats rate without multiplier", () => {
    expect(formatMetricValue(0.5, "rate")).toBe("0.5");
  });

  it("formats rate with multiplier and suffix", () => {
    expect(formatMetricValue(0.05, "rate", 1000, "per 1K")).toBe("50.0 per 1K");
  });

  it("formats unknown unit with one decimal", () => {
    expect(formatMetricValue(3.14159, "unknown")).toBe("3.1");
  });

  it("formats zero values", () => {
    expect(formatMetricValue(0, "count")).toBe("0");
    expect(formatMetricValue(0, "percentage")).toBe("0.0%");
  });
});

// ---------------------------------------------------------------------------
// toUTCDate
// ---------------------------------------------------------------------------

describe("toUTCDate", () => {
  it("accepts a Date object", () => {
    const date = new Date("2025-06-15T00:00:00Z");
    const result = toUTCDate(date);
    expect(result).toBeInstanceOf(Date);
  });

  it("accepts an ISO string", () => {
    const result = toUTCDate("2025-06-15T00:00:00Z");
    expect(result).toBeInstanceOf(Date);
  });

  it("adjusts for timezone offset", () => {
    // The function adds timezoneOffset to prevent off-by-one display bugs
    const date = new Date("2025-01-01T00:00:00Z");
    const utc = toUTCDate(date);
    // After adjustment, getMonth/getDate should match the UTC values
    // (This works because toUTCDate shifts the local time to show UTC values)
    expect(utc.getMonth()).toBe(0); // January
  });
});

// ---------------------------------------------------------------------------
// formatPeriod
// ---------------------------------------------------------------------------

describe("formatPeriod", () => {
  it("formats monthly by default (MMM yyyy)", () => {
    const result = formatPeriod("2025-06-15T12:00:00Z");
    expect(result).toMatch(/Jun 2025/);
  });

  it("formats daily with full date (MMM d, yyyy)", () => {
    const result = formatPeriod("2025-06-15T12:00:00Z", "daily");
    expect(result).toMatch(/Jun \d+, 2025/);
  });

  it("formats weekly with full date", () => {
    const result = formatPeriod("2025-06-15T12:00:00Z", "weekly");
    expect(result).toMatch(/Jun \d+, 2025/);
  });

  it("formats bi-weekly with full date", () => {
    const result = formatPeriod("2025-06-15T12:00:00Z", "bi-weekly");
    expect(result).toMatch(/Jun \d+, 2025/);
  });
});

// ---------------------------------------------------------------------------
// calculateTrend
// ---------------------------------------------------------------------------

describe("calculateTrend", () => {
  it("detects an upward trend", () => {
    const result = calculateTrend(110, 100);
    expect(result.direction).toBe("up");
    expect(result.value).toBeCloseTo(10, 0);
  });

  it("detects a downward trend", () => {
    const result = calculateTrend(90, 100);
    expect(result.direction).toBe("down");
    expect(result.value).toBeCloseTo(10, 0);
  });

  it("detects flat when change is within ±0.5%", () => {
    const result = calculateTrend(100.4, 100);
    expect(result.direction).toBe("flat");
  });

  it("returns flat when previous is zero", () => {
    const result = calculateTrend(100, 0);
    expect(result.direction).toBe("flat");
    expect(result.value).toBe(0);
  });

  it("calculates large increases correctly", () => {
    const result = calculateTrend(200, 100);
    expect(result.direction).toBe("up");
    expect(result.value).toBeCloseTo(100, 0);
  });

  it("returns absolute value for percentage change", () => {
    const result = calculateTrend(80, 100);
    expect(result.value).toBeGreaterThan(0);
  });

  it("handles both values being the same", () => {
    const result = calculateTrend(100, 100);
    expect(result.direction).toBe("flat");
    expect(result.value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces special characters with dashes", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("strips leading and trailing dashes", () => {
    expect(slugify(" Hello ")).toBe("hello");
  });

  it("collapses multiple separators into single dash", () => {
    expect(slugify("a   b   c")).toBe("a-b-c");
  });

  it("preserves already clean slugs", () => {
    expect(slugify("hello-world")).toBe("hello-world");
  });

  it("handles numbers", () => {
    expect(slugify("Item 123")).toBe("item-123");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// parseDateRangeFilter
// ---------------------------------------------------------------------------

describe("parseDateRangeFilter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty object for 'all'", () => {
    expect(parseDateRangeFilter("all")).toEqual({});
  });

  it("returns empty object for unknown preset", () => {
    expect(parseDateRangeFilter("unknown")).toEqual({});
  });

  it("returns a gte date for '1mo' preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

    const result = parseDateRangeFilter("1mo");
    expect(result.gte).toBeDefined();
    expect(result.gte).toBeInstanceOf(Date);
    // Should be around May 1, 2025 (start of month, 1 month back)
    expect(result.gte!.getMonth()).toBe(4); // May = 4 (0-indexed)
  });

  it("returns a gte date for '3mo' preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

    const result = parseDateRangeFilter("3mo");
    expect(result.gte).toBeDefined();
    // Should be around March 1, 2025
    expect(result.gte!.getMonth()).toBe(2); // March = 2
  });

  it("returns a gte date for 'ytd' preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

    const result = parseDateRangeFilter("ytd");
    expect(result.gte).toBeDefined();
    expect(result.gte!.getFullYear()).toBe(2025);
    expect(result.gte!.getMonth()).toBe(0); // January
    expect(result.gte!.getDate()).toBe(1);
  });

  it("returns a gte date for '1yr' preset", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));

    const result = parseDateRangeFilter("1yr");
    expect(result.gte).toBeDefined();
    // Should be around June 1, 2024
    expect(result.gte!.getFullYear()).toBe(2024);
  });

  it("parses custom range with gte and lte", () => {
    const result = parseDateRangeFilter("custom:2025-01-01:2025-06-30");
    expect(result.gte).toBeDefined();
    expect(result.lte).toBeDefined();
    expect(result.gte!.getFullYear()).toBe(2025);
    expect(result.gte!.getMonth()).toBe(0); // January
    expect(result.lte!.getMonth()).toBe(5); // June
  });

  it("returns empty object for malformed custom range", () => {
    expect(parseDateRangeFilter("custom:bad")).toEqual({});
  });

  it("returns empty object for custom range with invalid dates", () => {
    expect(parseDateRangeFilter("custom:not-a-date:also-not")).toEqual({});
  });
});
