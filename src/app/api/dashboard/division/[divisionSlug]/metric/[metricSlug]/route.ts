import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import { aggregateByPeriodWeighted, type AggregationType, type MetricDataType } from "@/lib/aggregation";
import { computeSPCData } from "@/lib/spc-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/division/[divisionSlug]/metric/[metricSlug]
 *
 * Returns full detail data for a single metric scoped to a division.
 * Aggregates from region-level (department-level) entries and shows a
 * department breakdown instead of division breakdown.
 *
 * Optimised: bulk fetches region + child entries in 1 query each, then partitions in JS.
 * Previously ran N+1 queries for per-region and per-child-metric data.
 *
 * Supports ?range=1mo|3mo|6mo|1yr|ytd|all|custom:YYYY-MM-DD:YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ divisionSlug: string; metricSlug: string }> }
) {
  try {
    const { divisionSlug, metricSlug } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "ytd";

    const dateFilter = parseDateRangeFilter(range);
    const periodStartFilter =
      Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

    const isUnassigned = divisionSlug === "unassigned";

    // Look up the division (or handle virtual "unassigned")
    let division: { id: string; name: string; slug: string; departmentId: string } | null = null;

    if (!isUnassigned) {
      division = await prisma.division.findFirst({
        where: { slug: divisionSlug, isActive: true },
        select: { id: true, name: true, slug: true, departmentId: true },
      });

      if (!division) {
        return NextResponse.json(
          { error: "Division not found" },
          { status: 404 }
        );
      }
    }

    // Find the metric
    let metric;
    if (isUnassigned) {
      const allAssociations = await prisma.metricAssociation.findMany({
        where: { divisionId: { not: null } },
        select: { metricDefinitionId: true },
      });
      const associatedMetricIds = new Set(allAssociations.map((a) => a.metricDefinitionId));

      metric = await prisma.metricDefinition.findFirst({
        where: {
          slug: metricSlug,
          isActive: true,
          id: { notIn: Array.from(associatedMetricIds) },
        },
        include: {
          annotations: { orderBy: { date: "desc" } },
          resources: { orderBy: { sortOrder: "asc" } },
          responsibleParties: { orderBy: { sortOrder: "asc" } },
        },
      });
    } else {
      metric = await prisma.metricDefinition.findFirst({
        where: {
          slug: metricSlug,
          isActive: true,
          metricAssociations: {
            some: { divisionId: division!.id },
          },
        },
        include: {
          annotations: { orderBy: { date: "desc" } },
          resources: { orderBy: { sortOrder: "asc" } },
          responsibleParties: { orderBy: { sortOrder: "asc" } },
        },
      });
    }

    if (!metric) {
      return NextResponse.json(
        { error: "Metric not found" },
        { status: 404 }
      );
    }

    const aggType = metric.aggregationType as AggregationType;
    const dataType = (metric.dataType ?? "continuous") as MetricDataType;

    // -----------------------------------------------------------------
    // Time-series data
    // -----------------------------------------------------------------

    let chartData;
    let values: number[];

    if (isUnassigned) {
      const entries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: metric.id,
          divisionId: null,
          regionId: null,
          ...periodStartFilter,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true },
      });
      chartData = entries.map((e) => ({
        period: formatPeriod(e.periodStart),
        value: e.value,
      }));
      values = entries.map((e) => e.value);
    } else {
      const regionEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: metric.id,
          divisionId: division!.id,
          regionId: { not: null },
          ...periodStartFilter,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true, numerator: true, denominator: true },
      });

      const aggregatedSeries = aggregateByPeriodWeighted(regionEntries, dataType, aggType);
      chartData = aggregatedSeries.map((s) => ({
        period: formatPeriod(s.periodStart),
        value: s.value,
      }));
      values = aggregatedSeries.map((s) => s.value);
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

    const average =
      values.length > 0
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    // -----------------------------------------------------------------
    // Filter annotations to date range
    // -----------------------------------------------------------------

    let filteredAnnotations = metric.annotations;
    if (dateFilter.gte) {
      filteredAnnotations = filteredAnnotations.filter(
        (a) => a.date >= dateFilter.gte!
      );
    }
    if (dateFilter.lte) {
      filteredAnnotations = filteredAnnotations.filter(
        (a) => a.date <= dateFilter.lte!
      );
    }

    // -----------------------------------------------------------------
    // Department (region) breakdown — BULK fetch all region entries at once
    // Replaces N per-region queries with 1 bulk query + JS partitioning.
    // -----------------------------------------------------------------

    let divisionBreakdown: Array<{
      divisionId: string;
      divisionName: string;
      divisionSlug: string;
      currentValue: number;
      trend: number;
      data: Array<{ period: string; value: number }>;
    }> = [];

    if (!isUnassigned) {
      const regionsInDiv = await prisma.region.findMany({
        where: { divisionId: division!.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

      const regionIds = regionsInDiv.map((r) => r.id);

      // Bulk fetch all region-level entries for this metric within this division
      const allRegEntries = regionIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: metric.id,
              divisionId: division!.id,
              regionId: { in: regionIds },
              ...periodStartFilter,
            },
            orderBy: { periodStart: "asc" },
            select: { regionId: true, periodStart: true, value: true },
          })
        : [];

      // Index by regionId
      const entriesByRegion = new Map<string, Array<{ periodStart: Date; value: number }>>();
      for (const e of allRegEntries) {
        const regId = e.regionId;
        if (!regId) continue;
        if (!entriesByRegion.has(regId)) entriesByRegion.set(regId, []);
        entriesByRegion.get(regId)!.push(e);
      }

      divisionBreakdown = regionsInDiv
        .map((region) => {
          const regEntries = entriesByRegion.get(region.id) ?? [];
          if (regEntries.length === 0) return null;

          const regValues = regEntries.map((e) => e.value);
          const regCurrent = regValues[regValues.length - 1];
          const regPrevious =
            regValues.length > 1 ? regValues[regValues.length - 2] : 0;

          let regTrend = 0;
          if (regPrevious !== 0) {
            regTrend =
              ((regCurrent - regPrevious) / Math.abs(regPrevious)) * 100;
          }

          return {
            divisionId: region.id,
            divisionName: region.name,
            divisionSlug: region.id,
            currentValue: regCurrent,
            trend: Math.round(regTrend * 10) / 10,
            data: regEntries.map((e) => ({
              period: formatPeriod(e.periodStart),
              value: e.value,
            })),
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);
    }

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
    // Replaces M per-child queries with 1 bulk query + JS partitioning.
    // -----------------------------------------------------------------

    const childMetricDefs = await prisma.metricDefinition.findMany({
      where: { parentId: metric.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });

    const childMetricIds = childMetricDefs.map((c) => c.id);

    // Bulk fetch all child metric entries
    const allChildEntries = childMetricIds.length > 0
      ? await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: { in: childMetricIds },
            ...(isUnassigned
              ? { divisionId: null, regionId: null }
              : { divisionId: division!.id, regionId: { not: null } }),
            ...periodStartFilter,
          },
          orderBy: { periodStart: "asc" },
          select: { metricDefinitionId: true, periodStart: true, value: true, numerator: true, denominator: true },
        })
      : [];

    // Index child entries by metricDefinitionId
    type EntryRow = { periodStart: Date; value: number; numerator: number | null; denominator: number | null };
    const childEntriesByMetric = new Map<string, EntryRow[]>();
    for (const e of allChildEntries) {
      if (!childEntriesByMetric.has(e.metricDefinitionId)) childEntriesByMetric.set(e.metricDefinitionId, []);
      childEntriesByMetric.get(e.metricDefinitionId)!.push(e);
    }

    const childMetrics = childMetricDefs.map((child) => {
      const childRegionEntries = childEntriesByMetric.get(child.id) ?? [];
      const childAgg = aggregateByPeriodWeighted(childRegionEntries, dataType, aggType);
      const childValues = childAgg.map((s) => s.value);
      const childCurrent =
        childValues.length > 0 ? childValues[childValues.length - 1] : 0;
      const childPrevious =
        childValues.length > 1 ? childValues[childValues.length - 2] : 0;

      let childTrend = 0;
      if (childPrevious !== 0) {
        childTrend =
          ((childCurrent - childPrevious) / Math.abs(childPrevious)) * 100;
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
    // Org hierarchy for this division
    // -----------------------------------------------------------------

    const hierarchyRegions = !isUnassigned && division
      ? await prisma.region.findMany({
          where: { divisionId: division.id, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

    const hierarchy = !isUnassigned && division
      ? [{
          id: division.id,
          name: division.name,
          slug: division.slug,
          departments: hierarchyRegions,
        }]
      : [];

    // -----------------------------------------------------------------
    // SPC Data
    // -----------------------------------------------------------------

    const spcEntryWhere = isUnassigned
      ? { metricDefinitionId: metric.id, divisionId: null, regionId: null, ...periodStartFilter }
      : { metricDefinitionId: metric.id, divisionId: division!.id, regionId: { not: null }, ...periodStartFilter };

    const spcData = await computeSPCData(
      {
        metricId: metric.id,
        dataType: metric.dataType,
        spcSigmaLevel: metric.spcSigmaLevel,
        baselineStart: metric.baselineStart,
        baselineEnd: metric.baselineEnd,
        entryWhereClause: spcEntryWhere,
      },
      chartData
    );

    // -----------------------------------------------------------------
    // Response (same shape as /api/dashboard/metric/[dept]/[metric])
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
      division: isUnassigned
        ? { id: "unassigned", name: "Unassigned", slug: "unassigned" }
        : { id: division!.id, name: division!.name, slug: division!.slug },
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
    console.error("Division metric detail error:", error);
    return NextResponse.json(
      { error: "Failed to fetch metric details" },
      { status: 500 }
    );
  }
}
