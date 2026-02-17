import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import {
  aggregateByPeriodWeighted,
  type AggregationType,
  type MetricDataType,
} from "@/lib/aggregation";
import { computeSPCData } from "@/lib/spc-server";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { MetricDetailClient } from "@/app/(public)/department/[slug]/metric/[metricSlug]/MetricDetailClient";
import type {
  ChartDataPoint,
  MetricAnnotation,
  DivisionMetricBreakdown,
  ChildMetricSummary,
} from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ metricSlug: string }>;
}

export default async function GlobalMetricDetailPage({ params }: PageProps) {
  const { metricSlug } = await params;

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
    notFound();
  }

  const aggType = metric.aggregationType as AggregationType;
  const dataType = (metric.dataType ?? "continuous") as MetricDataType;

  // Default date range
  const dateFilter = parseDateRangeFilter("ytd");
  const periodStartFilter =
    Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

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

  // -----------------------------------------------------------------------
  // Global time series — flat aggregation across ALL region entries
  // -----------------------------------------------------------------------

  // Flat aggregation: gather all region-level entries across all
  // divisions and aggregate directly. This gives each department
  // (region) equal weight, matching the scorecard calculation.
  const allRegionEntries = await prisma.metricEntry.findMany({
    where: {
      metricDefinitionId: metric.id,
      regionId: { not: null },
      ...periodStartFilter,
    },
    orderBy: { periodStart: "asc" },
    select: { periodStart: true, value: true, numerator: true, denominator: true },
  });

  const globalSeries = aggregateByPeriodWeighted(allRegionEntries, dataType, aggType);

  const chartData: ChartDataPoint[] = globalSeries.map((s) => ({
    period: formatPeriod(s.periodStart),
    value: s.value,
  }));

  const values = globalSeries.map((s) => s.value);

  // -----------------------------------------------------------------------
  // Per-division series (for breakdown display only)
  // -----------------------------------------------------------------------

  const perDivisionSeries: Map<
    string,
    { periodStart: Date; value: number }[]
  > = new Map();

  for (const div of divisions) {
    const regionEntries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId: metric.id,
        divisionId: div.id,
        regionId: { not: null },
        ...periodStartFilter,
      },
      orderBy: { periodStart: "asc" },
      select: { periodStart: true, value: true, numerator: true, denominator: true },
    });

    const aggregated = aggregateByPeriodWeighted(regionEntries, dataType, aggType);
    perDivisionSeries.set(div.id, aggregated);
  }

  // -----------------------------------------------------------------------
  // Summary statistics
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Division breakdown
  // -----------------------------------------------------------------------

  const divisionBreakdown: DivisionMetricBreakdown[] = divisions
    .map((div) => {
      const series = perDivisionSeries.get(div.id) ?? [];
      if (series.length === 0) return null;

      const divValues = series.map((s) => s.value);
      const divCurrent = divValues[divValues.length - 1];
      const divPrevious =
        divValues.length > 1 ? divValues[divValues.length - 2] : 0;

      let divTrend = 0;
      if (divPrevious !== 0) {
        divTrend =
          ((divCurrent - divPrevious) / Math.abs(divPrevious)) * 100;
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

  // -----------------------------------------------------------------------
  // Organizational hierarchy
  // -----------------------------------------------------------------------

  const hierarchy = await Promise.all(
    divisions.map(async (div) => {
      const regions = await prisma.region.findMany({
        where: { divisionId: div.id, isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return {
        id: div.id,
        name: div.name,
        slug: div.slug,
        departments: regions,
      };
    })
  );

  // -----------------------------------------------------------------------
  // Parent / sibling / child metrics
  // -----------------------------------------------------------------------

  let parentMetric: { id: string; name: string; slug: string } | null = null;
  let siblingMetrics: { id: string; name: string; slug: string }[] = [];

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

  const childMetricDefs = await prisma.metricDefinition.findMany({
    where: { parentId: metric.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const childMetrics: ChildMetricSummary[] = await Promise.all(
    childMetricDefs.map(async (child) => {
      const childEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: child.id,
          divisionId: { in: divisionIds },
          regionId: { not: null },
          ...periodStartFilter,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true, numerator: true, denominator: true },
      });

      const childAgg = aggregateByPeriodWeighted(childEntries, dataType, aggType);
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
    })
  );

  // -----------------------------------------------------------------------
  // Annotations
  // -----------------------------------------------------------------------

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

  const annotations: MetricAnnotation[] = filteredAnnotations.map((a) => ({
    id: a.id,
    date: a.date.toISOString(),
    title: a.title,
    description: a.description,
    type: a.type as MetricAnnotation["type"],
  }));

  // -----------------------------------------------------------------------
  // Department entity (for backward compatibility)
  // -----------------------------------------------------------------------

  const department = await prisma.department.findUnique({
    where: { id: metric.departmentId },
    select: { id: true, name: true, slug: true },
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
        regionId: { not: null },
        ...periodStartFilter,
      },
    },
    chartData
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
            <BreadcrumbLink href="/">All Divisions</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{metric.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back button */}
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-h-12 touch-manipulation"
          >
            <ArrowLeft className="size-4" />
            Back to All Divisions
          </Button>
        </Link>
      </div>

      {/* Interactive metric detail (reused client component) */}
      <MetricDetailClient
        departmentSlug={department?.slug ?? ""}
        metricSlug={metricSlug}
        apiBasePath={`/api/dashboard/global-metric/${metricSlug}`}
        viewContext="global"
        contextLabel="All Divisions"
        initialData={{
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
          dataType: metric.dataType as "proportion" | "rate" | "continuous",
          spcSigmaLevel: metric.spcSigmaLevel,
          baselineStart: metric.baselineStart?.toISOString() ?? null,
          baselineEnd: metric.baselineEnd?.toISOString() ?? null,
          spcData: spcData ?? undefined,
          division: { id: "all", name: "All Divisions", slug: "" },
          department: department
            ? {
                id: department.id,
                name: department.name,
                slug: department.slug,
              }
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
            min: values.length > 0 ? Math.min(...values) : 0,
            max: values.length > 0 ? Math.max(...values) : 0,
            count: values.length,
          },
          annotations,
          resources: metric.resources.map((r) => ({
            id: r.id,
            title: r.title,
            url: r.url,
            type: r.type as "document" | "link" | "reference" | "protocol",
          })),
          responsibleParties: metric.responsibleParties.map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            email: p.email,
          })),
          divisionBreakdown,
          hierarchy,
        }}
      />
    </div>
  );
}
