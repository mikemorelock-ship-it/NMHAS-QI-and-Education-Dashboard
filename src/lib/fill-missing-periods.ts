import { parse, eachMonthOfInterval, format } from "date-fns";
import type { ChartDataPoint } from "@/types";

/**
 * Ensures all months between the first and last data point are represented.
 *
 * Missing months are filled using **Last Observation Carried Forward (LOCF)**:
 * the previous month's value is repeated and the point is marked `isFilled: true`
 * so that chart components can visually distinguish real vs. synthesized data
 * (e.g. hide dots for filled points).
 *
 * Only operates on monthly period strings in "MMM yyyy" format.
 * Non-monthly period types (daily, weekly) are returned unchanged.
 */
export function fillMissingPeriods(data: ChartDataPoint[], periodType?: string): ChartDataPoint[] {
  // Only fill gaps for monthly data (the default period type)
  if (periodType === "daily" || periodType === "weekly" || periodType === "bi-weekly") {
    return data;
  }

  if (data.length < 2) return data;

  // Parse period strings back to dates
  const parsed = data.map((d) => ({
    ...d,
    _date: parse(d.period, "MMM yyyy", new Date()),
  }));

  // Validate all dates parsed correctly
  if (parsed.some((p) => isNaN(p._date.getTime()))) return data;

  const first = parsed[0]._date;
  const last = parsed[parsed.length - 1]._date;

  // Generate every month in the range
  const allMonths = eachMonthOfInterval({ start: first, end: last });

  // Build a lookup from period string → original data point
  const lookup = new Map<string, ChartDataPoint>();
  for (const point of data) {
    lookup.set(point.period, point);
  }

  const result: ChartDataPoint[] = [];
  let lastKnownValue = data[0].value;

  for (const month of allMonths) {
    const periodKey = format(month, "MMM yyyy");
    const existing = lookup.get(periodKey);

    if (existing) {
      result.push({ ...existing, isFilled: false });
      lastKnownValue = existing.value;
    } else {
      // LOCF: carry forward the previous value
      result.push({
        period: periodKey,
        value: lastKnownValue,
        isFilled: true,
      });
    }
  }

  return result;
}
