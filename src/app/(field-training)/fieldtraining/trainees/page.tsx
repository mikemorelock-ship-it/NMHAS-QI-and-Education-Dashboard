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

  const canManageAssignments = hasPermission(session.role, "manage_training_assignments");

  const [trainees, ftos, pendingRequests, departments, phases] = await Promise.all([
    prisma.user.findMany({
      where: { role: "trainee" },
      orderBy: [{ traineeStatus: "asc" }, { lastName: "asc" }],
      include: {
        division: {
          select: {
            name: true,
            department: { select: { name: true } },
          },
        },
        traineeAssignments: {
          where: { status: "active" },
          include: {
            fto: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        traineePhases: {
          include: {
            phase: { select: { name: true, slug: true, sortOrder: true } },
          },
          orderBy: { phase: { sortOrder: "asc" } },
        },
        traineeDailyEvals: {
          where: { status: "submitted" },
          select: { overallRating: true },
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
    canManageAssignments
      ? prisma.assignmentRequest.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          include: {
            requester: { select: { firstName: true, lastName: true } },
            trainee: {
              select: { firstName: true, lastName: true, employeeId: true },
            },
          },
        })
      : Promise.resolve([]),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.trainingPhase.findMany({
      where: { isActive: true, slug: { not: "orientation" } },
      orderBy: { sortOrder: "asc" },
      select: { name: true },
    }),
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
      pendingRequests={pendingRequests.map((r) => ({
        id: r.id,
        requesterName: `${r.requester.firstName} ${r.requester.lastName}`,
        traineeName: `${r.trainee.lastName}, ${r.trainee.firstName}`,
        traineeEmployeeId: r.trainee.employeeId,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      }))}
      departments={departments.map((d) => d.name)}
      phases={phases.map((p) => p.name)}
      trainees={trainees.map((t) => {
        // Filter out orientation phase
        const nonOrientationPhases = t.traineePhases.filter(
          (tp) => tp.phase.slug !== "orientation"
        );
        const currentPhase = nonOrientationPhases.find((tp) => tp.status === "in_progress");
        const completedPhases = nonOrientationPhases.filter(
          (tp) => tp.status === "completed"
        ).length;
        const totalPhases = nonOrientationPhases.length;

        // Compute avg rating from submitted DORs
        const ratings = t.traineeDailyEvals.map((d) => d.overallRating);
        const avgRating =
          ratings.length > 0
            ? Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10
            : null;

        return {
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          status: t.traineeStatus || "active",
          department: t.division?.department?.name ?? null,
          currentAssignments: t.traineeAssignments.map((a) => ({
            id: a.id,
            ftoId: a.fto.id,
            ftoName: `${a.fto.lastName}, ${a.fto.firstName}`,
          })),
          currentPhase: currentPhase?.phase.name || null,
          completedPhases,
          totalPhases,
          dorCount: t._count.traineeDailyEvals,
          avgRating,
        };
      })}
    />
  );
}
