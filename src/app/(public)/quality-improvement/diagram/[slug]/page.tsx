import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DriverDiagramView } from "./DriverDiagramView";

export const dynamic = "force-dynamic";

export default async function PublicDriverDiagramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const diagram = await prisma.driverDiagram.findUnique({
    where: { slug },
    include: {
      metricDefinition: { select: { name: true } },
      nodes: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          _count: { select: { pdsaCycles: true } },
          pdsaCycles: {
            orderBy: [{ cycleNumber: "asc" }],
            include: {
              metricDefinition: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!diagram || !diagram.isActive) notFound();

  const nodesData = diagram.nodes.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    type: n.type as "aim" | "primary" | "secondary" | "changeIdea",
    text: n.text,
    description: n.description,
    sortOrder: n.sortOrder,
    pdsaCycleCount: n._count.pdsaCycles,
    pdsaCycles: n.pdsaCycles.map((c) => ({
      id: c.id,
      title: c.title,
      cycleNumber: c.cycleNumber,
      status: c.status,
      outcome: c.outcome,
      metricName: c.metricDefinition?.name ?? null,
      planDescription: c.planDescription,
      planPrediction: c.planPrediction,
      planDataCollection: c.planDataCollection,
      planStartDate: c.planStartDate?.toISOString() ?? null,
      doObservations: c.doObservations,
      doStartDate: c.doStartDate?.toISOString() ?? null,
      doEndDate: c.doEndDate?.toISOString() ?? null,
      studyResults: c.studyResults,
      studyLearnings: c.studyLearnings,
      studyDate: c.studyDate?.toISOString() ?? null,
      actDecision: c.actDecision,
      actNextSteps: c.actNextSteps,
      actDate: c.actDate?.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    })),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <DriverDiagramView
        name={diagram.name}
        description={diagram.description}
        metricName={diagram.metricDefinition?.name ?? null}
        nodes={nodesData}
      />
    </div>
  );
}
