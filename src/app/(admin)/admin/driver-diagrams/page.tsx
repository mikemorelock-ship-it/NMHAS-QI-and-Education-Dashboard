import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DriverDiagramsClient } from "./driver-diagrams-client";

export const dynamic = "force-dynamic";

export default async function DriverDiagramsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_driver_diagrams")) {
    notFound();
  }

  const [diagrams, metrics] = await Promise.all([
    prisma.driverDiagram.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        metricDefinition: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
        _count: { select: { nodes: true, pdsaCycles: true } },
      },
    }),
    prisma.metricDefinition.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const diagramsData = diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    status: d.status as "draft" | "active" | "archived",
    isActive: d.isActive,
    sortOrder: d.sortOrder,
    metricName: d.metricDefinition?.name ?? null,
    metricDefinitionId: d.metricDefinitionId,
    campaignId: d.campaign?.id ?? null,
    campaignName: d.campaign?.name ?? null,
    nodeCount: d._count.nodes,
    pdsaCycleCount: d._count.pdsaCycles,
  }));

  return (
    <DriverDiagramsClient
      diagrams={diagramsData}
      metrics={metrics}
    />
  );
}
