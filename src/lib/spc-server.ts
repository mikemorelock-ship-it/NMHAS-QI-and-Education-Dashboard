/**
 * Server-side SPC computation helper.
 *
 * This module provides a function to compute SPC data from metric entries
 * that include numerator/denominator. Used by both API routes and server
 * components to add SPC chart data to metric detail responses.
 */

import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/utils";
import { calculateSPC, type DataType, type SPCDataPoint, type SPCOptions } from "@/lib/spc";

interface SPCComputeInput {
  metricId: string;
  dataType: string;
  spcSigmaLevel: number;
  baselineStart: Date | null;
  baselineEnd: Date | null;
  /** Prisma where clause for filtering entries by period, division, etc. */
  entryWhereClause: Record<string, unknown>;
}

/**
 * Compute SPC data for a given metric scope.
 *
 * For proportion/rate metrics: aggregates numerator and denominator per period,
 * then computes the proportion or rate. This avoids "average of averages".
 *
 * For continuous metrics: uses the already-aggregated values from chartData.
 */
export async function computeSPCData(
  input: SPCComputeInput,
  chartData: Array<{ period: string; value: number }>
) {
  const { dataType, spcSigmaLevel, baselineStart, baselineEnd } = input;
  const dt = dataType as DataType;

  if (!["proportion", "rate", "continuous"].includes(dt)) {
    return null;
  }

  const options: SPCOptions = {
    sigmaLevel: (spcSigmaLevel === 1 || spcSigmaLevel === 2 || spcSigmaLevel === 3)
      ? spcSigmaLevel
      : 3,
  };

  if (baselineStart) {
    options.baselineStart = formatPeriod(baselineStart);
  }
  if (baselineEnd) {
    options.baselineEnd = formatPeriod(baselineEnd);
  }

  let spcDataPoints: SPCDataPoint[];

  if (dt === "proportion" || dt === "rate") {
    // Fetch entries with numerator/denominator for proper aggregation
    const entries = await prisma.metricEntry.findMany({
      where: input.entryWhereClause as Parameters<typeof prisma.metricEntry.findMany>[0] extends { where?: infer W } ? W : never,
      orderBy: { periodStart: "asc" },
      select: {
        periodStart: true,
        value: true,
        numerator: true,
        denominator: true,
      },
    });

    // Group by period and sum numerators/denominators
    const periodMap = new Map<
      string,
      { date: Date; totalNum: number; totalDen: number; count: number }
    >();

    for (const e of entries) {
      const key = e.periodStart.toISOString();
      if (!periodMap.has(key)) {
        periodMap.set(key, { date: e.periodStart, totalNum: 0, totalDen: 0, count: 0 });
      }
      const bucket = periodMap.get(key)!;
      if (e.numerator != null && e.denominator != null) {
        bucket.totalNum += e.numerator;
        bucket.totalDen += e.denominator;
      } else {
        // Fallback: if no n/d, still use the value but can't do proper SPC
        bucket.count++;
      }
    }

    spcDataPoints = Array.from(periodMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((bucket) => {
        const period = formatPeriod(bucket.date);
        if (bucket.totalDen > 0) {
          const value = dt === "proportion"
            ? (bucket.totalNum / bucket.totalDen) * 100
            : bucket.totalNum / bucket.totalDen;
          return {
            period,
            value,
            numerator: bucket.totalNum,
            denominator: bucket.totalDen,
          };
        }
        // Fallback: use chartData value for this period
        const chartPoint = chartData.find((c) => c.period === period);
        return {
          period,
          value: chartPoint?.value ?? 0,
        };
      });
  } else {
    // Continuous: use chartData directly
    spcDataPoints = chartData.map((c) => ({
      period: c.period,
      value: c.value,
    }));
  }

  if (spcDataPoints.length < 2) {
    return null;
  }

  return calculateSPC(dt, spcDataPoints, options);
}
