import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { FtoNewDorClient } from "./fto-new-dor-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingNewDorPage() {
  const session = await verifySession();
  if (!session) redirect("/login");
  if (session.role === "trainee") notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!user) redirect("/login");

  // Get only trainees assigned to this FTO
  const assignments = await prisma.trainingAssignment.findMany({
    where: { ftoId: session.userId, status: "active" },
    include: {
      trainee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
    },
  });

  const trainees = assignments.map((a) => ({
    ...a.trainee,
    employeeId: a.trainee.employeeId || "",
  }));

  // Build trainee -> current phase map
  const traineeIds = trainees.map((t) => t.id);
  const traineePhases =
    traineeIds.length > 0
      ? await prisma.traineePhase.findMany({
          where: { traineeId: { in: traineeIds }, status: "in_progress" },
          select: { traineeId: true, phaseId: true },
        })
      : [];
  const traineePhaseMap: Record<string, string> = {};
  for (const tp of traineePhases) {
    if (!traineePhaseMap[tp.traineeId]) {
      traineePhaseMap[tp.traineeId] = tp.phaseId;
    }
  }

  // Check for unacknowledged DORs per trainee
  const unackGroups =
    traineeIds.length > 0
      ? await prisma.dailyEvaluation.groupBy({
          by: ["traineeId"],
          where: {
            traineeId: { in: traineeIds },
            status: "submitted",
            traineeAcknowledged: false,
          },
          _count: true,
        })
      : [];
  const unackDorMap: Record<string, number> = {};
  for (const g of unackGroups) {
    unackDorMap[g.traineeId] = g._count;
  }

  const [phases, dorCategories] = await Promise.all([
    prisma.trainingPhase.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.evaluationCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true },
    }),
  ]);

  return (
    <FtoNewDorClient
      fto={{ id: user.id, firstName: user.firstName, lastName: user.lastName }}
      trainees={trainees}
      phases={phases}
      dorCategories={dorCategories}
      traineePhaseMap={traineePhaseMap}
      unackDorMap={unackDorMap}
    />
  );
}
