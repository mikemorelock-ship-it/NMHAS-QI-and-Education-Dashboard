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

  const [campaigns, users] = await Promise.all([
    prisma.campaign.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { driverDiagrams: true, actionItems: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const campaignsData = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    goals: c.goals,
    status: c.status,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    ownerId: c.ownerId,
    ownerName: c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : null,
    startDate: c.startDate?.toISOString().split("T")[0] ?? null,
    endDate: c.endDate?.toISOString().split("T")[0] ?? null,
    diagramCount: c._count.driverDiagrams,
    actionItemCount: c._count.actionItems,
  }));

  return <CampaignsClient campaigns={campaignsData} users={users} />;
}
