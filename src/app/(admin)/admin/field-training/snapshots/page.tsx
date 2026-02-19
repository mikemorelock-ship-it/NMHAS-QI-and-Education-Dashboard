import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { SnapshotsClient } from "./snapshots-client";

export const dynamic = "force-dynamic";

export default async function SnapshotsPage() {
  const session = await verifySession();
  if (!session || !hasPermission(session.role, "view_all_trainees")) {
    notFound();
  }

  // Fetch all active trainees with enriched data
  const trainees = await prisma.user.findMany({
    where: { role: "trainee", status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      division: { select: { name: true } },
      traineePhases: {
        where: { status: "in_progress" },
        select: { phase: { select: { name: true } } },
        take: 1,
      },
      traineeDailyEvals: {
        where: { status: "submitted" },
        select: { overallRating: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Get all active phases for the filter dropdown
  const phases = await prisma.trainingPhase.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  // Get all divisions for the filter dropdown
  const divisions = await prisma.division.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Fetch recent snapshots created by this user
  const recentSnapshots = await prisma.traineeSnapshot.findMany({
    where: { createdById: session.userId },
    select: {
      id: true,
      token: true,
      title: true,
      isActive: true,
      createdAt: true,
      trainee: {
        select: { firstName: true, lastName: true, employeeId: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <SnapshotsClient
      trainees={trainees.map((t) => {
        const evals = t.traineeDailyEvals;
        const avgRating =
          evals.length > 0
            ? Number((evals.reduce((sum, e) => sum + e.overallRating, 0) / evals.length).toFixed(1))
            : null;
        return {
          id: t.id,
          name: `${t.firstName} ${t.lastName}`,
          employeeId: t.employeeId,
          division: t.division?.name ?? null,
          currentPhase: t.traineePhases[0]?.phase.name ?? null,
          dorCount: evals.length,
          avgRating,
        };
      })}
      phases={phases.map((p) => p.name)}
      divisions={divisions.map((d) => d.name)}
      recentSnapshots={recentSnapshots.map((s) => ({
        id: s.id,
        token: s.token,
        title: s.title,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
        traineeName: `${s.trainee.firstName} ${s.trainee.lastName}`,
        traineeEmployeeId: s.trainee.employeeId,
      }))}
    />
  );
}
