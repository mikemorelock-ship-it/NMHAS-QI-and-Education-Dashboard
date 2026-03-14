import {
  startOfMonth,
  subMonths,
  startOfWeek,
  subWeeks,
  startOfQuarter,
  subQuarters,
  startOfYear,
  subYears,
  subDays,
  startOfDay,
} from "date-fns";

/**
 * Determines whether a metric is due for updated data based on its period type
 * and the date of the most recent data entry.
 *
 * A metric is "update due" when the most recently **completed** period has no
 * data entry. For example, a monthly metric checked on March 13 is due if
 * there is no entry with periodStart >= Feb 1 (February is the latest
 * completed month).
 */
export function isMetricUpdateDue(
  periodType: string,
  latestPeriodStart: Date | null,
  now: Date = new Date()
): boolean {
  const expectedPeriodStart = getExpectedPeriodStart(periodType, now);
  if (!expectedPeriodStart) return false;

  if (!latestPeriodStart) return true;

  return latestPeriodStart.getTime() < expectedPeriodStart.getTime();
}

/**
 * Returns the start date of the most recently completed period for the given
 * period type. Returns null for unrecognized period types.
 */
function getExpectedPeriodStart(periodType: string, now: Date): Date | null {
  switch (periodType) {
    case "daily":
      return startOfDay(subDays(now, 1));

    case "weekly":
      // Most recent completed week (Mon–Sun). startOfWeek with weekStartsOn:1
      // gives the Monday of the current week; subtract 1 week for the last
      // completed week.
      return subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1);

    case "bi-weekly":
      // Two weeks back from the start of the current week
      return subWeeks(startOfWeek(now, { weekStartsOn: 1 }), 2);

    case "monthly":
      // First day of the previous month
      return startOfMonth(subMonths(now, 1));

    case "quarterly":
      // First day of the previous quarter
      return startOfQuarter(subQuarters(now, 1));

    case "annual":
      // Jan 1 of the previous year
      return startOfYear(subYears(now, 1));

    default:
      return null;
  }
}
