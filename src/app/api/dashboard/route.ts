import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDateRangeFilter } from "@/lib/utils";
import { aggregateByPeriodWeighted, type AggregationType, type MetricDataType } from "@/lib/aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard
 *
 * Returns all active divisions with their KPI data (latest values, trends, sparklines).
 * Department-level entries are automatically aggregated (sum/average) up to the division level.
 * Supports ?range=3mo|6mo|1yr|all|custom:YYYY-MM-DD:YYYY-MM-DD for date filtering.
 *
 * Optimised: fetches all region-level entries in a single bulk query, then partitions in JS.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "all";

    const dateFilter = parseDateRangeFilter(range);
    const periodStartFilter = Object.keys(dateFilter).length > 0
      ? { periodStart: dateFilter }
      : {};

    // Fetch all active divisions
    const divisions = await prisma.division.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    });

    const divisionIds = divisions.map((d) => d.id);

    // Fetch regions so we can map regionId -> divisionId
    const regions = await prisma.region.findMany({
      where: { divisionId: { in: divisionIds }, isActive: true },
      select: { id: true, divisionId: true },
    });
    const regionToDivision = new Map(regions.map((r) => [r.id, r.divisionId]));
    const regionIds = regions.map((r) => r.id);

    // Fetch all metric associations in one query
    const associations = await prisma.metricAssociation.findMany({
      where: {
        OR: [
          { divisionId: { in: divisionIds } },
          ...(regionIds.length > 0 ? [{ regionId: { in: regionIds } }] : []),
        ],
      },
      select: { metricDefinitionId: true, divisionId: true, regionId: true },
    });

    // Build map: divisionId -> set of metric IDs
    const divMetricMap = new Map<string, Set<string>>();
    for (const a of associations) {
      const divId = a.divisionId ?? (a.regionId ? regionToDivision.get(a.regionId) : null);
      if (!divId) continue;
      if (!divMetricMap.has(divId)) divMetricMap.set(divId, new Set());
      divMetricMap.get(divId)!.add(a.metricDefinitionId);
    }

    // Collect all KPI metric IDs
    const allKpiMetricIds = new Set<string>();
    for (const ids of divMetricMap.values()) {
      for (const id of ids) allKpiMetricIds.add(id);
    }

    // Fetch KPI metric definitions in one query
    const kpiMetrics = allKpiMetricIds.size > 0
      ? await prisma.metricDefinition.findMany({
          where: {
            id: { in: Array.from(allKpiMetricIds) },
            isActive: true,
            isKpi: true,
            parentId: null,
          },
          select: {
            id: true, name: true, slug: true, unit: true, target: true,
            chartType: true, categoryLegacy: true, aggregationType: true,
            dataType: true, rateMultiplier: true, rateSuffix: true,
          },
        })
      : [];

    const kpiMetricMap = new Map(kpiMetrics.map((m) => [m.id, m]));
    const kpiMetricIdSet = new Set(kpiMetrics.map((m) => m.id));

    // =========================================================================
    // BULK FETCH: all region-level entries for all associated KPI metrics at once
    // This replaces ~200 individual queries with 1-2 bulk queries.
    // =========================================================================
    const allRegionEntries = kpiMetricIdSet.size > 0
      ? await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: { in: Array.from(kpiMetricIdSet) },
            regionId: { not: null },
          },
          orderBy: { periodStart: "asc" },
          select: {
            metricDefinitionId: true, divisionId: true,
            periodStart: true, value: true, numerator: true, denominator: true,
          },
        })
      : [];

    // Also fetch date-filtered entries if a range filter is active
    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const filteredRegionEntries = hasDateFilter && kpiMetricIdSet.size > 0
      ? await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: { in: Array.from(kpiMetricIdSet) },
            regionId: { not: null },
            ...periodStartFilter,
          },
          orderBy: { periodStart: "asc" },
          select: {
            metricDefinitionId: true, divisionId: true,
            periodStart: true, value: true, numerator: true, denominator: true,
          },
        })
      : allRegionEntries; // no date filter = same data

    // Index entries by (metricId, divisionId) for fast lookup
    type EntryRow = { periodStart: Date; value: number; numerator: number | null; denominator: number | null };
    const entryIndex = new Map<string, EntryRow[]>();
    const filteredEntryIndex = new Map<string, EntryRow[]>();
    const allEntriesByMetric = new Map<string, EntryRow[]>();
    const filteredAllByMetric = new Map<string, EntryRow[]>();

    for (const e of allRegionEntries) {
      const key = `${e.metricDefinitionId}|${e.divisionId}`;
      if (!entryIndex.has(key)) entryIndex.set(key, []);
      entryIndex.get(key)!.push(e);

      if (!allEntriesByMetric.has(e.metricDefinitionId)) allEntriesByMetric.set(e.metricDefinitionId, []);
      allEntriesByMetric.get(e.metricDefinitionId)!.push(e);
    }
    for (const e of filteredRegionEntries) {
      const key = `${e.metricDefinitionId}|${e.divisionId}`;
      if (!filteredEntryIndex.has(key)) filteredEntryIndex.set(key, []);
      filteredEntryIndex.get(key)!.push(e);

      if (!filteredAllByMetric.has(e.metricDefinitionId)) filteredAllByMetric.set(e.metricDefinitionId, []);
      filteredAllByMetric.get(e.metricDefinitionId)!.push(e);
    }

    // =========================================================================
    // Build result per division — all in-memory now, no more per-metric queries
    // =========================================================================

    function buildKpi(
      metric: (typeof kpiMetrics)[number],
      entries: EntryRow[],
      sparklineEntries: EntryRow[],
      divSlug: string,
    ) {
      const dataType = (metric.dataType ?? "continuous") as MetricDataType;
      const aggType = metric.aggregationType as AggregationType;

      const aggregatedSeries = aggregateByPeriodWeighted(entries, dataType, aggType);
      const recent = aggregatedSeries.slice(-2);
      const currentValue = recent.length > 0 ? recent[recent.length - 1].value : 0;
      const previousValue = recent.length > 1 ? recent[recent.length - 2].value : 0;

      let trend = 0;
      if (previousValue !== 0) {
        trend = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      }

      const sparklineSeries = aggregateByPeriodWeighted(sparklineEntries, dataType, aggType)
        .slice(-12)
        .map((s) => s.value);

      return {
        metricId: metric.id,
        metricSlug: metric.slug,
        divisionSlug: divSlug,
        name: metric.name,
        currentValue,
        previousValue,
        unit: metric.unit,
        target: metric.target,
        trend: Math.round(trend * 10) / 10,
        sparkline: sparklineSeries,
        chartType: metric.chartType,
        category: metric.categoryLegacy,
        aggregationType: metric.aggregationType,
        rateMultiplier: metric.rateMultiplier ?? null,
        rateSuffix: metric.rateSuffix ?? null,
      };
    }

    const result = divisions.map((div) => {
      const associatedIds = divMetricMap.get(div.id) ?? new Set();
      const divKpiMetrics = Array.from(associatedIds)
        .map((id) => kpiMetricMap.get(id))
        .filter(Boolean) as typeof kpiMetrics;

      const kpis = divKpiMetrics.map((metric) => {
        const key = `${metric.id}|${div.id}`;
        const entries = entryIndex.get(key) ?? [];
        const sparkEntries = filteredEntryIndex.get(key) ?? [];
        return buildKpi(metric, entries, sparkEntries, div.slug);
      });

      return { id: div.id, name: div.name, slug: div.slug, kpis };
    });

    // Unassociated KPIs
    const associatedMetricIds = new Set(associations.map((a) => a.metricDefinitionId));
    const unassociatedKpis = await prisma.metricDefinition.findMany({
      where: {
        isActive: true, isKpi: true, parentId: null,
        id: { notIn: Array.from(associatedMetricIds) },
      },
      select: {
        id: true, name: true, slug: true, unit: true, target: true,
        chartType: true, categoryLegacy: true, aggregationType: true,
        dataType: true, rateMultiplier: true, rateSuffix: true,
      },
    });

    if (unassociatedKpis.length > 0) {
      // Bulk fetch unassociated entries (dept-level, no division/region)
      const unassocIds = unassociatedKpis.map((m) => m.id);
      const unassocEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: { in: unassocIds },
          divisionId: null, regionId: null,
        },
        orderBy: { periodStart: "asc" },
        select: { metricDefinitionId: true, periodStart: true, value: true },
      });

      const unassocByMetric = new Map<string, typeof unassocEntries>();
      for (const e of unassocEntries) {
        if (!unassocByMetric.has(e.metricDefinitionId)) unassocByMetric.set(e.metricDefinitionId, []);
        unassocByMetric.get(e.metricDefinitionId)!.push(e);
      }

      const unassignedKpiData = unassociatedKpis.map((metric) => {
        const entries = unassocByMetric.get(metric.id) ?? [];
        const currentValue = entries.length > 0 ? entries[entries.length - 1].value : 0;
        const previousValue = entries.length > 1 ? entries[entries.length - 2].value : 0;

        let trend = 0;
        if (previousValue !== 0) {
          trend = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
        }

        return {
          metricId: metric.id,
          metricSlug: metric.slug,
          divisionSlug: "unassigned",
          name: metric.name,
          currentValue,
          previousValue,
          unit: metric.unit,
          target: metric.target,
          trend: Math.round(trend * 10) / 10,
          sparkline: entries.slice(-12).map((e) => e.value),
          chartType: metric.chartType,
          category: metric.categoryLegacy,
          aggregationType: metric.aggregationType,
          rateMultiplier: metric.rateMultiplier ?? null,
          rateSuffix: metric.rateSuffix ?? null,
        };
      });

      if (unassignedKpiData.some((k) => k.currentValue !== 0 || k.sparkline.length > 0)) {
        result.push({
          id: "unassigned",
          name: "Unassigned",
          slug: "unassigned",
          kpis: unassignedKpiData,
        });
      }
    }

    // Build "All Divisions" aggregate — in-memory from already-fetched data
    const allDivisionsKpis = Array.from(kpiMetricIdSet)
      .map((id) => kpiMetricMap.get(id))
      .filter(Boolean)
      .map((metric) => {
        const metricDef = metric as (typeof kpiMetrics)[number];
        const entries = allEntriesByMetric.get(metricDef.id) ?? [];
        const sparkEntries = filteredAllByMetric.get(metricDef.id) ?? [];
        return buildKpi(metricDef, entries, sparkEntries, "");
      });

    return NextResponse.json({ divisions: result, allDivisionsKpis });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard overview" },
      { status: 500 }
    );
  }
}
