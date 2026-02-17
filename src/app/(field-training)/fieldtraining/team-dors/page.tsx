import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { TeamDorsClient } from "./team-dors-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingTeamDorsPage() {
  const session = await verifySession();
  if (!session) redirect("/login");
  if (session.role === "trainee") notFound();
  if (!hasPermission(session.role, "review_approve_dors")) notFound();

  // Fetch all DORs across all FTOs (for supervisor review)
  const dors = await prisma.dailyEvaluation.findMany({
    orderBy: { date: "desc" },
    take: 100,
    include: {
      trainee: { select: { firstName: true, lastName: true, employeeId: true } },
      fto: { select: { firstName: true, lastName: true } },
      phase: { select: { name: true } },
    },
  });

  return (
    <TeamDorsClient
      dors={dors.map((d) => ({
        id: d.id,
        date: d.date.toISOString(),
        traineeName: `${d.trainee.lastName}, ${d.trainee.firstName}`,
        traineeEmployeeId: d.trainee.employeeId || "",
        ftoName: `${d.fto.lastName}, ${d.fto.firstName}`,
        phaseName: d.phase?.name || null,
        overallRating: d.overallRating,
        status: d.status,
        traineeAcknowledged: d.traineeAcknowledged,
        recommendAction: d.recommendAction,
        supervisorNotes: d.supervisorNotes,
      }))}
      currentFtoId={session.userId}
    />
  );
}
