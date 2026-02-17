import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SkillsClient } from "./skills-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingSkillsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_dors_skills")) {
    notFound();
  }

  const categories = await prisma.skillCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      skills: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { skillSignoffs: true } },
          steps: {
            orderBy: { stepNumber: "asc" },
            select: { id: true, stepNumber: true, description: true, isRequired: true, sortOrder: true },
          },
        },
      },
    },
  });

  return (
    <SkillsClient
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        skills: c.skills.map((s) => ({
          id: s.id,
          categoryId: s.categoryId,
          name: s.name,
          slug: s.slug,
          description: s.description,
          isCritical: s.isCritical,
          sortOrder: s.sortOrder,
          isActive: s.isActive,
          signoffCount: s._count.skillSignoffs,
          steps: s.steps,
        })),
      }))}
    />
  );
}
