import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ActionItemsClient } from "./action-items-client";

export const dynamic = "force-dynamic";

export default async function ActionItemsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_action_items")) {
    notFound();
  }

  const [actionItems, campaigns, cycles, users] = await Promise.all([
    prisma.actionItem.findMany({
      orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
      include: {
        campaign: { select: { id: true, name: true } },
        pdsaCycle: { select: { id: true, title: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.pdsaCycle.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const itemsData = actionItems.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    priority: a.priority,
    dueDate: a.dueDate?.toISOString().split("T")[0] ?? null,
    completedAt: a.completedAt?.toISOString().split("T")[0] ?? null,
    campaignId: a.campaignId,
    campaignName: a.campaign?.name ?? null,
    pdsaCycleId: a.pdsaCycleId,
    pdsaCycleName: a.pdsaCycle?.title ?? null,
    assigneeId: a.assigneeId,
    assigneeName: a.assignee ? `${a.assignee.firstName} ${a.assignee.lastName}` : null,
  }));

  return (
    <ActionItemsClient
      actionItems={itemsData}
      campaigns={campaigns}
      cycles={cycles}
      users={users}
    />
  );
}
