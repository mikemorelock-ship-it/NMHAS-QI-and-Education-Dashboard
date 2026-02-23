import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MetricsClient } from "./metrics-client";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_metric_defs")) {
    notFound();
  }

  const [metrics, departments, divisions, regions, associations] = await Promise.all([
    prisma.metricDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        department: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { metricEntries: true, children: true } },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.division.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.region.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, divisionId: true },
    }),
    prisma.metricAssociation.findMany({
      select: {
        metricDefinitionId: true,
        divisionId: true,
        regionId: true,
      },
    }),
  ]);

  const metricsData = metrics.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    departmentId: m.departmentId,
    departmentName: m.department.name,
    parentId: m.parentId ?? null,
    parentName: m.parent?.name ?? null,
    unit: m.unit,
    chartType: m.chartType,
    periodType: m.periodType,
    category: m.categoryLegacy,
    isKpi: m.isKpi,
    target: m.target,
    aggregationType: m.aggregationType,
    dataType: m.dataType,
    spcSigmaLevel: m.spcSigmaLevel,
    baselineStart: m.baselineStart ? m.baselineStart.toISOString().split("T")[0] : null,
    baselineEnd: m.baselineEnd ? m.baselineEnd.toISOString().split("T")[0] : null,
    numeratorLabel: m.numeratorLabel ?? null,
    denominatorLabel: m.denominatorLabel ?? null,
    rateMultiplier: m.rateMultiplier ?? null,
    rateSuffix: m.rateSuffix ?? null,
    desiredDirection: m.desiredDirection,
    sortOrder: m.sortOrder,
    description: m.description,
    dataDefinition: m.dataDefinition,
    methodology: m.methodology,
    isActive: m.isActive,
    entriesCount: m._count.metricEntries,
    childrenCount: m._count.children,
  }));

  // Build a map of metricId -> associations for the client
  const associationsMap: Record<string, { divisionIds: string[]; regionIds: string[] }> = {};
  for (const a of associations) {
    if (!associationsMap[a.metricDefinitionId]) {
      associationsMap[a.metricDefinitionId] = {
        divisionIds: [],
        regionIds: [],
      };
    }
    if (a.divisionId) {
      associationsMap[a.metricDefinitionId].divisionIds.push(a.divisionId);
    }
    if (a.regionId) {
      associationsMap[a.metricDefinitionId].regionIds.push(a.regionId);
    }
  }

  return (
    <MetricsClient
      metrics={metricsData}
      departments={departments}
      divisions={divisions}
      regions={regions}
      associationsMap={associationsMap}
    />
  );
}
