import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AssignmentsClient } from "./assignments-client";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const session = await verifySession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, "manage_training_assignments")) notFound();

  const [
    activeAssignments,
    pendingRequests,
    trainees,
    ftos,
    recentHistory,
  ] = await Promise.all([
    // Active assignments with trainee + FTO details
    prisma.trainingAssignment.findMany({
      where: { status: "active" },
      orderBy: { startDate: "desc" },
      include: {
        trainee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            traineeStatus: true,
          },
        },
        fto: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
      },
    }),

    // Pending assignment requests for review
    prisma.assignmentRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { firstName: true, lastName: true } },
        trainee: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
      },
    }),

    // All active trainees (for assign dialog)
    prisma.user.findMany({
      where: {
        role: "trainee",
        isActive: true,
        traineeStatus: { in: ["active", "remediation"] },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, employeeId: true },
    }),

    // All active FTOs + supervisors (can be assigned trainees)
    prisma.user.findMany({
      where: {
        role: { in: ["fto", "supervisor"] },
        isActive: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        role: true,
      },
    }),

    // Recent completed/reassigned assignments (last 20)
    prisma.trainingAssignment.findMany({
      where: { status: { in: ["completed", "reassigned"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        trainee: {
          select: { firstName: true, lastName: true, employeeId: true },
        },
        fto: {
          select: { firstName: true, lastName: true },
        },
      },
    }),
  ]);

  return (
    <AssignmentsClient
      activeAssignments={activeAssignments.map((a) => ({
        id: a.id,
        traineeId: a.trainee.id,
        traineeName: `${a.trainee.lastName}, ${a.trainee.firstName}`,
        traineeEmployeeId: a.trainee.employeeId,
        traineeStatus: a.trainee.traineeStatus || "active",
        ftoId: a.fto.id,
        ftoName: `${a.fto.lastName}, ${a.fto.firstName}`,
        ftoEmployeeId: a.fto.employeeId,
        startDate: a.startDate.toISOString(),
        status: a.status,
      }))}
      pendingRequests={pendingRequests.map((r) => ({
        id: r.id,
        requesterName: `${r.requester.firstName} ${r.requester.lastName}`,
        traineeName: `${r.trainee.lastName}, ${r.trainee.firstName}`,
        traineeEmployeeId: r.trainee.employeeId,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      }))}
      trainees={trainees.map((t) => ({
        id: t.id,
        name: `${t.lastName}, ${t.firstName}`,
        employeeId: t.employeeId,
      }))}
      ftos={ftos.map((f) => ({
        id: f.id,
        name: `${f.lastName}, ${f.firstName}`,
        employeeId: f.employeeId,
        role: f.role,
      }))}
      recentHistory={recentHistory.map((h) => ({
        id: h.id,
        traineeName: `${h.trainee.lastName}, ${h.trainee.firstName}`,
        traineeEmployeeId: h.trainee.employeeId,
        ftoName: `${h.fto.lastName}, ${h.fto.firstName}`,
        startDate: h.startDate.toISOString(),
        endDate: h.endDate?.toISOString() ?? null,
        status: h.status,
      }))}
    />
  );
}
