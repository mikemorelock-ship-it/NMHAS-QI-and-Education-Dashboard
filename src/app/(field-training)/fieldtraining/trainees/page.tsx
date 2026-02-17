import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AllTraineesClient } from "./all-trainees-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingAllTraineesPage() {
  const session = await verifySession();
  if (!session) redirect("/login");
  if (session.role === "trainee") notFound();
  if (!hasPermission(session.role, "view_all_trainees")) notFound();

  // Fetch all trainee users with their current assignments and phase progress
  const trainees = await prisma.user.findMany({
    where: { role: "trainee" },
    orderBy: [{ traineeStatus: "asc" }, { lastName: "asc" }],
    include: {
      traineeAssignments: {
        where: { status: "active" },
        include: {
          fto: { select: { firstName: true, lastName: true } },
        },
        take: 1,
      },
      traineePhases: {
        include: {
          phase: { select: { name: true, sortOrder: true } },
        },
        orderBy: { phase: { sortOrder: "asc" } },
      },
      _count: {
        select: { traineeDailyEvals: true },
      },
    },
  });

  return (
    <AllTraineesClient
      trainees={trainees.map((t) => {
        const currentAssignment = t.traineeAssignments[0];
        const currentPhase = t.traineePhases.find(
          (tp) => tp.status === "in_progress"
        );
        const completedPhases = t.traineePhases.filter(
          (tp) => tp.status === "completed"
        ).length;
        const totalPhases = t.traineePhases.length;

        return {
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          employeeId: t.employeeId || "",
          status: t.traineeStatus || "active",
          startDate: (t.startDate || t.createdAt).toISOString(),
          currentFto: currentAssignment
            ? `${currentAssignment.fto.lastName}, ${currentAssignment.fto.firstName}`
            : null,
          currentPhase: currentPhase?.phase.name || null,
          completedPhases,
          totalPhases,
          dorCount: t._count.traineeDailyEvals,
        };
      })}
    />
  );
}
