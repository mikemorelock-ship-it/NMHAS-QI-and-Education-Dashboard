import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import {
  aggregateByPeriodWeighted,
  aggregateValues,
  type AggregationType,
  type MetricDataType,
} from "@/lib/aggregation";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/[slug]
 *
 * Returns a single division's detail data including:
 * - Division info (name, slug)
 * - KPI cards (aggregated from department-level entries)
 * - Full time-series chart data for all associated metrics (aggregated)
 * - Departments (regions) list for drill-down
 *
 * Optimised: bulk fetches all region-level entries in 1-2 queries, then partitions in JS.
 * Supports ?range=3mo|6mo|1yr|all|custom:YYYY-MM-DD:YYYY-MM-DD for date filtering.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "all";

    const dateFilter = parseDateRangeFilter(range);
    const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

    // ---------------------------------------------------------------
    // Handle the virtual "unassigned" division
    // ---------------------------------------------------------------
    if (slug === "unassigned") {
      // A metric is "associated" if it has ANY association (division OR region).
      // Only metrics with NO associations at all are "unassigned".
      const allAssociations = await prisma.metricAssociation.findMany({
        where: {
          OR: [{ divisionId: { not: null } }, { regionId: { not: null } }],
        },
        select: { metricDefinitionId: true },
      });
      const associatedMetricIds = new Set(allAssociations.map((a) => a.metricDefinitionId));

      const unassociatedMetrics = await prisma.metricDefinition.findMany({
        where: {
          isActive: true,
          parentId: null,
          id: { notIn: Array.from(associatedMetricIds) },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      const kpiMetrics = unassociatedMetrics.filter((m) => m.isKpi);
      const unassocMetricIds = unassociatedMetrics.map((m) => m.id);

      // BULK FETCH: all entries for unassociated metrics in one query
      const allUnassocEntries =
        unassocMetricIds.length > 0
          ? await prisma.metricEntry.findMany({
              where: {
                metricDefinitionId: { in: unassocMetricIds },
                divisionId: null,
                regionId: null,
              },
              orderBy: { periodStart: "asc" },
              select: { metricDefinitionId: true, periodStart: true, value: true },
            })
          : [];

      // Also fetch filtered entries if date filter is active
      const filteredUnassocEntries =
        Object.keys(dateFilter).length > 0 && unassocMetricIds.length > 0
          ? await prisma.metricEntry.findMany({
              where: {
                metricDefinitionId: { in: unassocMetricIds },
                divisionId: null,
                regionId: null,
                ...periodStartFilter,
              },
              orderBy: { periodStart: "asc" },
              select: { metricDefinitionId: true, periodStart: true, value: true },
            })
          : allUnassocEntries;

      // Index by metricId
      const allByMetric = new Map<string, Array<{ periodStart: Date; value: number }>>();
      for (const e of allUnassocEntries) {
        if (!allByMetric.has(e.metricDefinitionId)) allByMetric.set(e.metricDefinitionId, []);
        allByMetric.get(e.metricDefinitionId)!.push(e);
      }
      const filteredByMetric = new Map<string, Array<{ periodStart: Date; value: number }>>();
      for (const e of filteredUnassocEntries) {
        if (!filteredByMetric.has(e.metricDefinitionId))
          filteredByMetric.set(e.metricDefinitionId, []);
        filteredByMetric.get(e.metricDefinitionId)!.push(e);
      }

      const kpis = kpiMetrics.map((metric) => {
        const filteredEntries = filteredByMetric.get(metric.id) ?? [];
        const allValues = filteredEntries.map((e) => e.value);
        const aggType = (metric.aggregationType ?? "average") as AggregationType;

        let currentValue = 0;
        let previousValue = 0;
        let trend = 0;

        if (allValues.length > 0) {
          currentValue = aggregateValues(allValues, aggType) ?? 0;

          if (allValues.length >= 2) {
            const midpoint = Math.ceil(allValues.length / 2);
            const olderHalf = allValues.slice(0, midpoint);
            const recentHalf = allValues.slice(midpoint);

            previousValue = aggregateValues(olderHalf, aggType) ?? 0;
            const recentAggregate = aggregateValues(recentHalf, aggType) ?? 0;

            if (previousValue !== 0) {
              trend = ((recentAggregate - previousValue) / Math.abs(previousValue)) * 100;
            }
          }
        }

        return {
          metricId: metric.id,
          metricSlug: metric.slug,
          departmentSlug: metric.departmentId,
          divisionSlug: "unassigned",
          name: metric.name,
          currentValue,
          previousValue,
          unit: metric.unit,
          target: metric.target,
          trend: Math.round(trend * 10) / 10,
          sparkline: filteredEntries.slice(-12).map((e) => e.value),
          chartType: metric.chartType,
          category: metric.categoryLegacy,
          aggregationType: metric.aggregationType,
          desiredDirection: (metric.desiredDirection ?? "up") as "up" | "down",
          rateMultiplier: metric.rateMultiplier ?? null,
          rateSuffix: metric.rateSuffix ?? null,
        };
      });

      const metrics = unassociatedMetrics.map((metric) => {
        const entries = filteredByMetric.get(metric.id) ?? [];
        return {
          id: metric.id,
          slug: metric.slug,
          name: metric.name,
          unit: metric.unit,
          chartType: metric.chartType,
          category: metric.categoryLegacy,
          target: metric.target,
          rateMultiplier: metric.rateMultiplier ?? null,
          rateSuffix: metric.rateSuffix ?? null,
          data: entries.map((e) => ({ period: formatPeriod(e.periodStart), value: e.value })),
        };
      });

      return NextResponse.json({
        id: "unassigned",
        name: "Unassigned",
        slug: "unassigned",
        description: null,
        departments: [],
        kpis,
        metrics,
      });
    }

    // ---------------------------------------------------------------
    // Normal division detail — aggregated from department-level entries
    // ---------------------------------------------------------------

    const division = await prisma.division.findFirst({
      where: { slug, isActive: true },
      include: {
        regions: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    });

    if (!division) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 });
    }

    // Fetch associated metrics for this division.
    const regionIds = division.regions.map((r) => r.id);
    const associations = await prisma.metricAssociation.findMany({
      where: {
        OR: [
          { divisionId: division.id },
          ...(regionIds.length > 0 ? [{ regionId: { in: regionIds } }] : []),
        ],
      },
      select: { metricDefinitionId: true },
    });

    const associatedMetricIds = [...new Set(associations.map((a) => a.metricDefinitionId))];

    const metricDefinitions =
      associatedMetricIds.length > 0
        ? await prisma.metricDefinition.findMany({
            where: {
              id: { in: associatedMetricIds },
              isActive: true,
              parentId: null,
            },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          })
        : [];

    const allMetricIds = metricDefinitions.map((m) => m.id);

    // =========================================================================
    // BULK FETCH: all region-level entries for all metrics in 1-2 queries
    // Replaces 2-3 queries per metric (N+1) with bulk fetch + JS partitioning.
    // =========================================================================

    const allRegionEntries =
      allMetricIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: { in: allMetricIds },
              divisionId: division.id,
              regionId: { not: null },
            },
            orderBy: { periodStart: "asc" },
            select: {
              metricDefinitionId: true,
              periodStart: true,
              value: true,
              numerator: true,
              denominator: true,
            },
          })
        : [];

    // Also fetch date-filtered entries if a range filter is active
    const hasDateFilter = Object.keys(dateFilter).length > 0;
    const filteredRegionEntries =
      hasDateFilter && allMetricIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: { in: allMetricIds },
              divisionId: division.id,
              regionId: { not: null },
              ...periodStartFilter,
            },
            orderBy: { periodStart: "asc" },
            select: {
              metricDefinitionId: true,
              periodStart: true,
              value: true,
              numerator: true,
              denominator: true,
            },
          })
        : allRegionEntries;

    // Index by metricId
    type EntryRow = {
      periodStart: Date;
      value: number;
      numerator: number | null;
      denominator: number | null;
    };
    const allByMetric = new Map<string, EntryRow[]>();
    const filteredByMetric = new Map<string, EntryRow[]>();

    for (const e of allRegionEntries) {
      if (!allByMetric.has(e.metricDefinitionId)) allByMetric.set(e.metricDefinitionId, []);
      allByMetric.get(e.metricDefinitionId)!.push(e);
    }
    for (const e of filteredRegionEntries) {
      if (!filteredByMetric.has(e.metricDefinitionId))
        filteredByMetric.set(e.metricDefinitionId, []);
      filteredByMetric.get(e.metricDefinitionId)!.push(e);
    }

    const kpiMetrics = metricDefinitions.filter((m) => m.isKpi);

    // Build KPI data — all in-memory, no per-metric queries
    const kpis = kpiMetrics.map((metric) => {
      const aggType = metric.aggregationType as AggregationType;
      const dataType = (metric.dataType ?? "continuous") as MetricDataType;

      const filteredEntries = filteredByMetric.get(metric.id) ?? [];
      const aggregatedSeries = aggregateByPeriodWeighted(filteredEntries, dataType, aggType);
      const allValues = aggregatedSeries.map((s) => s.value);

      let currentValue = 0;
      let previousValue = 0;
      let trend = 0;

      if (allValues.length > 0) {
        // Aggregate all period values across the selected date range
        currentValue = aggregateValues(allValues, aggType) ?? 0;

        if (allValues.length >= 2) {
          // Split the range into older/recent halves for trend comparison
          const midpoint = Math.ceil(allValues.length / 2);
          const olderHalf = allValues.slice(0, midpoint);
          const recentHalf = allValues.slice(midpoint);

          previousValue = aggregateValues(olderHalf, aggType) ?? 0;
          const recentAggregate = aggregateValues(recentHalf, aggType) ?? 0;

          if (previousValue !== 0) {
            trend = ((recentAggregate - previousValue) / Math.abs(previousValue)) * 100;
          }
        }
      }

      const sparklineSeries = aggregatedSeries.slice(-12).map((s) => s.value);

      return {
        metricId: metric.id,
        metricSlug: metric.slug,
        departmentSlug: metric.departmentId,
        divisionSlug: division.slug,
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
        desiredDirection: (metric.desiredDirection ?? "up") as "up" | "down",
        rateMultiplier: metric.rateMultiplier ?? null,
        rateSuffix: metric.rateSuffix ?? null,
      };
    });

    // Build full time-series chart data — all in-memory
    const metrics = metricDefinitions.map((metric) => {
      const aggType = metric.aggregationType as AggregationType;
      const dataType = (metric.dataType ?? "continuous") as MetricDataType;

      const entries = filteredByMetric.get(metric.id) ?? [];
      const aggregatedData = aggregateByPeriodWeighted(entries, dataType, aggType).map((s) => ({
        period: formatPeriod(s.periodStart),
        value: s.value,
      }));

      return {
        id: metric.id,
        slug: metric.slug,
        name: metric.name,
        unit: metric.unit,
        chartType: metric.chartType,
        category: metric.categoryLegacy,
        target: metric.target,
        rateMultiplier: metric.rateMultiplier ?? null,
        rateSuffix: metric.rateSuffix ?? null,
        data: aggregatedData,
      };
    });

    return NextResponse.json({
      id: division.id,
      name: division.name,
      slug: division.slug,
      description: null,
      departments: division.regions,
      kpis,
      metrics,
    });
  } catch (error) {
    console.error("Division detail error:", error);
    return NextResponse.json({ error: "Failed to fetch division details" }, { status: 500 });
  }
}
