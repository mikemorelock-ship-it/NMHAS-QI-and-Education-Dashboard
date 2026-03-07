import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import { computeSPCData } from "@/lib/spc-server";
import { fillMissingPeriods } from "@/lib/fill-missing-periods";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/region/[regionId]/metric/[metricSlug]
 *
 * Returns full detail data for a single metric scoped to a specific region
 * (department). This is the leaf-level drill-down — no sub-breakdown.
 *
 * Supports ?range=1mo|3mo|6mo|1yr|ytd|all|custom:YYYY-MM-DD:YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ regionId: string; metricSlug: string }> }
) {
  try {
    const { regionId, metricSlug } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "ytd";

    // Find the latest data point to anchor relative date filters
    const latestEntry = await prisma.metricEntry.findFirst({
      orderBy: { periodStart: "desc" },
      select: { periodStart: true },
    });
    const dateFilter = parseDateRangeFilter(range, latestEntry?.periodStart ?? undefined);
    const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

    // Fetch the region
    const region = await prisma.region.findUnique({
      where: { id: regionId },
      select: { id: true, name: true, divisionId: true },
    });

    if (!region) {
      return NextResponse.json({ error: "Region not found" }, { status: 404 });
    }

    // Fetch the division
    const division = await prisma.division.findUnique({
      where: { id: region.divisionId },
      select: { id: true, name: true, slug: true, departmentId: true },
    });

    if (!division) {
      return NextResponse.json({ error: "Division not found" }, { status: 404 });
    }

    // Find the metric
    const metric = await prisma.metricDefinition.findFirst({
      where: {
        slug: metricSlug,
        isActive: true,
        metricAssociations: {
          some: { divisionId: division.id },
        },
      },
      include: {
        annotations: { orderBy: { date: "desc" } },
        resources: { orderBy: { sortOrder: "asc" } },
        responsibleParties: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!metric) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    // -----------------------------------------------------------------
    // Time-series data for this specific region
    // -----------------------------------------------------------------

    const entries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId: metric.id,
        divisionId: division.id,
        regionId: region.id,
        ...periodStartFilter,
      },
      orderBy: { periodStart: "asc" },
      select: { periodStart: true, value: true },
    });

    const chartData = fillMissingPeriods(
      entries.map((e) => ({
        period: formatPeriod(e.periodStart),
        value: e.value,
      }))
    );

    const values = entries.map((e) => e.value);

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
    // Parent / sibling metrics
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
    // Org hierarchy — show division with regions, mark current region
    // -----------------------------------------------------------------

    const hierarchyRegions = await prisma.region.findMany({
      where: { divisionId: division.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const hierarchy = [
      {
        id: division.id,
        name: division.name,
        slug: division.slug,
        departments: hierarchyRegions.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.id,
        })),
      },
    ];

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
          divisionId: division.id,
          regionId: region.id,
          ...periodStartFilter,
        },
      },
      chartData
    );

    // -----------------------------------------------------------------
    // Department entity
    // -----------------------------------------------------------------

    const department = await prisma.department.findUnique({
      where: { id: division.departmentId },
      select: { id: true, name: true, slug: true },
    });

    // -----------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------

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
      division: {
        id: division.id,
        name: division.name,
        slug: division.slug,
      },
      department: department
        ? { id: department.id, name: department.name, slug: department.slug }
        : { id: "", name: "", slug: "" },
      parentMetric,
      siblingMetrics,
      childMetrics: [],
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
      qiAnnotations: [],
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
      divisionBreakdown: [],
      hierarchy,
      // Additional context for the region view
      regionId: region.id,
      regionName: region.name,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Region metric detail error:", error);
    return NextResponse.json({ error: "Failed to fetch metric details" }, { status: 500 });
  }
}
