import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DataEntryClient } from "./data-entry-client";
import { parsePagination } from "@/lib/pagination";
import { getTemplateLookupData } from "@/actions/upload";

export const dynamic = "force-dynamic";

export default async function DataEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "enter_metric_data")) {
    notFound();
  }

  const params = await searchParams;
  const prefill = {
    metricId: typeof params.metricId === "string" ? params.metricId : undefined,
    periodType: typeof params.periodType === "string" ? params.periodType : undefined,
  };

  // Parse pagination params (default 50 entries per page for data entry)
  const { page, pageSize } = parsePagination(params, { pageSize: 50 });
  const skip = (page - 1) * pageSize;

  const [metrics, divisions, regions, recentEntries, associations, totalEntryCount, uploadLookup] =
    await Promise.all([
      prisma.metricDefinition.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          departmentId: true,
          unit: true,
          periodType: true,
          dataType: true,
          numeratorLabel: true,
          denominatorLabel: true,
          rateMultiplier: true,
          rateSuffix: true,
        },
      }),
      prisma.division.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.region.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, divisionId: true, role: true },
      }),
      prisma.metricEntry.findMany({
        skip,
        take: pageSize,
        orderBy: { periodStart: "desc" },
        include: {
          metricDefinition: {
            select: {
              name: true,
              unit: true,
              dataType: true,
              rateMultiplier: true,
              rateSuffix: true,
            },
          },
          division: { select: { name: true } },
          region: { select: { name: true } },
          createdBy: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.metricAssociation.findMany({
        select: {
          metricDefinitionId: true,
          divisionId: true,
          regionId: true,
        },
      }),
      prisma.metricEntry.count(),
      hasAdminPermission(session.role, "upload_batch_data")
        ? getTemplateLookupData()
        : Promise.resolve(null),
    ]);

  // Build associations map: metricId -> { divisionIds[], regionIds[] }
  const associationsMap: Record<string, { divisionIds: string[]; regionIds: string[] }> = {};
  for (const a of associations) {
    if (!associationsMap[a.metricDefinitionId]) {
      associationsMap[a.metricDefinitionId] = { divisionIds: [], regionIds: [] };
    }
    if (a.divisionId) {
      associationsMap[a.metricDefinitionId].divisionIds.push(a.divisionId);
    }
    if (a.regionId) {
      associationsMap[a.metricDefinitionId].regionIds.push(a.regionId);
    }
  }

  const entriesData = recentEntries.map((e) => ({
    id: e.id,
    metricDefinitionId: e.metricDefinitionId,
    metricName: e.metricDefinition.name,
    metricUnit: e.metricDefinition.unit,
    metricDataType: e.metricDefinition.dataType,
    metricRateMultiplier: e.metricDefinition.rateMultiplier,
    metricRateSuffix: e.metricDefinition.rateSuffix,
    departmentId: e.departmentId,
    divisionId: e.divisionId ?? null,
    divisionName: e.division?.name ?? null,
    regionId: e.regionId ?? null,
    regionName: e.region?.name ?? null,
    periodType: e.periodType,
    periodStart: e.periodStart.toISOString(),
    value: e.value,
    numerator: e.numerator,
    denominator: e.denominator,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
    createdByName: e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}` : null,
  }));

  const totalPages = Math.max(1, Math.ceil(totalEntryCount / pageSize));
  const paginationMeta = {
    page: Math.min(page, totalPages),
    pageSize,
    totalItems: totalEntryCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  return (
    <DataEntryClient
      metrics={metrics}
      divisions={divisions}
      regions={regions}
      recentEntries={entriesData}
      associationsMap={associationsMap}
      prefill={prefill}
      totalEntryCount={totalEntryCount}
      pagination={paginationMeta}
      uploadLookup={uploadLookup}
    />
  );
}
