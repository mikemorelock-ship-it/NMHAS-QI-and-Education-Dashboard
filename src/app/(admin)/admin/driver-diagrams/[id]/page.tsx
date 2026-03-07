import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DriverDiagramDetailClient } from "./driver-diagram-detail-client";

export const dynamic = "force-dynamic";

export default async function DriverDiagramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_driver_diagrams")) {
    notFound();
  }

  const { id } = await params;

  const diagram = await prisma.driverDiagram.findUnique({
    where: { id },
    include: {
      metricDefinition: { select: { id: true, name: true } },
      nodes: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          _count: { select: { pdsaCycles: true } },
          associations: {
            select: {
              id: true,
              parentId: true,
              parent: { select: { id: true, text: true, type: true } },
            },
          },
        },
      },
      _count: { select: { pdsaCycles: true } },
    },
  });

  if (!diagram) notFound();

  const diagramInfo = {
    id: diagram.id,
    name: diagram.name,
    slug: diagram.slug,
    description: diagram.description,
    status: diagram.status as "draft" | "active" | "archived",
    metricName: diagram.metricDefinition?.name ?? null,
  };

  const nodes = diagram.nodes.map((n) => ({
    id: n.id,
    parentId: n.parentId,
    type: n.type as "aim" | "primary" | "secondary" | "changeIdea",
    text: n.text,
    description: n.description,
    sortOrder: n.sortOrder,
    pdsaCycleCount: n._count.pdsaCycles,
    associations: n.associations.map((a) => ({
      id: a.id,
      parentId: a.parentId,
      parentText: a.parent.text,
      parentType: a.parent.type,
    })),
  }));

  return <DriverDiagramDetailClient diagram={diagramInfo} nodes={nodes} />;
}
