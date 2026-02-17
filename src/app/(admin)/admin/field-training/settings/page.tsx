import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingSettingsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_dors_skills")) {
    notFound();
  }

  const phases = await prisma.trainingPhase.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { traineePhases: true } } },
  });

  const evalCategories = await prisma.evaluationCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { evaluationRatings: true } } },
  });

  return (
    <SettingsClient
      phases={phases.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        sortOrder: p.sortOrder,
        minDays: p.minDays,
        isActive: p.isActive,
        usageCount: p._count.traineePhases,
      }))}
      evalCategories={evalCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        usageCount: c._count.evaluationRatings,
      }))}
    />
  );
}
