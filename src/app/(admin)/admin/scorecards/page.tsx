import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ScorecardsClient } from "./scorecards-client";

export const dynamic = "force-dynamic";

export default async function ScorecardsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_scorecards")) {
    notFound();
  }

  const [scorecards, divisions, regions, allMetrics] = await Promise.all([
    prisma.scorecard.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        scorecardDivisions: {
          include: { division: { select: { id: true, name: true } } },
        },
        scorecardRegions: {
          include: { region: { select: { id: true, name: true } } },
        },
        scorecardMetrics: {
          orderBy: { sortOrder: "asc" },
          select: { metricDefinitionId: true, sortOrder: true, groupName: true },
        },
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
      select: { id: true, name: true, divisionId: true },
    }),
    prisma.metricDefinition.findMany({
      where: { isActive: true, parentId: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, unit: true },
    }),
  ]);

  const data = scorecards.map((sc) => ({
    id: sc.id,
    name: sc.name,
    slug: sc.slug,
    description: sc.description,
    divisionIds: sc.scorecardDivisions.map((sd) => sd.divisionId),
    divisionNames: sc.scorecardDivisions.map((sd) => sd.division.name),
    regionIds: sc.scorecardRegions.map((sr) => sr.regionId),
    regionNames: sc.scorecardRegions.map((sr) => sr.region.name),
    sortOrder: sc.sortOrder,
    isActive: sc.isActive,
    metricIds: sc.scorecardMetrics.map((sm) => sm.metricDefinitionId),
    metricGroups: Object.fromEntries(
      sc.scorecardMetrics
        .filter((sm) => sm.groupName)
        .map((sm) => [sm.metricDefinitionId, sm.groupName!])
    ),
    metricCount: sc.scorecardMetrics.length,
  }));

  return (
    <ScorecardsClient
      scorecards={data}
      divisions={divisions}
      regions={regions}
      allMetrics={allMetrics}
    />
  );
}
