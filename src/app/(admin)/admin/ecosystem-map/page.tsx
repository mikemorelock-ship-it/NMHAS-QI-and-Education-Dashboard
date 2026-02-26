import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { EcosystemMapClient } from "./ecosystem-map-client";

export const dynamic = "force-dynamic";

export default async function EcosystemMapPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_ecosystem_maps")) {
    notFound();
  }

  const [maps, divisions, departments, users] = await Promise.all([
    prisma.ecosystemMap.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { nodes: true, edges: true } },
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
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const mapsData = maps.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    description: m.description,
    _count: m._count,
  }));

  return (
    <EcosystemMapClient
      initialMaps={mapsData}
      orgData={{
        divisions,
        departments,
        users,
      }}
    />
  );
}
