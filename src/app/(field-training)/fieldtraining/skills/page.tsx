import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { TraineeSkillsClient } from "./trainee-skills-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingSkillsPage() {
  const session = await verifySession();
  if (!session) redirect("/login");
  if (session.role !== "trainee") notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true },
  });
  if (!user) redirect("/login");

  // Fetch all skill categories with skills and steps
  const skillCategories = await prisma.skillCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      skills: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            select: { id: true, stepNumber: true, description: true, isRequired: true },
          },
        },
      },
    },
  });

  // Fetch trainee's skill signoffs
  const signoffs = await prisma.skillSignoff.findMany({
    where: { traineeId: session.userId },
    include: {
      fto: { select: { firstName: true, lastName: true } },
    },
  });

  // Build signoff lookup map
  const signoffMap: Record<string, { ftoName: string; date: string }> = {};
  for (const so of signoffs) {
    signoffMap[so.skillId] = {
      ftoName: `${so.fto.firstName} ${so.fto.lastName}`,
      date: so.date.toISOString(),
    };
  }

  return (
    <TraineeSkillsClient
      traineeName={`${user.firstName} ${user.lastName}`}
      skillCategories={skillCategories.map((sc) => ({
        id: sc.id,
        name: sc.name,
        skills: sc.skills.map((s) => ({
          id: s.id,
          name: s.name,
          isCritical: s.isCritical,
          signedOff: !!signoffMap[s.id],
          signoffFto: signoffMap[s.id]?.ftoName ?? null,
          signoffDate: signoffMap[s.id]?.date ?? null,
          steps: s.steps.map((st) => ({
            id: st.id,
            stepNumber: st.stepNumber,
            description: st.description,
            isRequired: st.isRequired,
          })),
        })),
      }))}
    />
  );
}
