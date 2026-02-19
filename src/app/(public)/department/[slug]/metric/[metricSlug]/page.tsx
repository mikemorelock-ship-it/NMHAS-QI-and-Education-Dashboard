import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
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
import { MetricDetailClient } from "./MetricDetailClient";
import type {
  ChartDataPoint,
  MetricAnnotation,
  DivisionMetricBreakdown,
  ChildMetricSummary,
} from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; metricSlug: string }>;
}

export default async function MetricDetailPage({ params }: PageProps) {
  const { slug, metricSlug } = await params;

  // Fetch the parent department
  const department = await prisma.department.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!department) {
    notFound();
  }

  // Fetch the metric definition with all related data
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

  if (!metric || !metric.isActive) {
    notFound();
  }

  // -----------------------------------------------------------------------
  // Default date filter (YTD to match client default)
  // -----------------------------------------------------------------------

  const defaultRange = "ytd";
  const dateFilter = parseDateRangeFilter(defaultRange);
  const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

  // -----------------------------------------------------------------------
  // Department-level time-series data (filtered to default range)
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

  const chartData: ChartDataPoint[] = entries.map((e) => ({
    period: formatPeriod(e.periodStart),
    value: e.value,
  }));

  // Summary stats
  const values = entries.map((e) => e.value);
  const current = values.length > 0 ? values[values.length - 1] : 0;
  const previous = values.length > 1 ? values[values.length - 2] : 0;

  let trend = 0;
  if (previous !== 0) {
    trend = ((current - previous) / Math.abs(previous)) * 100;
  }

  const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

  // -----------------------------------------------------------------------
  // Division breakdown
  // -----------------------------------------------------------------------

  const divisions = await prisma.division.findMany({
    where: { departmentId: department.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const divisionBreakdownRaw = await Promise.all(
    divisions.map(async (div) => {
      const divEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: metric.id,
          departmentId: department.id,
          divisionId: div.id,
          regionId: null,
          ...periodStartFilter,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true },
      });

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
  );

  const divisionBreakdown: DivisionMetricBreakdown[] = divisionBreakdownRaw.filter(
    (d): d is NonNullable<typeof d> => d !== null
  );

  // -----------------------------------------------------------------------
  // Parent metric info
  // -----------------------------------------------------------------------

  let parentMetric: { id: string; name: string; slug: string } | null = null;
  let siblingMetrics: { id: string; name: string; slug: string }[] = [];
  if (metric.parentId) {
    const parent = await prisma.metricDefinition.findUnique({
      where: { id: metric.parentId },
      select: { id: true, name: true, slug: true },
    });
    parentMetric = parent;

    // Fetch sibling metrics (other children of the same parent, excluding self)
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
  // Child metrics breakdown
  // -----------------------------------------------------------------------

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
          departmentId: department.id,
          divisionId: null,
          regionId: null,
          ...periodStartFilter,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true },
      });

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
    })
  );

  // -----------------------------------------------------------------------
  // Serialize annotations for client
  // -----------------------------------------------------------------------

  let filteredAnnotations = metric.annotations;
  if (dateFilter.gte) {
    filteredAnnotations = filteredAnnotations.filter((a) => a.date >= dateFilter.gte!);
  }
  if (dateFilter.lte) {
    filteredAnnotations = filteredAnnotations.filter((a) => a.date <= dateFilter.lte!);
  }

  const annotations: MetricAnnotation[] = filteredAnnotations.map((a) => ({
    id: a.id,
    date: a.date.toISOString(),
    title: a.title,
    description: a.description,
    type: a.type as MetricAnnotation["type"],
  }));

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
            <BreadcrumbLink href={`/department/${slug}`}>{department.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{metric.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back button */}
      <div className="flex items-center gap-4">
        <Link href={`/department/${slug}`}>
          <Button variant="outline" size="sm" className="gap-2 min-h-12 touch-manipulation">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* Interactive metric detail (client component) */}
      <MetricDetailClient
        departmentSlug={slug}
        metricSlug={metricSlug}
        viewContext="department"
        contextLabel={department.name}
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
          division: {
            id: department.id,
            name: department.name,
            slug: department.slug,
          },
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
            min: values.length > 0 ? Math.min(...values) : 0,
            max: values.length > 0 ? Math.max(...values) : 0,
            count: values.length,
          },
          annotations,
          qiAnnotations: [],
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
        }}
      />
    </div>
  );
}
