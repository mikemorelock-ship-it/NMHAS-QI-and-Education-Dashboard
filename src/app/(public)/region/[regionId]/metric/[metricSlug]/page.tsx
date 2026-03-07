import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatPeriod, parseDateRangeFilter } from "@/lib/utils";
import { computeSPCData } from "@/lib/spc-server";
import { fillMissingPeriods } from "@/lib/fill-missing-periods";
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
import type { ChartDataPoint, MetricAnnotation } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ regionId: string; metricSlug: string }>;
}

export default async function RegionMetricDetailPage({ params }: PageProps) {
  const { regionId, metricSlug } = await params;

  // Fetch the region
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    select: { id: true, name: true, divisionId: true },
  });

  if (!region) notFound();

  // Fetch the division
  const division = await prisma.division.findUnique({
    where: { id: region.divisionId },
    select: { id: true, name: true, slug: true, departmentId: true },
  });

  if (!division) notFound();

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

  if (!metric) notFound();

  // Default date range
  const dateFilter = parseDateRangeFilter("ytd");
  const periodStartFilter = Object.keys(dateFilter).length > 0 ? { periodStart: dateFilter } : {};

  // Time-series data for this region
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

  const chartData: ChartDataPoint[] = fillMissingPeriods(
    entries.map((e) => ({
      period: formatPeriod(e.periodStart),
      value: e.value,
    }))
  );

  const values = entries.map((e) => e.value);
  const current = values.length > 0 ? values[values.length - 1] : 0;
  const previous = values.length > 1 ? values[values.length - 2] : 0;

  let trend = 0;
  if (previous !== 0) {
    trend = ((current - previous) / Math.abs(previous)) * 100;
  }

  const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

  // Org hierarchy
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

  // Parent / sibling metrics
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

  // Annotations
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

  // Department entity
  const department = await prisma.department.findUnique({
    where: { id: division.departmentId },
    select: { id: true, name: true, slug: true },
  });

  // SPC Data
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
            <BreadcrumbLink href={`/metric/${metricSlug}`}>All Divisions</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/division/${division.slug}/metric/${metricSlug}`}>
              {division.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{region.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Back button */}
      <div className="flex items-center gap-4">
        <Link href={`/division/${division.slug}/metric/${metricSlug}`}>
          <Button variant="outline" size="sm" className="gap-2 min-h-12 touch-manipulation">
            <ArrowLeft className="size-4" />
            Back to {division.name}
          </Button>
        </Link>
      </div>

      {/* Interactive metric detail (reused client component) */}
      <MetricDetailClient
        departmentSlug={department?.slug ?? ""}
        metricSlug={metricSlug}
        apiBasePath={`/api/dashboard/region/${regionId}/metric/${metricSlug}`}
        viewContext="region"
        contextLabel={region.name}
        contextSublabel={division.name}
        regionId={regionId}
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
          desiredDirection: metric.desiredDirection as "up" | "down",
          dataType: metric.dataType as "proportion" | "rate" | "continuous",
          spcSigmaLevel: metric.spcSigmaLevel,
          baselineStart: metric.baselineStart?.toISOString() ?? null,
          baselineEnd: metric.baselineEnd?.toISOString() ?? null,
          spcData: spcData ?? undefined,
          division: {
            id: division.id,
            name: division.name,
            slug: division.slug,
          },
          department: department
            ? {
                id: department.id,
                name: department.name,
                slug: department.slug,
              }
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
          divisionBreakdown: [],
          hierarchy,
        }}
      />
    </div>
  );
}
