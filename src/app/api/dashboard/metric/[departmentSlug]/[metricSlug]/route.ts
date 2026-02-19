import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import { computeSPCData } from "@/lib/spc-server";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/metric/[departmentSlug]/[metricSlug]
 *
 * Returns full detail data for a single metric:
 * - Metric definition (including dataDefinition, methodology)
 * - Department info
 * - Time-series chart data (date-range filtered)
 * - Summary statistics (current, previous, trend, avg, min, max)
 * - QI Annotations
 * - Resources
 * - Responsible parties
 * - Division breakdown
 *
 * Optimised: bulk fetches division + child entries in 1 query each, then partitions in JS.
 * Previously ran N+1 queries for per-division and per-child-metric data.
 *
 * Supports ?range=1mo|3mo|6mo|1yr|ytd|all|custom:YYYY-MM-DD:YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ departmentSlug: string; metricSlug: string }> }
) {
  try {
    const { departmentSlug, metricSlug } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "ytd";

    // Parse the range into a Prisma-compatible date filter
    const dateFilter = parseDateRangeFilter(range);
    const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

    // Fetch department
    const department = await prisma.department.findUnique({
      where: { slug: departmentSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Fetch metric definition with related data
    const metric = await prisma.metricDefinition.findUnique({
      where: {
        departmentId_slug: {
          departmentId: department.id,
          slug: metricSlug,
        },
      },
      include: {
        annotations: {
          orderBy: { date: "desc" },
        },
        resources: {
          orderBy: { sortOrder: "asc" },
        },
        responsibleParties: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!metric) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    // -----------------------------------------------------------------------
    // Department-level time-series data (date-range filtered)
    // -----------------------------------------------------------------------

    const entries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId: metric.id,
        departmentId: department.id,
        divisionId: null,
        regionId: null,
        ...periodStartFilter,
      },
      orderBy: { periodStart: "asc" },
      select: { periodStart: true, value: true },
    });

    const chartData = entries.map((e) => ({
      period: formatPeriod(e.periodStart),
      value: e.value,
    }));

    // -----------------------------------------------------------------------
    // Summary statistics
    // -----------------------------------------------------------------------

    const values = entries.map((e) => e.value);
    const current = values.length > 0 ? values[values.length - 1] : 0;
    const previous = values.length > 1 ? values[values.length - 2] : 0;

    let trend = 0;
    if (previous !== 0) {
      trend = ((current - previous) / Math.abs(previous)) * 100;
    }

    const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    // -----------------------------------------------------------------------
    // Filter annotations to date range
    // -----------------------------------------------------------------------

    let filteredAnnotations = metric.annotations;
    if (dateFilter.gte) {
      filteredAnnotations = filteredAnnotations.filter((a) => a.date >= dateFilter.gte!);
    }
    if (dateFilter.lte) {
      filteredAnnotations = filteredAnnotations.filter((a) => a.date <= dateFilter.lte!);
    }

    // -----------------------------------------------------------------------
    // QI Annotations — combine manual annotations + PDSA cycle "Do" dates
    // -----------------------------------------------------------------------

    // Fetch PDSA cycles linked to this metric:
    // 1. Directly via metricDefinitionId
    // 2. Indirectly via driverDiagram.metricDefinitionId
    const pdsaCycles = await prisma.pdsaCycle.findMany({
      where: {
        doStartDate: { not: null },
        OR: [
          { metricDefinitionId: metric.id },
          { driverDiagram: { metricDefinitionId: metric.id } },
        ],
      },
      select: {
        id: true,
        title: true,
        doStartDate: true,
        cycleNumber: true,
      },
      orderBy: { doStartDate: "asc" },
    });

    // Filter PDSA cycles to date range
    let filteredPdsa = pdsaCycles;
    if (dateFilter.gte) {
      filteredPdsa = filteredPdsa.filter((p) => p.doStartDate! >= dateFilter.gte!);
    }
    if (dateFilter.lte) {
      filteredPdsa = filteredPdsa.filter((p) => p.doStartDate! <= dateFilter.lte!);
    }

    // Build unified qiAnnotations array
    const qiAnnotations = [
      ...filteredAnnotations.map((a) => ({
        id: a.id,
        date: a.date.toISOString(),
        period: format(a.date, "MMM yyyy"),
        label: a.title,
        type: "annotation" as const,
      })),
      ...filteredPdsa.map((p) => ({
        id: p.id,
        date: p.doStartDate!.toISOString(),
        period: format(p.doStartDate!, "MMM yyyy"),
        label: `PDSA #${p.cycleNumber}: ${p.title}`,
        type: "pdsa" as const,
      })),
    ];

    // -----------------------------------------------------------------------
    // Division breakdown — BULK fetch all division entries at once
    // Replaces N per-division queries with 1 bulk query + JS partitioning.
    // -----------------------------------------------------------------------

    const divisions = await prisma.division.findMany({
      where: {
        departmentId: department.id,
        isActive: true,
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });

    const divisionIds = divisions.map((d) => d.id);

    // Bulk fetch all division-level entries for this metric
    const allDivEntries =
      divisionIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: metric.id,
              departmentId: department.id,
              divisionId: { in: divisionIds },
              regionId: null,
              ...periodStartFilter,
            },
            orderBy: { periodStart: "asc" },
            select: { divisionId: true, periodStart: true, value: true },
          })
        : [];

    // Index by divisionId
    const entriesByDivision = new Map<string, Array<{ periodStart: Date; value: number }>>();
    for (const e of allDivEntries) {
      const divId = e.divisionId;
      if (!divId) continue;
      if (!entriesByDivision.has(divId)) entriesByDivision.set(divId, []);
      entriesByDivision.get(divId)!.push(e);
    }

    const divisionBreakdown = divisions
      .map((div) => {
        const divEntries = entriesByDivision.get(div.id) ?? [];
        if (divEntries.length === 0) return null;

        const divValues = divEntries.map((e) => e.value);
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
          data: divEntries.map((e) => ({
            period: formatPeriod(e.periodStart),
            value: e.value,
          })),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    // -----------------------------------------------------------------------
    // Parent metric info (if this is a child metric)
    // -----------------------------------------------------------------------

    let parentMetric = null;
    let siblingMetrics: Array<{ id: string; name: string; slug: string }> = [];
    if (metric.parentId) {
      const parent = await prisma.metricDefinition.findUnique({
        where: { id: metric.parentId },
        select: { id: true, name: true, slug: true },
      });
      parentMetric = parent;

      // Also fetch sibling metrics (other children of the same parent, excluding self)
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

    // -----------------------------------------------------------------------
    // Child metrics breakdown — BULK fetch all child entries at once
    // Replaces M per-child queries with 1 bulk query + JS partitioning.
    // -----------------------------------------------------------------------

    const childMetricDefs = await prisma.metricDefinition.findMany({
      where: { parentId: metric.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    });

    const childMetricIds = childMetricDefs.map((c) => c.id);

    // Bulk fetch all child metric entries
    const allChildEntries =
      childMetricIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: { in: childMetricIds },
              departmentId: department.id,
              divisionId: null,
              regionId: null,
              ...periodStartFilter,
            },
            orderBy: { periodStart: "asc" },
            select: { metricDefinitionId: true, periodStart: true, value: true },
          })
        : [];

    // Index child entries by metricDefinitionId
    const childEntriesByMetric = new Map<string, Array<{ periodStart: Date; value: number }>>();
    for (const e of allChildEntries) {
      if (!childEntriesByMetric.has(e.metricDefinitionId))
        childEntriesByMetric.set(e.metricDefinitionId, []);
      childEntriesByMetric.get(e.metricDefinitionId)!.push(e);
    }

    const childMetrics = childMetricDefs.map((child) => {
      const childEntries = childEntriesByMetric.get(child.id) ?? [];
      const childValues = childEntries.map((e) => e.value);
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
        data: childEntries.map((e) => ({
          period: formatPeriod(e.periodStart),
          value: e.value,
        })),
      };
    });

    // -----------------------------------------------------------------------
    // SPC Data
    // -----------------------------------------------------------------------

    const spcData = await computeSPCData(
      {
        metricId: metric.id,
        dataType: metric.dataType,
        spcSigmaLevel: metric.spcSigmaLevel,
        baselineStart: metric.baselineStart,
        baselineEnd: metric.baselineEnd,
        entryWhereClause: {
          metricDefinitionId: metric.id,
          departmentId: department.id,
          divisionId: null,
          regionId: null,
          ...periodStartFilter,
        },
      },
      chartData
    );

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------

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
      department: {
        id: department.id,
        name: department.name,
        slug: department.slug,
      },
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
      qiAnnotations,
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
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Metric detail error:", error);
    return NextResponse.json({ error: "Failed to fetch metric details" }, { status: 500 });
  }
}
