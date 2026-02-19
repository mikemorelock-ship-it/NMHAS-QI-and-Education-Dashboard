/**
 * Shared aggregation utilities for rolling up department-level data
 * to division-level scores.
 */

export type AggregationType = "sum" | "average" | "min" | "max" | "latest";

/**
 * The dataType from the metric definition, used to decide between
 * weighted vs simple aggregation.
 */
export type MetricDataType = "proportion" | "rate" | "continuous";

/**
 * An entry with optional numerator/denominator for weighted aggregation.
 */
export interface WeightedEntry {
  periodStart: Date;
  value: number;
  numerator: number | null;
  denominator: number | null;
}

/**
 * Aggregate an array of numeric values using the specified method.
 *
 * Returns `null` if the values array is empty — missing data ≠ zero.
 * Only departments that actually have data contribute to the result
 * (partial data is OK — we don't include zeros for missing departments).
 *
 * Results are rounded to 6 decimal places.
 */
export function aggregateValues(values: number[], aggregationType: AggregationType): number | null {
  if (values.length === 0) return null;

  switch (aggregationType) {
    case "sum":
      return round2(values.reduce((a, b) => a + b, 0));
    case "average":
      return round2(values.reduce((a, b) => a + b, 0) / values.length);
    case "min":
      return round2(Math.min(...values));
    case "max":
      return round2(Math.max(...values));
    case "latest":
      // Assumes values are in chronological order
      return round2(values[values.length - 1]);
    default:
      // Fallback to average
      return round2(values.reduce((a, b) => a + b, 0) / values.length);
  }
}

/**
 * Group an array of entries by period, then aggregate each period's values.
 *
 * Returns a sorted array of { periodStart, value } objects.
 */
export function aggregateByPeriod<T extends { periodStart: Date; value: number }>(
  entries: T[],
  aggregationType: AggregationType
): { periodStart: Date; value: number }[] {
  const byPeriod = new Map<string, { date: Date; values: number[] }>();

  for (const entry of entries) {
    const key = entry.periodStart.toISOString();
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { date: entry.periodStart, values: [] });
    }
    byPeriod.get(key)!.values.push(entry.value);
  }

  return Array.from(byPeriod.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, values }) => ({
      periodStart: date,
      value: aggregateValues(values, aggregationType) ?? 0,
    }));
}

/**
 * Weighted aggregation for rate/proportion metrics.
 *
 * For rate and proportion metrics, averaging the pre-computed values
 * gives equal weight to every department regardless of their exposure
 * (denominator). This is the "average of averages" problem.
 *
 * The correct approach is:
 *   weighted_rate = sum(numerators) / sum(denominators)
 *
 * For proportion metrics: result = (sum_num / sum_den) * 100  (percentage)
 * For rate metrics: result = sum_num / sum_den  (raw rate, multiplied later for display)
 *
 * If N/D data is not available for entries in a period, falls back to
 * the standard aggregation method (simple average).
 *
 * @param entries - Array of entries with periodStart, value, numerator, denominator
 * @param dataType - The metric's dataType: "proportion", "rate", or "continuous"
 * @param aggregationType - Fallback aggregation method when N/D data is unavailable
 * @returns Sorted array of { periodStart, value } objects
 */
export function aggregateByPeriodWeighted(
  entries: WeightedEntry[],
  dataType: MetricDataType,
  aggregationType: AggregationType
): { periodStart: Date; value: number }[] {
  // For continuous metrics, no weighted aggregation needed
  if (dataType === "continuous") {
    return aggregateByPeriod(entries, aggregationType);
  }

  const byPeriod = new Map<
    string,
    {
      date: Date;
      totalNum: number;
      totalDen: number;
      hasND: boolean;
      values: number[];
    }
  >();

  for (const entry of entries) {
    const key = entry.periodStart.toISOString();
    if (!byPeriod.has(key)) {
      byPeriod.set(key, {
        date: entry.periodStart,
        totalNum: 0,
        totalDen: 0,
        hasND: false,
        values: [],
      });
    }
    const bucket = byPeriod.get(key)!;

    if (entry.numerator != null && entry.denominator != null) {
      bucket.totalNum += entry.numerator;
      bucket.totalDen += entry.denominator;
      bucket.hasND = true;
    }
    // Always collect values for fallback
    bucket.values.push(entry.value);
  }

  return Array.from(byPeriod.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => {
      // Use weighted aggregation if we have N/D data and denominator > 0
      if (bucket.hasND && bucket.totalDen > 0) {
        const rawRate = bucket.totalNum / bucket.totalDen;
        // For proportion: store as percentage. For rate: store raw (multiplier applied at display).
        const value = dataType === "proportion" ? rawRate * 100 : rawRate;
        return { periodStart: bucket.date, value: round2(value) };
      }

      // Fallback: use standard aggregation on pre-computed values
      return {
        periodStart: bucket.date,
        value: aggregateValues(bucket.values, aggregationType) ?? 0,
      };
    });
}

/**
 * Weighted aggregation for a flat array of values within a single period.
 *
 * Used by the scorecard where entries are already grouped by metric+month.
 * Returns the weighted rate/proportion if N/D data is available, otherwise
 * falls back to standard aggregation.
 *
 * @param entries - Array of entries with value, numerator, denominator
 * @param dataType - The metric's dataType
 * @param aggregationType - Fallback aggregation method
 * @returns Aggregated value or null if no entries
 */
export function aggregateValuesWeighted(
  entries: Array<{ value: number; numerator: number | null; denominator: number | null }>,
  dataType: MetricDataType,
  aggregationType: AggregationType
): number | null {
  if (entries.length === 0) return null;

  // For continuous metrics, use standard aggregation
  if (dataType === "continuous") {
    return aggregateValues(
      entries.map((e) => e.value),
      aggregationType
    );
  }

  // Try weighted aggregation with N/D data
  let totalNum = 0;
  let totalDen = 0;
  let hasND = false;

  for (const entry of entries) {
    if (entry.numerator != null && entry.denominator != null) {
      totalNum += entry.numerator;
      totalDen += entry.denominator;
      hasND = true;
    }
  }

  if (hasND && totalDen > 0) {
    const rawRate = totalNum / totalDen;
    const value = dataType === "proportion" ? rawRate * 100 : rawRate;
    return round2(value);
  }

  // Fallback: standard aggregation on pre-computed values
  return aggregateValues(
    entries.map((e) => e.value),
    aggregationType
  );
}

/**
 * Round to 6 decimal places to preserve precision for rate metrics
 * that store very small raw values (e.g., 0.0000264 = 2.64 per 100K).
 * Display formatting in formatMetricValue handles final user-facing rounding.
 */
function round2(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
