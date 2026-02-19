import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, subMonths, startOfMonth } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMetricValue(
  value: number,
  unit: string,
  rateMultiplier?: number | null,
  rateSuffix?: string | null
): string {
  switch (unit) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "duration":
      return `${value.toFixed(1)} min`;
    case "score":
      return `${value.toFixed(1)}/10`;
    case "count":
      return new Intl.NumberFormat("en-US").format(Math.round(value));
    case "rate": {
      const displayValue = rateMultiplier ? value * rateMultiplier : value;
      const formatted = displayValue.toFixed(1);
      return rateSuffix ? `${formatted} ${rateSuffix}` : formatted;
    }
    default:
      return value.toFixed(1);
  }
}

/**
 * Adjust a Date so that date-fns `format()` (which uses local TZ)
 * renders the UTC date/month correctly.  Prevents the classic
 * "Jan 1 00:00 UTC → Dec 31 in US timezones" display bug.
 */
export function toUTCDate(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
}

export function formatPeriod(date: Date | string, periodType?: string): string {
  const utcAdjusted = toUTCDate(date);
  // For sub-monthly period types, show the full date
  if (periodType === "daily" || periodType === "weekly" || periodType === "bi-weekly") {
    return format(utcAdjusted, "MMM d, yyyy");
  }
  return format(utcAdjusted, "MMM yyyy");
}

export function calculateTrend(
  current: number,
  previous: number
): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { value: 0, direction: "flat" };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    direction: change > 0.5 ? "up" : change < -0.5 ? "down" : "flat",
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Parses a range query string into a Prisma-compatible date filter object.
 *
 * Supports:
 *  - Presets: "1mo", "3mo", "6mo", "1yr", "ytd", "all"
 *  - Custom ranges: "custom:YYYY-MM-DD:YYYY-MM-DD"
 *
 * Returns `{}` for "all" (no filter), or `{ gte: Date }` for presets,
 * or `{ gte: Date, lte: Date }` for custom ranges.
 */
export function parseDateRangeFilter(range: string): {
  gte?: Date;
  lte?: Date;
} {
  // Custom range: "custom:2025-01-01:2025-06-30"
  if (range.startsWith("custom:")) {
    const parts = range.split(":");
    if (parts.length === 3) {
      const from = new Date(parts[1] + "T00:00:00");
      const to = new Date(parts[2] + "T23:59:59");
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        return { gte: from, lte: to };
      }
    }
    // Fallback if parsing fails
    return {};
  }

  // Preset ranges
  const now = new Date();
  switch (range) {
    case "1mo":
      return { gte: startOfMonth(subMonths(now, 1)) };
    case "3mo":
      return { gte: startOfMonth(subMonths(now, 3)) };
    case "6mo":
      return { gte: startOfMonth(subMonths(now, 6)) };
    case "1yr":
      return { gte: startOfMonth(subMonths(now, 12)) };
    case "ytd":
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case "all":
    default:
      return {};
  }
}
