import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CampaignDetailView } from "./CampaignDetailView";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      driverDiagrams: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          metricDefinition: { select: { name: true } },
          _count: { select: { nodes: true, pdsaCycles: true } },
        },
      },
      actionItems: {
        orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
        include: {
          assignee: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!campaign || !campaign.isActive) notFound();

  // Get PDSA cycles through the campaign's diagrams
  const diagramIds = campaign.driverDiagrams.map((d) => d.id);
  const pdsaCycles = diagramIds.length > 0
    ? await prisma.pdsaCycle.findMany({
        where: { driverDiagramId: { in: diagramIds } },
        orderBy: { updatedAt: "desc" },
        include: {
          driverDiagram: { select: { name: true, slug: true } },
          metricDefinition: { select: { name: true } },
          changeIdeaNode: { select: { text: true } },
        },
      })
    : [];

  return (
    <CampaignDetailView
      campaign={{
        name: campaign.name,
        description: campaign.description,
        goals: campaign.goals,
        status: campaign.status,
        ownerName: campaign.owner
          ? `${campaign.owner.firstName} ${campaign.owner.lastName}`
          : null,
        startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
        endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
      }}
      diagrams={campaign.driverDiagrams.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        description: d.description,
        metricName: d.metricDefinition?.name ?? null,
        nodeCount: d._count.nodes,
        pdsaCycleCount: d._count.pdsaCycles,
      }))}
      cycles={pdsaCycles.map((c) => ({
        id: c.id,
        title: c.title,
        cycleNumber: c.cycleNumber,
        status: c.status,
        outcome: c.outcome,
        diagramName: c.driverDiagram?.name ?? null,
        diagramSlug: c.driverDiagram?.slug ?? null,
        metricName: c.metricDefinition?.name ?? null,
        changeIdea: c.changeIdeaNode?.text ?? null,
      }))}
      actionItems={campaign.actionItems.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        priority: a.priority,
        dueDate: a.dueDate?.toISOString().split("T")[0] ?? null,
        assigneeName: a.assignee
          ? `${a.assignee.firstName} ${a.assignee.lastName}`
          : null,
      }))}
    />
  );
}
