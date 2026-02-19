import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/overview
 *
 * Returns all active departments with their KPI data (latest values, trends, sparklines).
 *
 * Optimised: fetches all KPI entries in a single bulk query, then partitions in JS.
 * Previously ran 2 queries per metric (N+1); now runs 2 total queries regardless of metric count.
 */
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        metricDefinitions: {
          where: { isActive: true, isKpi: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    // Collect all KPI metric IDs across all departments
    const allKpiMetricIds: string[] = [];
    const metricDeptMap = new Map<string, string>(); // metricId -> deptId
    for (const dept of departments) {
      for (const metric of dept.metricDefinitions) {
        allKpiMetricIds.push(metric.id);
        metricDeptMap.set(metric.id, dept.id);
      }
    }

    // BULK FETCH: all department-level entries for all KPI metrics in one query
    // This replaces 2*N individual queries with 1 bulk query.
    const allEntries =
      allKpiMetricIds.length > 0
        ? await prisma.metricEntry.findMany({
            where: {
              metricDefinitionId: { in: allKpiMetricIds },
              divisionId: null,
              regionId: null,
            },
            orderBy: { periodStart: "asc" },
            select: {
              metricDefinitionId: true,
              departmentId: true,
              periodStart: true,
              value: true,
            },
          })
        : [];

    // Index entries by (metricId, deptId) for fast lookup
    const entryIndex = new Map<string, Array<{ periodStart: Date; value: number }>>();
    for (const e of allEntries) {
      const key = `${e.metricDefinitionId}|${e.departmentId}`;
      if (!entryIndex.has(key)) entryIndex.set(key, []);
      entryIndex.get(key)!.push(e);
    }

    // Build result per department — all in-memory, no more per-metric queries
    const result = departments.map((dept) => {
      const kpis = dept.metricDefinitions.map((metric) => {
        const key = `${metric.id}|${dept.id}`;
        const entries = entryIndex.get(key) ?? [];

        // Entries are sorted ascending by periodStart from the query.
        // Recent: last 2 entries for current/previous values
        const recent = entries.slice(-2);
        const currentValue = recent.length > 0 ? recent[recent.length - 1].value : 0;
        const previousValue = recent.length > 1 ? recent[recent.length - 2].value : 0;

        // Calculate trend
        let trend = 0;
        if (previousValue !== 0) {
          trend = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
        }

        // Sparkline: last 6 data points
        const sparkline = entries.slice(-6).map((e) => e.value);

        return {
          metricId: metric.id,
          metricSlug: metric.slug,
          departmentSlug: dept.slug,
          name: metric.name,
          currentValue,
          previousValue,
          unit: metric.unit,
          target: metric.target,
          trend: Math.round(trend * 10) / 10,
          sparkline,
          chartType: metric.chartType,
          category: metric.categoryLegacy,
        };
      });

      return {
        id: dept.id,
        name: dept.name,
        slug: dept.slug,
        type: dept.type,
        kpis,
      };
    });

    return NextResponse.json({ departments: result });
  } catch (error) {
    console.error("Dashboard overview error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard overview" }, { status: 500 });
  }
}
