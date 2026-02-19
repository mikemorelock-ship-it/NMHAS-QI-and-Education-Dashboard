import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import {
  aggregateByPeriodWeighted,
  type AggregationType,
  type MetricDataType,
} from "@/lib/aggregation";
import { computeSPCData } from "@/lib/spc-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/global-metric/[metricSlug]
 *
 * Returns full detail data for a single metric aggregated across ALL divisions.
 * Shows a division-level breakdown and an organizational hierarchy.
 *
 * Optimised: bulk fetches all entries + regions in 1-2 queries, then partitions in JS.
 * Previously ran N+1 queries for per-division series, regions, and child metrics.
 *
 * Supports ?range=1mo|3mo|6mo|1yr|ytd|all|custom:YYYY-MM-DD:YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ metricSlug: string }> }
) {
  try {
    const { metricSlug } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "ytd";

    const dateFilter = parseDateRangeFilter(range);
    const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

    // Find the metric by slug
    const metric = await prisma.metricDefinition.findFirst({
      where: { slug: metricSlug, isActive: true },
      include: {
        annotations: { orderBy: { date: "desc" } },
        resources: { orderBy: { sortOrder: "asc" } },
        responsibleParties: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!metric) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    const aggType = metric.aggregationType as AggregationType;
    const dataType = (metric.dataType ?? "continuous") as MetricDataType;

    // Find all divisions associated with this metric
    const associations = await prisma.metricAssociation.findMany({
      where: { metricDefinitionId: metric.id, divisionId: { not: null } },
      select: { divisionId: true },
    });

    const divisionIds = [...new Set(associations.map((a) => a.divisionId!))];

    const divisions =
      divisionIds.length > 0
        ? await prisma.division.findMany({
            where: { id: { in: divisionIds }, isActive: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true, slug: true },
          })
        : [];

    // =========================================================================
    // BULK FETCH: all region-level entries for this metric across all divisions
    // Replaces N+1 per-division queries with 1 bulk query + JS partitioning.
    // =========================================================================

    const allRegionEntries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId: metric.id,
        regionId: { not: null },
        ...periodStartFilter,
      },
      orderBy: { periodStart: "asc" },
      select: {
        divisionId: true,
        periodStart: true,
        value: true,
        numerator: true,
        denominator: true,
      },
    });

    // Index by divisionId for per-division breakdown
    type EntryRow = {
      periodStart: Date;
      value: number;
      numerator: number | null;
      denominator: number | null;
    };
    const entriesByDivision = new Map<string, EntryRow[]>();
    for (const e of allRegionEntries) {
      const divId = e.divisionId;
      if (!divId) continue;
      if (!entriesByDivision.has(divId)) entriesByDivision.set(divId, []);
      entriesByDivision.get(divId)!.push(e);
    }

    // -----------------------------------------------------------------
    // Global time series — flat aggregation across ALL region entries
    // -----------------------------------------------------------------

    const globalSeries = aggregateByPeriodWeighted(allRegionEntries, dataType, aggType);

    const chartData = globalSeries.map((s) => ({
      period: formatPeriod(s.periodStart),
      value: s.value,
    }));

    const values = globalSeries.map((s) => s.value);

    // -----------------------------------------------------------------
    // Per-division series (all in-memory from bulk fetch)
    // -----------------------------------------------------------------

    const perDivisionSeries = new Map<string, { periodStart: Date; value: number }[]>();
    for (const div of divisions) {
      const divEntries = entriesByDivision.get(div.id) ?? [];
      const aggregated = aggregateByPeriodWeighted(divEntries, dataType, aggType);
      perDivisionSeries.set(div.id, aggregated);
    }

    // -----------------------------------------------------------------
    // Summary statistics
    // -----------------------------------------------------------------

    const current = values.length > 0 ? values[values.length - 1] : 0;
    const previous = values.length > 1 ? values[values.length - 2] : 0;

    let trend = 0;
    if (previous !== 0) {
      trend = ((current - previous) / Math.abs(previous)) * 100;
    }

    const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    // -----------------------------------------------------------------
    // Filter annotations to date range
    // -----------------------------------------------------------------

    let filteredAnnotations = metric.annotations;
    if (dateFilter.gte) {
      filteredAnnotations = filteredAnnotations.filter((a) => a.date >= dateFilter.gte!);
    }
    if (dateFilter.lte) {
      filteredAnnotations = filteredAnnotations.filter((a) => a.date <= dateFilter.lte!);
    }

    // -----------------------------------------------------------------
    // Division breakdown (each division = one breakdown entry)
    // -----------------------------------------------------------------

    const divisionBreakdown = divisions
      .map((div) => {
        const series = perDivisionSeries.get(div.id) ?? [];
        if (series.length === 0) return null;

        const divValues = series.map((s) => s.value);
        const divCurrent = divValues[divValues.length - 1];
        const divPrevious = divValues.length > 1 ? divValues[divValues.length - 2] : 0;

        let divTrend = 0;
        if (divPrevious !== 0) {
          divTrend = ((divCurrent - divPrevious) / Math.abs(divPrevious)) * 100;
        }

        return {
          divisionId: div.id,
          divisionName: div.name,
          divisionSlug: div.slug,
          currentValue: divCurrent,
          trend: Math.round(divTrend * 10) / 10,
          data: series.map((s) => ({
            period: formatPeriod(s.periodStart),
            value: s.value,
          })),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // -----------------------------------------------------------------
    // Organizational hierarchy — BULK fetch all regions for all divisions
    // Replaces N per-division region queries with 1 bulk query.
    // -----------------------------------------------------------------

    const allRegions =
      divisionIds.length > 0
        ? await prisma.region.findMany({
            where: { divisionId: { in: divisionIds }, isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, divisionId: true },
          })
        : [];

    const regionsByDivision = new Map<string, Array<{ id: string; name: string }>>();
    for (const r of allRegions) {
      if (!regionsByDivision.has(r.divisionId)) regionsByDivision.set(r.divisionId, []);
      regionsByDivision.get(r.divisionId)!.push({ id: r.id, name: r.name });
    }

    const hierarchy = divisions.map((div) => ({
      id: div.id,
      name: div.name,
      slug: div.slug,
      departments: regionsByDivision.get(div.id) ?? [],
    }));

    // -----------------------------------------------------------------
    // Parent metric info
    // -----------------------------------------------------------------

    let parentMetric = null;
    let siblingMetrics: Array<{ id: string; name: string; slug: string }> = [];
    if (metric.parentId) {
      const parent = await prisma.metricDefinition.findUnique({
        where: { id: metric.parentId },
        select: { id: true, name: true, slug: true },
      });
      parentMetric = parent;

      const siblings = await prisma.metricDefinition.findMany({
        where: {
          parentId: metric.parentId,
          isActive: true,
          id: { not: metric.id },
        },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
      });
      siblingMetrics = siblings;
    }

    // -----------------------------------------------------------------
    // Child metrics breakdown — BULK fetch all child entries at once
    // Replaces M per-child queries with 1 bulk query.
    // -----------------------------------------------------------------

    const childMetricDefs = await prisma.metricDefinition.findMany({
      where: { parentId: metric.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });

    const childMetricIds = childMetricDefs.map((c) => c.id);

    // Bulk fetch all child metric entries across all divisions
    const allChildEntries =
      childMetricIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: { in: childMetricIds },
              divisionId: { in: divisionIds },
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
        : [];

    // Index child entries by metricDefinitionId
    const childEntriesByMetric = new Map<string, EntryRow[]>();
    for (const e of allChildEntries) {
      if (!childEntriesByMetric.has(e.metricDefinitionId))
        childEntriesByMetric.set(e.metricDefinitionId, []);
      childEntriesByMetric.get(e.metricDefinitionId)!.push(e);
    }

    const childMetrics = childMetricDefs.map((child) => {
      const childEntries = childEntriesByMetric.get(child.id) ?? [];
      const childAgg = aggregateByPeriodWeighted(childEntries, dataType, aggType);
      const childValues = childAgg.map((s) => s.value);
      const childCurrent = childValues.length > 0 ? childValues[childValues.length - 1] : 0;
      const childPrevious = childValues.length > 1 ? childValues[childValues.length - 2] : 0;

      let childTrend = 0;
      if (childPrevious !== 0) {
        childTrend = ((childCurrent - childPrevious) / Math.abs(childPrevious)) * 100;
      }

      return {
        id: child.id,
        name: child.name,
        slug: child.slug,
        currentValue: childCurrent,
        trend: Math.round(childTrend * 10) / 10,
        data: childAgg.map((s) => ({
          period: formatPeriod(s.periodStart),
          value: s.value,
        })),
      };
    });

    // -----------------------------------------------------------------
    // SPC Data
    // -----------------------------------------------------------------

    const spcData = await computeSPCData(
      {
        metricId: metric.id,
        dataType: metric.dataType,
        spcSigmaLevel: metric.spcSigmaLevel,
        baselineStart: metric.baselineStart,
        baselineEnd: metric.baselineEnd,
        entryWhereClause: {
          metricDefinitionId: metric.id,
          regionId: { not: null },
          ...periodStartFilter,
        },
      },
      chartData
    );

    // -----------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------

    const department = await prisma.department.findUnique({
      where: { id: metric.departmentId },
      select: { id: true, name: true, slug: true },
    });

    const result = {
      id: metric.id,
      name: metric.name,
      slug: metric.slug,
      description: metric.description,
      dataDefinition: metric.dataDefinition,
      methodology: metric.methodology,
      unit: metric.unit,
      format: metric.format,
      chartType: metric.chartType,
      category: metric.categoryLegacy,
      target: metric.target,
      rateMultiplier: metric.rateMultiplier ?? null,
      rateSuffix: metric.rateSuffix ?? null,
      dataType: metric.dataType,
      spcSigmaLevel: metric.spcSigmaLevel,
      baselineStart: metric.baselineStart?.toISOString() ?? null,
      baselineEnd: metric.baselineEnd?.toISOString() ?? null,
      spcData,
      division: { id: "all", name: "All Divisions", slug: "" },
      department: department
        ? { id: department.id, name: department.name, slug: department.slug }
        : { id: "", name: "", slug: "" },
      parentMetric,
      siblingMetrics,
      childMetrics,
      chartData,
      stats: {
        current,
        previous,
        trend: Math.round(trend * 10) / 10,
        average: Math.round(average * 100) / 100,
        min,
        max,
        count: values.length,
      },
      annotations: filteredAnnotations.map((a) => ({
        id: a.id,
        date: a.date.toISOString(),
        title: a.title,
        description: a.description,
        type: a.type,
      })),
      resources: metric.resources.map((r) => ({
        id: r.id,
        title: r.title,
        url: r.url,
        type: r.type,
      })),
      responsibleParties: metric.responsibleParties.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        email: p.email,
      })),
      divisionBreakdown,
      hierarchy,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Global metric detail error:", error);
    return NextResponse.json({ error: "Failed to fetch metric details" }, { status: 500 });
  }
}
