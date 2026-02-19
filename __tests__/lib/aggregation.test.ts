import { describe, it, expect } from "vitest";
import {
  aggregateValues,
  aggregateByPeriod,
  aggregateByPeriodWeighted,
  aggregateValuesWeighted,
  type AggregationType,
  type WeightedEntry,
} from "@/lib/aggregation";

// ---------------------------------------------------------------------------
// aggregateValues
// ---------------------------------------------------------------------------

describe("aggregateValues", () => {
  it("returns null for an empty array", () => {
    const types: AggregationType[] = ["sum", "average", "min", "max", "latest"];
    for (const t of types) {
      expect(aggregateValues([], t)).toBeNull();
    }
  });

  it("calculates sum correctly", () => {
    expect(aggregateValues([1, 2, 3], "sum")).toBe(6);
  });

  it("calculates average correctly", () => {
    expect(aggregateValues([10, 20, 30], "average")).toBe(20);
  });

  it("finds the minimum value", () => {
    expect(aggregateValues([5, 3, 8], "min")).toBe(3);
  });

  it("finds the maximum value", () => {
    expect(aggregateValues([5, 3, 8], "max")).toBe(8);
  });

  it("returns the latest (last) value", () => {
    expect(aggregateValues([1, 2, 3], "latest")).toBe(3);
  });

  it("handles a single value for all types", () => {
    const types: AggregationType[] = ["sum", "average", "min", "max", "latest"];
    for (const t of types) {
      expect(aggregateValues([42], t)).toBe(42);
    }
  });

  it("rounds to 6 decimal places", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in floating point
    const result = aggregateValues([0.1, 0.2], "sum");
    expect(result).toBe(0.3);
  });

  it("handles negative values", () => {
    expect(aggregateValues([-5, 10, -3], "sum")).toBe(2);
    expect(aggregateValues([-5, 10, -3], "min")).toBe(-5);
    expect(aggregateValues([-5, 10, -3], "max")).toBe(10);
  });

  it("falls back to average for unknown aggregation type", () => {
    // TypeScript won't let us pass an invalid type, but the runtime fallback exists
    const result = aggregateValues([10, 20, 30], "something" as AggregationType);
    expect(result).toBe(20); // average
  });
});

// ---------------------------------------------------------------------------
// aggregateByPeriod
// ---------------------------------------------------------------------------

describe("aggregateByPeriod", () => {
  const makeEntry = (dateStr: string, value: number) => ({
    periodStart: new Date(dateStr),
    value,
  });

  it("returns empty array for no entries", () => {
    expect(aggregateByPeriod([], "sum")).toEqual([]);
  });

  it("returns a single period unchanged", () => {
    const entries = [makeEntry("2025-01-01T00:00:00Z", 10)];
    const result = aggregateByPeriod(entries, "sum");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(10);
  });

  it("groups entries with the same periodStart", () => {
    const entries = [makeEntry("2025-01-01T00:00:00Z", 10), makeEntry("2025-01-01T00:00:00Z", 20)];
    const result = aggregateByPeriod(entries, "sum");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(30);
  });

  it("averages entries within the same period", () => {
    const entries = [makeEntry("2025-01-01T00:00:00Z", 10), makeEntry("2025-01-01T00:00:00Z", 20)];
    const result = aggregateByPeriod(entries, "average");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(15);
  });

  it("keeps different periods separate and sorted", () => {
    const entries = [
      makeEntry("2025-03-01T00:00:00Z", 30),
      makeEntry("2025-01-01T00:00:00Z", 10),
      makeEntry("2025-02-01T00:00:00Z", 20),
    ];
    const result = aggregateByPeriod(entries, "latest");
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(10); // Jan
    expect(result[1].value).toBe(20); // Feb
    expect(result[2].value).toBe(30); // Mar
  });

  it("handles mixed — multiple entries across multiple periods", () => {
    const entries = [
      makeEntry("2025-01-01T00:00:00Z", 10),
      makeEntry("2025-01-01T00:00:00Z", 20),
      makeEntry("2025-02-01T00:00:00Z", 30),
      makeEntry("2025-02-01T00:00:00Z", 40),
    ];
    const result = aggregateByPeriod(entries, "sum");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(30); // 10 + 20
    expect(result[1].value).toBe(70); // 30 + 40
  });
});

// ---------------------------------------------------------------------------
// aggregateByPeriodWeighted
// ---------------------------------------------------------------------------

