import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CampaignsClient } from "./campaigns-client";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_campaigns")) {
    notFound();
  }

  const [campaigns, users, metrics, divisions, regions] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        metricDefinition: { select: { id: true, name: true } },
        campaignDivisions: {
          select: { divisionId: true, division: { select: { name: true } } },
        },
        campaignRegions: {
          select: { regionId: true, region: { select: { name: true } } },
        },
        _count: { select: { driverDiagrams: true, actionItems: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.metricDefinition.findMany({
      where: { isActive: true },
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
      orderBy: { name: "asc" },
      select: { id: true, name: true, divisionId: true },
    }),
  ]);

  const campaignsData = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    goals: c.goals,
    keyFindings: c.keyFindings,
    status: c.status,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    ownerId: c.ownerId,
    ownerName: c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : null,
    metricDefinitionId: c.metricDefinitionId,
    metricName: c.metricDefinition?.name ?? null,
    divisionIds: c.campaignDivisions.map((cd) => cd.divisionId),
    divisionNames: c.campaignDivisions.map((cd) => cd.division.name),
    regionIds: c.campaignRegions.map((cr) => cr.regionId),
    regionNames: c.campaignRegions.map((cr) => cr.region.name),
    startDate: c.startDate?.toISOString().split("T")[0] ?? null,
    endDate: c.endDate?.toISOString().split("T")[0] ?? null,
    diagramCount: c._count.driverDiagrams,
    actionItemCount: c._count.actionItems,
  }));

  return (
    <CampaignsClient
      campaigns={campaignsData}
      users={users}
      metrics={metrics}
      divisions={divisions}
      regions={regions}
    />
  );
}
