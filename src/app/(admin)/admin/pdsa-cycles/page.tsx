import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PdsaCyclesClient } from "./pdsa-cycles-client";

export const dynamic = "force-dynamic";

export default async function PdsaCyclesPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_driver_diagrams")) {
    notFound();
  }

  const [cycles, diagrams, metrics, changeIdeas] = await Promise.all([
    prisma.pdsaCycle.findMany({
      orderBy: [{ updatedAt: "desc" }],
      include: {
        driverDiagram: { select: { id: true, name: true, campaign: { select: { id: true, name: true } } } },
        metricDefinition: { select: { id: true, name: true } },
        changeIdeaNode: { select: { id: true, text: true, driverDiagramId: true } },
      },
    }),
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
    prisma.driverNode.findMany({
      where: { type: "changeIdea" },
      orderBy: { text: "asc" },
      select: { id: true, text: true, driverDiagramId: true },
    }),
  ]);

  // Transform dates to ISO strings for client serialization
  const cyclesData = cycles.map((c) => ({
    id: c.id,
    title: c.title,
    cycleNumber: c.cycleNumber,
    status: c.status,
    outcome: c.outcome,
    driverDiagramId: c.driverDiagramId,
    driverDiagramName: c.driverDiagram?.name ?? null,
    campaignId: c.driverDiagram?.campaign?.id ?? null,
    campaignName: c.driverDiagram?.campaign?.name ?? null,
    metricDefinitionId: c.metricDefinitionId,
    metricName: c.metricDefinition?.name ?? null,
    changeIdeaNodeId: c.changeIdeaNodeId,
    changeIdeaText: c.changeIdeaNode?.text ?? null,
    planDescription: c.planDescription,
    planPrediction: c.planPrediction,
    planDataCollection: c.planDataCollection,
    planStartDate: c.planStartDate?.toISOString().split("T")[0] ?? null,
    doObservations: c.doObservations,
    doStartDate: c.doStartDate?.toISOString().split("T")[0] ?? null,
    doEndDate: c.doEndDate?.toISOString().split("T")[0] ?? null,
    studyResults: c.studyResults,
    studyLearnings: c.studyLearnings,
    studyDate: c.studyDate?.toISOString().split("T")[0] ?? null,
    actDecision: c.actDecision,
    actNextSteps: c.actNextSteps,
    actDate: c.actDate?.toISOString().split("T")[0] ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return (
    <PdsaCyclesClient
      cycles={cyclesData}
      diagrams={diagrams}
      metrics={metrics}
      changeIdeas={changeIdeas}
    />
  );
}