describe("aggregateByPeriodWeighted", () => {
  const makeWeighted = (
    dateStr: string,
    value: number,
    numerator: number | null,
    denominator: number | null
  ): WeightedEntry => ({
    periodStart: new Date(dateStr),
    value,
    numerator,
    denominator,
  });

  it("delegates to aggregateByPeriod for continuous data", () => {
    const entries = [
      makeWeighted("2025-01-01T00:00:00Z", 10, 1, 10),
      makeWeighted("2025-01-01T00:00:00Z", 20, 2, 10),
    ];
    // For continuous, N/D should be ignored, standard sum used
    const result = aggregateByPeriodWeighted(entries, "continuous", "sum");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(30); // 10 + 20, not weighted
  });

  it("calculates weighted proportion (×100)", () => {
    const entries = [
      makeWeighted("2025-01-01T00:00:00Z", 50, 5, 10),
      makeWeighted("2025-01-01T00:00:00Z", 80, 8, 10),
    ];
    const result = aggregateByPeriodWeighted(entries, "proportion", "average");
    expect(result).toHaveLength(1);
    // Weighted: (5+8) / (10+10) * 100 = 65%
    expect(result[0].value).toBe(65);
  });

  it("calculates weighted rate (raw, no ×100)", () => {
    const entries = [
      makeWeighted("2025-01-01T00:00:00Z", 0.05, 5, 100),
      makeWeighted("2025-01-01T00:00:00Z", 0.1, 10, 100),
    ];
    const result = aggregateByPeriodWeighted(entries, "rate", "average");
    expect(result).toHaveLength(1);
    // Weighted: (5+10) / (100+100) = 0.075
    expect(result[0].value).toBe(0.075);
  });

  it("falls back to standard aggregation when N/D is null", () => {
    const entries = [
      makeWeighted("2025-01-01T00:00:00Z", 50, null, null),
      makeWeighted("2025-01-01T00:00:00Z", 80, null, null),
    ];
    const result = aggregateByPeriodWeighted(entries, "proportion", "average");
    expect(result).toHaveLength(1);
    // Standard average fallback: (50 + 80) / 2 = 65
    expect(result[0].value).toBe(65);
  });

  it("falls back when total denominator is zero", () => {
    const entries = [
      makeWeighted("2025-01-01T00:00:00Z", 50, 5, 0),
      makeWeighted("2025-01-01T00:00:00Z", 80, 8, 0),
    ];
    const result = aggregateByPeriodWeighted(entries, "proportion", "average");
    expect(result).toHaveLength(1);
    // Denominator is 0, should fallback to standard average
    expect(result[0].value).toBe(65);
  });

  it("handles multiple periods independently", () => {
    const entries = [
      makeWeighted("2025-01-01T00:00:00Z", 90, 9, 10),
      makeWeighted("2025-02-01T00:00:00Z", 80, 8, 10),
    ];
    const result = aggregateByPeriodWeighted(entries, "proportion", "average");
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(90); // 9/10 * 100
    expect(result[1].value).toBe(80); // 8/10 * 100
  });

  it("returns empty array for empty input", () => {
    expect(aggregateByPeriodWeighted([], "proportion", "average")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// aggregateValuesWeighted
// ---------------------------------------------------------------------------

describe("aggregateValuesWeighted", () => {
  const makeEntry = (value: number, numerator: number | null, denominator: number | null) => ({
    value,
    numerator,
    denominator,
  });

  it("returns null for empty entries", () => {
    expect(aggregateValuesWeighted([], "proportion", "average")).toBeNull();
  });

  it("uses standard aggregation for continuous data", () => {
    const entries = [makeEntry(10, 1, 10), makeEntry(20, 2, 10)];
    const result = aggregateValuesWeighted(entries, "continuous", "sum");
    expect(result).toBe(30); // ignores N/D
  });

  it("calculates weighted proportion", () => {
    const entries = [makeEntry(50, 5, 10), makeEntry(80, 8, 10)];
    const result = aggregateValuesWeighted(entries, "proportion", "average");
    // (5+8)/(10+10)*100 = 65
    expect(result).toBe(65);
  });

  it("calculates weighted rate", () => {
    const entries = [makeEntry(0.05, 5, 100), makeEntry(0.1, 10, 100)];
    const result = aggregateValuesWeighted(entries, "rate", "average");
    // (5+10)/(100+100) = 0.075
    expect(result).toBe(0.075);
  });

  it("falls back to standard aggregation when N/D is null", () => {
    const entries = [makeEntry(50, null, null), makeEntry(80, null, null)];
    const result = aggregateValuesWeighted(entries, "proportion", "average");
    expect(result).toBe(65); // standard average
  });

  it("falls back when denominator sums to zero", () => {
    const entries = [makeEntry(50, 5, 0), makeEntry(80, 8, 0)];
    const result = aggregateValuesWeighted(entries, "proportion", "average");
    expect(result).toBe(65); // standard average fallback
  });

  it("handles mixed N/D (some null, some not)", () => {
    const entries = [
      makeEntry(50, 5, 10), // has N/D
      makeEntry(80, null, null), // no N/D — value still collected for fallback
    ];
    const result = aggregateValuesWeighted(entries, "proportion", "average");
    // Has at least one N/D entry: weighted = 5/10 * 100 = 50
    // But only the entry with N/D contributes to the weighted calc
    expect(result).toBe(50);
  });
});
