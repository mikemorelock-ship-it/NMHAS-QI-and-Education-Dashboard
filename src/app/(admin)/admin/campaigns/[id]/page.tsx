import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CampaignDetailClient } from "./campaign-detail-client";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_campaigns")) {
    notFound();
  }

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!campaign) notFound();

  // Get diagrams belonging to this campaign + unassigned diagrams
  const [campaignDiagrams, unassignedDiagrams, pdsaCycles, actionItems, users, allCampaigns, allCycles] = await Promise.all([
    prisma.driverDiagram.findMany({
      where: { campaignId: id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        metricDefinition: { select: { name: true } },
        _count: { select: { nodes: true, pdsaCycles: true } },
      },
    }),
    prisma.driverDiagram.findMany({
      where: { campaignId: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pdsaCycle.findMany({
      where: { driverDiagram: { campaignId: id } },
      orderBy: { updatedAt: "desc" },
      include: {
        driverDiagram: { select: { name: true } },
        metricDefinition: { select: { name: true } },
      },
    }),
    prisma.actionItem.findMany({
      where: { campaignId: id },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        pdsaCycle: { select: { id: true, title: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // All PDSA cycles for linking action items
    prisma.pdsaCycle.findMany({
      where: { driverDiagram: { campaignId: id } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const campaignData = {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    description: campaign.description,
    goals: campaign.goals,
    status: campaign.status,
    ownerName: campaign.owner ? `${campaign.owner.firstName} ${campaign.owner.lastName}` : null,
    startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
    endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
  };

  const diagramsData = campaignDiagrams.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    status: d.status,
    isActive: d.isActive,
    metricName: d.metricDefinition?.name ?? null,
    nodeCount: d._count.nodes,
    pdsaCycleCount: d._count.pdsaCycles,
  }));

  const cyclesData = pdsaCycles.map((c) => ({
    id: c.id,
    title: c.title,
    cycleNumber: c.cycleNumber,
    status: c.status,
    outcome: c.outcome,
    diagramName: c.driverDiagram?.name ?? null,
    metricName: c.metricDefinition?.name ?? null,
    updatedAt: c.updatedAt.toISOString().split("T")[0],
  }));

  const actionItemsData = actionItems.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    priority: a.priority,
    dueDate: a.dueDate?.toISOString().split("T")[0] ?? null,
    completedAt: a.completedAt?.toISOString().split("T")[0] ?? null,
    assigneeId: a.assigneeId,
    assigneeName: a.assignee ? `${a.assignee.firstName} ${a.assignee.lastName}` : null,
    pdsaCycleId: a.pdsaCycleId,
    pdsaCycleName: a.pdsaCycle?.title ?? null,
    campaignId: id,
  }));

  return (
    <CampaignDetailClient
      campaign={campaignData}
      diagrams={diagramsData}
      unassignedDiagrams={unassignedDiagrams}
      cycles={cyclesData}
      actionItems={actionItemsData}
      users={users}
      campaigns={allCampaigns}
      campaignCycles={allCycles}
    />
  );
}
