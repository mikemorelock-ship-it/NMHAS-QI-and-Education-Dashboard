import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TraineesClient } from "./trainees-client";

export const dynamic = "force-dynamic";

export default async function TraineesPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_ftos_trainees")) {
    notFound();
  }

  const trainees = await prisma.user.findMany({
    where: { role: "trainee" },
    orderBy: [{ traineeStatus: "asc" }, { lastName: "asc" }],
    include: {
      division: { select: { id: true, name: true } },
      traineeAssignments: {
        where: { status: "active" },
        include: { fto: { select: { id: true, firstName: true, lastName: true } } },
      },
      traineePhases: {
        include: { phase: { select: { name: true, sortOrder: true } } },
        orderBy: { phase: { sortOrder: "asc" } },
      },
      _count: { select: { traineeDailyEvals: true, traineeSkillSignoffs: true } },
    },
  });

  const totalSkills = await prisma.skill.count({ where: { isActive: true } });

  const divisions = await prisma.division.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const ftos = await prisma.user.findMany({
    where: { role: { in: ["fto", "supervisor", "manager", "admin"] }, isActive: true },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });

  return (
    <TraineesClient
      trainees={trainees.map((t) => ({
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        employeeId: t.employeeId || "",
        email: t.email,
        hireDate: (t.hireDate || t.createdAt).toISOString(),
        startDate: (t.startDate || t.createdAt).toISOString(),
        completionDate: t.completionDate?.toISOString() ?? null,
        status: t.traineeStatus || "active",
        divisionName: t.division?.name ?? null,
        divisionId: t.divisionId,
        currentFtos: t.traineeAssignments.map(
          (a) => `${a.fto.firstName} ${a.fto.lastName}`
        ),
        currentPhase: t.traineePhases.find((tp) => tp.status === "in_progress")?.phase.name ?? null,
        phasesCompleted: t.traineePhases.filter((tp) => tp.status === "completed").length,
        totalPhases: t.traineePhases.length,
        evalCount: t._count.traineeDailyEvals,
        skillsCompleted: t._count.traineeSkillSignoffs,
        totalSkills,
      }))}
      divisions={divisions}
      ftos={ftos}
    />
  );
}
