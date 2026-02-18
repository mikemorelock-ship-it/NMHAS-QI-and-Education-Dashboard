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

  const canManageAssignments = hasPermission(
    session.role,
    "manage_training_assignments"
  );

  // Fetch all trainee users with their current assignments and phase progress
  const [trainees, ftos] = await Promise.all([
    prisma.user.findMany({
      where: { role: "trainee" },
      orderBy: [{ traineeStatus: "asc" }, { lastName: "asc" }],
      include: {
        traineeAssignments: {
          where: { status: "active" },
          include: {
            fto: { select: { firstName: true, lastName: true } },
          },
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
    }),
    canManageAssignments
      ? prisma.user.findMany({
          where: { role: { in: ["fto", "supervisor"] }, isActive: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            role: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <AllTraineesClient
      canManageAssignments={canManageAssignments}
      ftos={ftos.map((f) => ({
        id: f.id,
        name: `${f.lastName}, ${f.firstName}`,
        employeeId: f.employeeId || "",
        role: f.role,
      }))}
      trainees={trainees.map((t) => {
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
          currentFtos: t.traineeAssignments.map(
            (a) => `${a.fto.lastName}, ${a.fto.firstName}`
          ),
          currentPhase: currentPhase?.phase.name || null,
          completedPhases,
          totalPhases,
          dorCount: t._count.traineeDailyEvals,
        };
      })}
    />
  );
}
