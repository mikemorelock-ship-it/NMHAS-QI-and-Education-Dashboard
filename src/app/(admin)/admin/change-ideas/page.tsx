import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ChangeIdeasClient } from "./change-ideas-client";

export const dynamic = "force-dynamic";

export default async function ChangeIdeasPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_driver_diagrams")) {
    notFound();
  }

  // Fetch all change idea nodes with their diagram, campaign, and metric context
  const changeIdeaNodes = await prisma.driverNode.findMany({
    where: { type: "changeIdea" },
    orderBy: [{ driverDiagram: { name: "asc" } }, { text: "asc" }],
    include: {
      driverDiagram: {
        select: {
          id: true,
          name: true,
          metricDefinition: { select: { id: true, name: true } },
          campaign: {
            select: {
              id: true,
              name: true,
              campaignDivisions: {
                select: { division: { select: { id: true, name: true } } },
              },
              campaignRegions: {
                select: { region: { select: { id: true, name: true } } },
              },
              // Legacy single division/region
              division: { select: { id: true, name: true } },
              region: { select: { id: true, name: true } },
            },
          },
        },
      },
      pdsaCycles: {
        orderBy: { cycleNumber: "asc" },
        include: {
          metricDefinition: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Also fetch standalone PDSA cycles (those with no changeIdeaNodeId) — excluded per user's choice
  // But we still need diagrams and metrics for create-cycle functionality
  const [diagrams, metrics] = await Promise.all([
    prisma.driverDiagram.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.metricDefinition.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Transform for client serialization
  const changeIdeas = changeIdeaNodes.map((node) => {
    const campaign = node.driverDiagram.campaign;

    // Collect division names from multi-select + legacy
    const divisionNames: string[] = [];
    if (campaign) {
      for (const cd of campaign.campaignDivisions) {
        if (!divisionNames.includes(cd.division.name)) {
          divisionNames.push(cd.division.name);
        }
      }
      if (campaign.division && !divisionNames.includes(campaign.division.name)) {
        divisionNames.push(campaign.division.name);
      }
    }

    // Collect department (region) names
    const departmentNames: string[] = [];
    if (campaign) {
      for (const cr of campaign.campaignRegions) {
        if (!departmentNames.includes(cr.region.name)) {
          departmentNames.push(cr.region.name);
        }
      }
      if (campaign.region && !departmentNames.includes(campaign.region.name)) {
        departmentNames.push(campaign.region.name);
      }
    }

    return {
      id: node.id,
      text: node.text,
      description: node.description,
      driverDiagramId: node.driverDiagramId,
      driverDiagramName: node.driverDiagram.name,
      metricName: node.driverDiagram.metricDefinition?.name ?? null,
      campaignId: campaign?.id ?? null,
      campaignName: campaign?.name ?? null,
      divisionNames,
      departmentNames,
      pdsaCycles: node.pdsaCycles.map((c) => ({
        id: c.id,
        title: c.title,
        cycleNumber: c.cycleNumber,
        status: c.status,
        outcome: c.outcome,
        changeIdeaNodeId: c.changeIdeaNodeId,
        metricName: c.metricDefinition?.name ?? null,
        planDescription: c.planDescription,
        planPrediction: c.planPrediction,
        doStartDate: c.doStartDate?.toISOString().split("T")[0] ?? null,
        doEndDate: c.doEndDate?.toISOString().split("T")[0] ?? null,
        doObservations: c.doObservations,
        studyResults: c.studyResults,
        studyLearnings: c.studyLearnings,
        actDecision: c.actDecision,
        actNextSteps: c.actNextSteps,
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  });

  return <ChangeIdeasClient changeIdeas={changeIdeas} diagrams={diagrams} metrics={metrics} />;
}
