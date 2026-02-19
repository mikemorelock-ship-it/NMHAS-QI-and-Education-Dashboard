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

  // Fetch the current user's divisionId for scoping
  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { divisionId: true },
  });

  // Build a where filter based on role and division
  // - Admins bypass scoping (see all DORs)
  // - Supervisors/managers with a divisionId: only see DORs where trainee is in same division
  //   OR trainee has an active assignment where the FTO is in the user's division (cross-division)
  // - Users with NO divisionId: see all (backward compatible until admin assigns divisions)
  let whereFilter: Record<string, unknown> = {};

  const shouldScope = session.role !== "admin" && currentUser?.divisionId != null;

  if (shouldScope) {
    const divisionId = currentUser!.divisionId!;

    // Find trainee IDs that have an active assignment where the FTO is in this division
    const crossDivisionAssignments = await prisma.trainingAssignment.findMany({
      where: {
        status: "active",
        fto: { divisionId },
      },
      select: { traineeId: true },
    });
    const crossDivisionTraineeIds = crossDivisionAssignments.map((a) => a.traineeId);

    whereFilter = {
      OR: [
        // Trainee is in the same division
        { trainee: { divisionId } },
        // Trainee has a cross-division active assignment with an FTO in this division
        ...(crossDivisionTraineeIds.length > 0
          ? [{ traineeId: { in: crossDivisionTraineeIds } }]
          : []),
      ],
    };
  }

  // Fetch DORs with division scoping applied
  const dors = await prisma.dailyEvaluation.findMany({
    where: whereFilter,
    orderBy: { date: "desc" },
    take: 100,
    include: {
      trainee: { select: { firstName: true, lastName: true, employeeId: true } },
      fto: { select: { firstName: true, lastName: true } },
      phase: { select: { name: true } },
      supervisorNoteEntries: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { firstName: true, lastName: true } },
        },
      },
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
        noteEntries: d.supervisorNoteEntries.map((n) => ({
          id: n.id,
          text: n.text,
          authorName: `${n.author.firstName} ${n.author.lastName}`,
          authorId: n.authorId,
          createdAt: n.createdAt.toISOString(),
        })),
      }))}
      currentUserId={session.userId}
    />
  );
}
