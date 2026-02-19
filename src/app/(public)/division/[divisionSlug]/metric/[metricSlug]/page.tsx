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
  params: Promise<{ divisionSlug: string; metricSlug: string }>;
}

export default async function DivisionMetricDetailPage({ params }: PageProps) {
  const { divisionSlug, metricSlug } = await params;

  const isUnassigned = divisionSlug === "unassigned";

  // Fetch the division (or handle virtual "unassigned")
  let division: { id: string; name: string; slug: string; departmentId: string } | null = null;

  if (!isUnassigned) {
    division = await prisma.division.findFirst({
      where: { slug: divisionSlug, isActive: true },
      select: { id: true, name: true, slug: true, departmentId: true },
    });

    if (!division) {
      notFound();
    }
  }

  // Fetch the metric definition
  let metric;
  if (isUnassigned) {
    // Unassigned: metric has no division associations
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
    // Normal: metric associated with this division
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

  if (!metric || !metric.isActive) {
    notFound();
  }

  const aggType = metric.aggregationType as AggregationType;
  const dataType = (metric.dataType ?? "continuous") as MetricDataType;

  // -----------------------------------------------------------------------
  // Default date filter (YTD)
  // -----------------------------------------------------------------------

  const defaultRange = "ytd";
  const dateFilter = parseDateRangeFilter(defaultRange);
  const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

  // -----------------------------------------------------------------------
  // Time-series data
  // -----------------------------------------------------------------------

  let chartData: ChartDataPoint[];
  let values: number[];

  if (isUnassigned) {
    // Unassigned: entries at organization level (no division, no region)
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
    // Normal: aggregate from region-level entries
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

  // Summary stats
  const current = values.length > 0 ? values[values.length - 1] : 0;
  const previous = values.length > 1 ? values[values.length - 2] : 0;

  let trend = 0;
  if (previous !== 0) {
    trend = ((current - previous) / Math.abs(previous)) * 100;
  }

  const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

  // -----------------------------------------------------------------------
  // Department (region) breakdown within this division
  // -----------------------------------------------------------------------

  let divisionBreakdown: DivisionMetricBreakdown[] = [];

  if (!isUnassigned) {
    const regionsInDiv = await prisma.region.findMany({
      where: { divisionId: division!.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    const departmentBreakdownRaw = await Promise.all(
      regionsInDiv.map(async (region) => {
        const regEntries = await prisma.metricEntry.findMany({
          where: {
            metricDefinitionId: metric.id,
            divisionId: division!.id,
            regionId: region.id,
            ...periodStartFilter,
          },
          orderBy: { periodStart: "asc" },
          select: { periodStart: true, value: true },
        });

        if (regEntries.length === 0) return null;

        const regValues = regEntries.map((e) => e.value);
        const regCurrent = regValues[regValues.length - 1];
        const regPrevious = regValues.length > 1 ? regValues[regValues.length - 2] : 0;

        let regTrend = 0;
        if (regPrevious !== 0) {
          regTrend = ((regCurrent - regPrevious) / Math.abs(regPrevious)) * 100;
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
    );

    divisionBreakdown = departmentBreakdownRaw.filter(
      (d): d is NonNullable<typeof d> => d !== null
    );
  }

  // -----------------------------------------------------------------------
  // Org hierarchy for this division (reuse regionsInDiv from breakdown)
  // -----------------------------------------------------------------------

  // regionsInDiv is fetched inside the `if (!isUnassigned)` block above.
  // We need to re-fetch or capture it outside. Since it's scoped, just re-query.
  const hierarchyRegions =
    !isUnassigned && division
      ? await prisma.region.findMany({
          where: { divisionId: division.id, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  const hierarchy =
    !isUnassigned && division
      ? [
          {
            id: division.id,
            name: division.name,
            slug: division.slug,
            departments: hierarchyRegions,
          },
        ]
      : [];

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
  // Child metrics breakdown (aggregated from region entries)
  // -----------------------------------------------------------------------

  const childMetricDefs = await prisma.metricDefinition.findMany({
    where: { parentId: metric.id, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const childMetrics: ChildMetricSummary[] = await Promise.all(
    childMetricDefs.map(async (child) => {
      const childRegionEntries = await prisma.metricEntry.findMany({
        where: {
          metricDefinitionId: child.id,
          ...(isUnassigned
            ? { divisionId: null, regionId: null }
            : { divisionId: division!.id, regionId: { not: null } }),
          ...periodStartFilter,
        },
        orderBy: { periodStart: "asc" },
        select: { periodStart: true, value: true, numerator: true, denominator: true },
      });

      const childAgg = aggregateByPeriodWeighted(childRegionEntries, dataType, aggType);
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
    })
  );

  // -----------------------------------------------------------------------
  // Annotations
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
  // Fetch the department (organization) for passing to MetricDetailClient
  // -----------------------------------------------------------------------

  const department = await prisma.department.findUnique({
    where: { id: metric.departmentId },
    select: { id: true, name: true, slug: true },
  });

  // -----------------------------------------------------------------------
  // SPC Data
  // -----------------------------------------------------------------------

  const spcEntryWhere = isUnassigned
    ? { metricDefinitionId: metric.id, divisionId: null, regionId: null, ...periodStartFilter }
    : {
        metricDefinitionId: metric.id,
        divisionId: division!.id,
        regionId: { not: null },
        ...periodStartFilter,
      };

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
            <BreadcrumbLink href={`/?division=${divisionSlug}`}>
              {isUnassigned ? "Unassigned" : division!.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{metric.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back button */}
      <div className="flex items-center gap-4">
        <Link href={`/?division=${divisionSlug}`}>
          <Button variant="outline" size="sm" className="gap-2 min-h-12 touch-manipulation">
            <ArrowLeft className="size-4" />
            Back to {isUnassigned ? "Unassigned" : division!.name}
          </Button>
        </Link>
      </div>

      {/* Interactive metric detail (reused client component) */}
      <MetricDetailClient
        departmentSlug={department?.slug ?? ""}
        metricSlug={metricSlug}
        apiBasePath={`/api/dashboard/division/${divisionSlug}/metric/${metricSlug}`}
        viewContext="division"
        contextLabel={isUnassigned ? "Unassigned" : division!.name}
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
          division: isUnassigned
            ? { id: "unassigned", name: "Unassigned", slug: "unassigned" }
            : { id: division!.id, name: division!.name, slug: division!.slug },
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
          hierarchy,
        }}
      />
    </div>
  );
}
