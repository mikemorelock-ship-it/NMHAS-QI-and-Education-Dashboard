import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { EditDorClient } from "./edit-dor-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingEditDorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();
  if (!session) redirect("/login");
  if (session.role === "trainee") notFound();

  const dor = await prisma.dailyEvaluation.findUnique({
    where: { id },
    include: {
      trainee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
      ratings: {
        include: { category: { select: { id: true, name: true } } },
      },
      phase: { select: { id: true, name: true } },
    },
  });

  if (!dor) notFound();
  if (dor.ftoId !== session.userId) redirect("/fieldtraining/dors");
  if (dor.status !== "draft") redirect("/fieldtraining/dors");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!user) redirect("/login");

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

  // Get assigned trainees
  const assignments = await prisma.trainingAssignment.findMany({
    where: { ftoId: session.userId, status: "active" },
    include: {
      trainee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
    },
  });

  // Include the current trainee even if not currently assigned
  const rawTrainees = assignments.map((a) => a.trainee);
  if (!rawTrainees.find((t) => t.id === dor.traineeId)) {
    rawTrainees.push(dor.trainee);
  }
  const trainees = rawTrainees.map((t) => ({
    ...t,
    employeeId: t.employeeId || "",
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

  return (
    <EditDorClient
      dorId={dor.id}
      fto={user}
      trainees={trainees}
      phases={phases}
      dorCategories={dorCategories}
      traineePhaseMap={traineePhaseMap}
      existingData={{
        traineeId: dor.traineeId,
        phaseId: dor.phase?.id || null,
        date: dor.date.toISOString().split("T")[0],
        overallRating: dor.overallRating,
        narrative: dor.narrative || "",
        mostSatisfactory: dor.mostSatisfactory || "",
        leastSatisfactory: dor.leastSatisfactory || "",
        recommendAction: dor.recommendAction,
        nrtFlag: dor.nrtFlag,
        remFlag: dor.remFlag,
        categoryRatings: Object.fromEntries(
          dor.ratings.map((r) => [r.categoryId, { rating: r.rating, comments: r.comments || "" }])
        ),
      }}
    />
  );
}
