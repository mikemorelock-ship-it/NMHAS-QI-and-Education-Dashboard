import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toUTCDate, targetToRaw } from "@/lib/utils";
import {
  aggregateValues,
  aggregateValuesWeighted,
  type AggregationType,
  type MetricDataType,
} from "@/lib/aggregation";

export const dynamic = "force-dynamic";

const MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * GET /api/dashboard/scorecards
 *
 * Returns a FLAT scorecard (one table, no department groupings).
 *
 * Query params:
 *   year        – defaults to current year
 *   divisionIds – comma-separated Division IDs (multi-select)
 *   regionIds   – comma-separated Region IDs (multi-select, "Department" in UI)
 *   kpiOnly     – "true" to show only KPI metrics
 *   metricIds   – comma-separated Metric IDs (from preset click)
 *   scorecardId – scorecard ID to use per-scorecard sort order + groupName
 *
 * Aggregation logic:
 *   - When regionIds provided → fetch entries for those regions, aggregate using
 *     each metric's aggregationType (sum, average, etc.)
 *   - When divisionIds provided (no regionIds) → find all regions in those
 *     divisions, fetch region-level entries, aggregate by metric's aggregationType
 *   - No filter → fetch ALL region-level entries, aggregate across all departments
 *
 *   Rate/proportion metrics use weighted aggregation (sum_num/sum_den) instead of
 *   averaging pre-computed values.
 *   YTD calculation uses each metric's aggregationType (not unit-based inference).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

    if (isNaN(year) || year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const divisionIdsRaw = searchParams.get("divisionIds") || "";
    const regionIdsRaw = searchParams.get("regionIds") || "";
    const metricIdsRaw = searchParams.get("metricIds") || "";
    const scorecardId = searchParams.get("scorecardId") || "";
    const kpiOnly = searchParams.get("kpiOnly") === "true";

    const divisionIds = divisionIdsRaw ? divisionIdsRaw.split(",").filter(Boolean) : [];
    const regionIds = regionIdsRaw ? regionIdsRaw.split(",").filter(Boolean) : [];
    const presetMetricIds = metricIdsRaw ? metricIdsRaw.split(",").filter(Boolean) : [];

    const yearStart = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    // -----------------------------------------------------------------------
    // 0. If scorecardId provided, fetch per-scorecard sort order + groupName
    // -----------------------------------------------------------------------
    let scorecardSortMap: Map<string, number> | null = null;
    let scorecardGroupMap: Map<string, string | null> | null = null;

    if (scorecardId) {
      const scorecardMetrics = await prisma.scorecardMetric.findMany({
        where: { scorecardId },
        select: { metricDefinitionId: true, sortOrder: true, groupName: true },
      });
      if (scorecardMetrics.length > 0) {
        scorecardSortMap = new Map(
          scorecardMetrics.map((sm) => [sm.metricDefinitionId, sm.sortOrder])
        );
        scorecardGroupMap = new Map(
          scorecardMetrics.map((sm) => [sm.metricDefinitionId, sm.groupName])
        );
      }
    }

    // -----------------------------------------------------------------------
    // 1. Fetch all active top-level metrics (with aggregationType + dataType)
    // -----------------------------------------------------------------------
    const allMetrics = await prisma.metricDefinition.findMany({
      where: {
        isActive: true,
        parentId: null,
        ...(kpiOnly ? { isKpi: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        unit: true,
        target: true,
        departmentId: true,
        aggregationType: true,
        dataType: true,
        desiredDirection: true,
        rateMultiplier: true,
        rateSuffix: true,
      },
    });

    // -----------------------------------------------------------------------
    // 2. Fetch associations to determine which metrics match the filters
    // -----------------------------------------------------------------------
    let visibleMetricIds: Set<string>;

    if (regionIds.length > 0) {
      const assocs = await prisma.metricAssociation.findMany({
        where: { regionId: { in: regionIds } },
        select: { metricDefinitionId: true },
      });
      visibleMetricIds = new Set(assocs.map((a) => a.metricDefinitionId));
    } else if (divisionIds.length > 0) {
      const assocs = await prisma.metricAssociation.findMany({
        where: { divisionId: { in: divisionIds } },
        select: { metricDefinitionId: true },
      });
      visibleMetricIds = new Set(assocs.map((a) => a.metricDefinitionId));
    } else {
      visibleMetricIds = new Set(allMetrics.map((m) => m.id));
    }

    let filteredMetrics: typeof allMetrics;

    if (presetMetricIds.length > 0) {
      // When a preset specifies explicit metric IDs, show ALL of them
      // regardless of division/department associations. The filters only
      // affect which data entries are aggregated, not which metrics appear.
      // This supports "rollup" scorecards where some metrics span multiple
      // divisions and others don't.
      const presetSet = new Set(presetMetricIds);
      filteredMetrics = allMetrics.filter((m) => presetSet.has(m.id));
    } else {
      // No preset metrics — use association-based visibility filtering
      filteredMetrics = allMetrics.filter((m) => visibleMetricIds.has(m.id));
    }

    // Apply per-scorecard sort order if available
    if (scorecardSortMap) {
      filteredMetrics.sort((a, b) => {
        const aSort = scorecardSortMap!.get(a.id) ?? 9999;
        const bSort = scorecardSortMap!.get(b.id) ?? 9999;
        return aSort - bSort;
      });
    }

    const metricIds = filteredMetrics.map((m) => m.id);

    if (metricIds.length === 0) {
      return NextResponse.json({
        scorecard: {
          metrics: [],
          months: [],
          year,
          presets: [],
        },
      });
    }

    // -----------------------------------------------------------------------
    // 3. Fetch entries — always at region (department) level, then aggregate
    //    Include numerator/denominator for weighted rate/proportion aggregation
    // -----------------------------------------------------------------------
    type RawEntry = {
      metricDefinitionId: string;
      periodStart: Date;
      value: number;
      numerator: number | null;
      denominator: number | null;
      divisionId: string | null;
      regionId: string | null;
    };

    const entrySelect = {
      metricDefinitionId: true,
      periodStart: true,
      value: true,
      numerator: true,
      denominator: true,
      divisionId: true,
      regionId: true,
    } as const;

    let rawEntries: RawEntry[];

    if (regionIds.length > 0) {
      // Specific departments selected → fetch entries for those regions
      rawEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: { in: metricIds },
          periodStart: { gte: yearStart, lte: yearEnd },
          regionId: { in: regionIds },
        },
        orderBy: { periodStart: "asc" },
        select: entrySelect,
      });
    } else if (divisionIds.length > 0) {
      // Divisions selected (no specific departments) → find all regions in
      // those divisions and fetch their entries for aggregation
      const regionsInDivisions = await prisma.region.findMany({
        where: { divisionId: { in: divisionIds }, isActive: true },
        select: { id: true },
      });
      const regionIdsForDivisions = regionsInDivisions.map((r) => r.id);

      rawEntries =
        regionIdsForDivisions.length > 0
          ? await prisma.metricEntry.findMany({
              where: {
                metricDefinitionId: { in: metricIds },
                periodStart: { gte: yearStart, lte: yearEnd },
                regionId: { in: regionIdsForDivisions },
              },
              orderBy: { periodStart: "asc" },
              select: entrySelect,
            })
          : [];
    } else {
      // No filter → fetch region-level entries for metrics that have them,
      // then fall back to department-level entries for metrics that don't
      // (e.g., Quality, Clinical Dev, Education metrics have no region data).
      const regionEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: { in: metricIds },
          periodStart: { gte: yearStart, lte: yearEnd },
          regionId: { not: null },
        },
        orderBy: { periodStart: "asc" },
        select: entrySelect,
      });

      // Determine which metrics had region-level entries
      const metricsWithRegionData = new Set(regionEntries.map((e) => e.metricDefinitionId));
      const metricsWithoutRegionData = metricIds.filter((id) => !metricsWithRegionData.has(id));

      // Fetch department-level entries for metrics that lack region data
      let deptEntries: RawEntry[] = [];
      if (metricsWithoutRegionData.length > 0) {
        deptEntries = await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: { in: metricsWithoutRegionData },
            periodStart: { gte: yearStart, lte: yearEnd },
            divisionId: null,
            regionId: null,
          },
          orderBy: { periodStart: "asc" },
          select: entrySelect,
        });
      }

      rawEntries = [...regionEntries, ...deptEntries];
    }

    // -----------------------------------------------------------------------
    // 4. Index entries by metric + month → aggregate using weighted or standard
    // -----------------------------------------------------------------------
    // Key: `${metricId}:${monthIndex}` → array of entry objects
    type EntryData = { value: number; numerator: number | null; denominator: number | null };
    const entriesByMetricMonth = new Map<string, EntryData[]>();

    for (const entry of rawEntries) {
      const monthIdx = toUTCDate(entry.periodStart).getMonth();
      const key = `${entry.metricDefinitionId}:${monthIdx}`;
      const list = entriesByMetricMonth.get(key) ?? [];
      list.push({
        value: entry.value,
        numerator: entry.numerator,
        denominator: entry.denominator,
      });
      entriesByMetricMonth.set(key, list);
    }

    // Build lookups: metricId → aggregationType, metricId → dataType
    const metricAggMap = new Map(
      filteredMetrics.map((m) => [m.id, m.aggregationType as AggregationType])
    );
    const metricDataTypeMap = new Map(
      filteredMetrics.map((m) => [m.id, (m.dataType ?? "continuous") as MetricDataType])
    );

    // -----------------------------------------------------------------------
    // 5. Build scorecard rows
    // -----------------------------------------------------------------------
    const metricRows = filteredMetrics.map((metric) => {
      const aggType = metricAggMap.get(metric.id) ?? "average";
      const dataType = metricDataTypeMap.get(metric.id) ?? "continuous";

      const monthlyValues = MONTH_ABBREVS.map((abbrev, idx) => {
        const key = `${metric.id}:${idx}`;
        const entries = entriesByMetricMonth.get(key);
        return {
          month: abbrev,
          periodStart: new Date(Date.UTC(year, idx, 1, 12, 0, 0)).toISOString(),
          value:
            entries && entries.length > 0
              ? aggregateValuesWeighted(entries, dataType, aggType)
              : null,
        };
      });

      // Calculate YTD actual using the metric's aggregationType
      const valuesWithData = monthlyValues.filter((mv) => mv.value !== null);
      let actualYtd: number | null = null;
      if (valuesWithData.length > 0) {
        const vals = valuesWithData.map((v) => v.value!);
        if (aggType === "sum") {
          // For sum metrics, YTD = sum of monthly values
          actualYtd = Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
        } else {
          // For average/min/max/latest, YTD = aggregate of monthly values
          // Note: YTD for rate/proportion uses aggregate of already-weighted monthly values
          actualYtd = aggregateValues(vals, aggType);
        }
      }

      const targetYtd = metric.target;
      // Target is stored in display units; convert to raw for comparison with raw data values
      const rawTarget =
        metric.target !== null
          ? targetToRaw(metric.target, metric.unit, metric.rateMultiplier)
          : null;
      const desired = metric.desiredDirection ?? "up";
      const meetsTarget =
        rawTarget !== null && actualYtd !== null
          ? desired === "down"
            ? actualYtd <= rawTarget
            : actualYtd >= rawTarget
          : null;

      return {
        metricId: metric.id,
        metricName: metric.name,
        unit: metric.unit,
        aggregationType: metric.aggregationType,
        target: metric.target,
        desiredDirection: desired,
        rateMultiplier: metric.rateMultiplier ?? null,
        rateSuffix: metric.rateSuffix ?? null,
        targetYtd,
        actualYtd,
        monthlyValues,
        meetsTarget,
        groupName: scorecardGroupMap?.get(metric.id) ?? null,
      };
    });

    // Determine which months have data
    const monthsWithData = MONTH_ABBREVS.filter((_, idx) =>
      metricRows.some((m) => m.monthlyValues[idx].value !== null)
    );

    // Fetch scorecards as quick-filter presets (using junction tables)
    const allScorecards = await prisma.scorecard.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        scorecardDivisions: {
          include: { division: { select: { id: true, name: true } } },
        },
        scorecardRegions: {
          include: { region: { select: { id: true, name: true } } },
        },
        scorecardMetrics: { select: { metricDefinitionId: true } },
      },
    });

    const presets = allScorecards.map((sc) => ({
      id: sc.id,
      name: sc.name,
      divisionIds: sc.scorecardDivisions.map((sd) => sd.divisionId),
      divisionNames: sc.scorecardDivisions.map((sd) => sd.division.name),
      regionIds: sc.scorecardRegions.map((sr) => sr.regionId),
      regionNames: sc.scorecardRegions.map((sr) => sr.region.name),
      metricIds: sc.scorecardMetrics.map((sm) => sm.metricDefinitionId),
      sortOrder: sc.sortOrder,
    }));

    return NextResponse.json({
      scorecard: {
        metrics: metricRows,
        months: monthsWithData,
        year,
        presets,
      },
    });
  } catch (error) {
    console.error("Scorecards API error:", error);
    return NextResponse.json({ error: "Failed to fetch scorecards" }, { status: 500 });
  }
}
