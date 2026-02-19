import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Parse date range
    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    // Fetch the department with divisions
    const department = await prisma.department.findUnique({
      where: { slug },
      include: {
        divisions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, slug: true },
        },
        metricDefinitions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Build date filter for entries
    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) dateFilter.lte = toDate;
    const periodStartFilter = Object.keys(dateFilter).length > 0 ? dateFilter : undefined;

    // Get KPI metrics and chart metrics
    const kpiMetrics = department.metricDefinitions.filter((m) => m.isKpi);
    const allMetrics = department.metricDefinitions;

    // Build KPI data
    const kpis = await Promise.all(
      kpiMetrics.map(async (metric) => {
        const recentEntries = await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: metric.id,
            departmentId: department.id,
            divisionId: null,
            regionId: null,
          },
          orderBy: { periodStart: "desc" },
          take: 2,
        });

        const currentValue = recentEntries[0]?.value ?? 0;
        const previousValue = recentEntries[1]?.value ?? 0;

        let trend = 0;
        if (previousValue !== 0) {
          trend = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
        }

        const sparklineEntries = await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: metric.id,
            departmentId: department.id,
            divisionId: null,
            regionId: null,
          },
          orderBy: { periodStart: "asc" },
          take: 6,
          select: { value: true },
        });

        return {
          metricId: metric.id,
          name: metric.name,
          currentValue,
          previousValue,
          unit: metric.unit,
          target: metric.target,
          trend: Math.round(trend * 10) / 10,
          sparkline: sparklineEntries.map((e) => e.value),
          chartType: metric.chartType,
          category: metric.categoryLegacy,
        };
      })
    );

    // Build full time-series data for all metrics
    const metrics = await Promise.all(
      allMetrics.map(async (metric) => {
        const entries = await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: metric.id,
            departmentId: department.id,
            divisionId: null,
            regionId: null,
            ...(periodStartFilter ? { periodStart: periodStartFilter } : {}),
          },
          orderBy: { periodStart: "asc" },
          select: { periodStart: true, value: true },
        });

        return {
          id: metric.id,
          name: metric.name,
          unit: metric.unit,
          chartType: metric.chartType,
          category: metric.categoryLegacy,
          target: metric.target,
          data: entries.map((e) => ({
            period: formatPeriod(e.periodStart),
            value: e.value,
          })),
        };
      })
    );

    const result = {
      id: department.id,
      name: department.name,
      slug: department.slug,
      type: department.type,
      description: department.description,
      divisions: department.divisions,
      kpis,
      metrics,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Department detail error:", error);
    return NextResponse.json({ error: "Failed to fetch department details" }, { status: 500 });
  }
}
