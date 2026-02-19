import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPeriod } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { DivisionDashboardClient } from "./DivisionDashboardClient";
import type { MetricChartData, KpiData } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; divisionSlug: string }>;
}

/**
 * Build KPI data from time-series entries for a set of metric definitions.
 */
function buildKpis(
  metricDefinitions: Array<{
    id: string;
    slug: string;
    name: string;
    unit: string;
    chartType: string;
    categoryLegacy: string | null;
    target: number | null;
    isKpi: boolean;
  }>,
  entriesByMetric: Map<string, Array<{ periodStart: Date; value: number }>>,
  departmentSlug: string
): KpiData[] {
  return metricDefinitions
    .filter((m) => m.isKpi)
    .map((metric) => {
      const entries = entriesByMetric.get(metric.id) ?? [];
      // Sort descending by period to get latest two
      const sorted = [...entries].sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime());
      const currentValue = sorted[0]?.value ?? 0;
      const previousValue = sorted[1]?.value ?? 0;

      let trend = 0;
      if (previousValue !== 0) {
        trend = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      }

      // Sparkline: chronological order
      const sparkline = [...entries]
        .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
        .map((e) => e.value);

      return {
        metricId: metric.id,
        metricSlug: metric.slug,
        divisionSlug: departmentSlug,
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
}

export default async function DivisionDetailPage({ params }: PageProps) {
  const { slug, divisionSlug } = await params;

  // Fetch the parent department
  const department = await prisma.department.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!department) {
    notFound();
  }

  // Fetch the division with its regions
  const division = await prisma.division.findFirst({
    where: {
      departmentId: department.id,
      slug: divisionSlug,
      isActive: true,
    },
    include: {
      regions: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true },
      },
    },
  });

  if (!division) {
    notFound();
  }

  // Get all metric definitions for this department
  const metricDefinitions = await prisma.metricDefinition.findMany({
    where: {
      departmentId: department.id,
      isActive: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  // ---------------------------------------------------------------------------
  // Division-level data
  // ---------------------------------------------------------------------------

  const divisionEntries = await prisma.metricEntry.findMany({
    where: {
      departmentId: department.id,
      divisionId: division.id,
      regionId: null,
    },
    orderBy: { periodStart: "asc" },
    select: {
      metricDefinitionId: true,
      periodStart: true,
      value: true,
    },
  });

  // Group entries by metric
  const divEntriesByMetric = new Map<string, Array<{ periodStart: Date; value: number }>>();
  for (const entry of divisionEntries) {
    const arr = divEntriesByMetric.get(entry.metricDefinitionId) ?? [];
    arr.push({ periodStart: entry.periodStart, value: entry.value });
    divEntriesByMetric.set(entry.metricDefinitionId, arr);
  }

  // Build division-level charts
  const divisionMetrics: MetricChartData[] = metricDefinitions
    .map((metric) => {
      const entries = divEntriesByMetric.get(metric.id) ?? [];
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
    .filter((m) => m.data.length > 0);

  // Build division-level KPIs
  const divisionKpis = buildKpis(metricDefinitions, divEntriesByMetric, slug);

  // ---------------------------------------------------------------------------
  // Per-region data (sub-units like Air Care 1-7, Ground bases)
  // ---------------------------------------------------------------------------

  const regionsWithData = await Promise.all(
    division.regions.map(async (region) => {
      const regionEntries = await prisma.metricEntry.findMany({
        where: {
          departmentId: department.id,
          divisionId: division.id,
          regionId: region.id,
        },
        orderBy: { periodStart: "asc" },
        select: {
          metricDefinitionId: true,
          periodStart: true,
          value: true,
        },
      });

      // Group by metric
      const entriesByMetric = new Map<string, Array<{ periodStart: Date; value: number }>>();
      for (const entry of regionEntries) {
        const arr = entriesByMetric.get(entry.metricDefinitionId) ?? [];
        arr.push({ periodStart: entry.periodStart, value: entry.value });
        entriesByMetric.set(entry.metricDefinitionId, arr);
      }

      // Build charts
      const regionMetrics: MetricChartData[] = metricDefinitions
        .map((metric) => {
          const entries = entriesByMetric.get(metric.id) ?? [];
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
        .filter((m) => m.data.length > 0);

      // Build KPIs
      const regionKpis = buildKpis(metricDefinitions, entriesByMetric, slug);

      return {
        id: region.id,
        name: region.name,
        role: region.role,
        metrics: regionMetrics,
        kpis: regionKpis,
      };
    })
  );

  // Only include regions that actually have data
  const regionsFiltered = regionsWithData.filter((p) => p.metrics.length > 0 || p.kpis.length > 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/department/${slug}`}>{department.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{division.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back button + title */}
      <div className="flex items-center gap-4">
        <Link href={`/department/${slug}`}>
          <Button variant="outline" size="sm" className="gap-2 min-h-12 touch-manipulation">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{division.name}</h1>
      </div>

      {/* Division dashboard with region filtering */}
      <DivisionDashboardClient
        departmentSlug={slug}
        metrics={divisionMetrics}
        kpis={divisionKpis}
        individuals={regionsFiltered}
      />
    </div>
  );
}
