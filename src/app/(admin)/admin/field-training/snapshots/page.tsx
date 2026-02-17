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

  // Fetch all active trainees
  const trainees = await prisma.user.findMany({
    where: { role: "trainee", status: "active" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      division: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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
      trainees={trainees.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`,
        employeeId: t.employeeId,
        division: t.division?.name ?? null,
      }))}
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
