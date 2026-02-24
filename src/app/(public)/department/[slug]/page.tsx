import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { formatPeriod } from "@/lib/utils";
import { calculateSPC, type DataType, type SPCDataPoint } from "@/lib/spc";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { DepartmentDashboardClient } from "./DepartmentDashboardClient";
import type { KpiData, MetricChartData, DivisionSummary } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Department detail page (server component).
 *
 * Fetches all KPIs, time-series chart data, and divisions for the department
 * directly via Prisma, then hands them to the client component for rendering.
 */
export default async function DepartmentDetailPage({ params }: PageProps) {
  const { slug } = await params;

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
    notFound();
  }

  // ---------------------------------------------------------------------------
  // Build KPI data (latest value + trend from most recent two entries)
  // ---------------------------------------------------------------------------

  const kpiMetrics = department.metricDefinitions.filter((m) => m.isKpi);

  const kpis: KpiData[] = await Promise.all(
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

      // Fetch all entries for sparkline and SPC
      const allEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: metric.id,
          departmentId: department.id,
          divisionId: null,
          regionId: null,
        },
        orderBy: { periodStart: "asc" },
        select: {
          periodStart: true,
          value: true,
          numerator: true,
          denominator: true,
        },
      });

      // Compute SPC data
      const dt = (metric.dataType ?? "continuous") as DataType;
      let spcData = null;
      if (allEntries.length >= 2 && ["proportion", "rate", "continuous"].includes(dt)) {
        const spcPoints: SPCDataPoint[] = allEntries.map((e) => ({
          period: formatPeriod(e.periodStart),
          value: e.value,
          numerator: e.numerator ?? undefined,
          denominator: e.denominator ?? undefined,
        }));
        const sigmaLevel = metric.spcSigmaLevel;
        const spcOptions: {
          sigmaLevel: 1 | 2 | 3;
          baselineStart?: string;
          baselineEnd?: string;
        } = {
          sigmaLevel: sigmaLevel === 1 || sigmaLevel === 2 || sigmaLevel === 3 ? sigmaLevel : 3,
        };
        if (metric.baselineStart) {
          spcOptions.baselineStart = formatPeriod(metric.baselineStart);
        }
        if (metric.baselineEnd) {
          spcOptions.baselineEnd = formatPeriod(metric.baselineEnd);
        }
        spcData = calculateSPC(dt, spcPoints, spcOptions);
      }

      return {
        metricId: metric.id,
        metricSlug: metric.slug,
        divisionSlug: slug,
        name: metric.name,
        currentValue,
        previousValue,
        unit: metric.unit,
        target: metric.target,
        trend: Math.round(trend * 10) / 10,
        sparkline: allEntries.slice(-12).map((e) => e.value),
        chartType: metric.chartType,
        category: metric.categoryLegacy,
        spcData,
      };
    })
  );

  // ---------------------------------------------------------------------------
  // Build time-series chart data for ALL metrics
  // ---------------------------------------------------------------------------

  const metrics: MetricChartData[] = await Promise.all(
    department.metricDefinitions.map(async (metric) => {
      const entries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: metric.id,
          departmentId: department.id,
          divisionId: null,
          regionId: null,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true },
      });

      return {
        id: metric.id,
        slug: metric.slug,
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

  const divisions: DivisionSummary[] = department.divisions;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* Breadcrumb navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{department.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Page title + description */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{department.name}</h1>
        {department.description && (
          <p className="text-muted-foreground mt-1">{department.description}</p>
        )}
      </div>

      {/* Interactive dashboard (client component) */}
      <DepartmentDashboardClient
        departmentSlug={slug}
        kpis={kpis}
        metrics={metrics}
        divisions={divisions}
      />
    </div>
  );
}
