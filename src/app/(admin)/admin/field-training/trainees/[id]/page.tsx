import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TraineeDetailClient } from "./trainee-detail-client";

export const dynamic = "force-dynamic";

export default async function TraineeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_ftos_trainees")) {
    notFound();
  }

  const { id } = await params;

  const trainee = await prisma.user.findUnique({
    where: { id, role: "trainee" },
    include: {
      division: { select: { id: true, name: true } },
      traineeAssignments: {
        orderBy: { startDate: "desc" },
        include: { fto: { select: { id: true, firstName: true, lastName: true, employeeId: true } } },
      },
      traineePhases: {
        orderBy: { phase: { sortOrder: "asc" } },
        include: {
          phase: true,
          ftoSignoff: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      traineeDailyEvals: {
        orderBy: { date: "desc" },
        include: {
          fto: { select: { firstName: true, lastName: true } },
          phase: { select: { name: true } },
          ratings: {
            include: { category: { select: { name: true, sortOrder: true } } },
            orderBy: { category: { sortOrder: "asc" } },
          },
        },
      },
      traineeSkillSignoffs: {
        include: {
          skill: {
            include: { category: { select: { id: true, name: true, sortOrder: true } } },
          },
          fto: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!trainee) notFound();

  // Get all skills grouped by category
  const skillCategories = await prisma.skillCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      skills: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          steps: {
            orderBy: { stepNumber: "asc" },
            select: { id: true, stepNumber: true, description: true, isRequired: true },
          },
        },
      },
    },
  });

  const ftos = await prisma.user.findMany({
    where: { role: { in: ["fto", "supervisor", "manager", "admin"] }, isActive: true },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  // Build signoff lookup
  const signoffMap: Record<string, { ftoName: string; date: string }> = {};
  for (const so of trainee.traineeSkillSignoffs) {
    signoffMap[so.skillId] = {
      ftoName: `${so.fto.firstName} ${so.fto.lastName}`,
      date: so.createdAt.toISOString(),
    };
  }

  return (
    <TraineeDetailClient
      trainee={{
        id: trainee.id,
        firstName: trainee.firstName,
        lastName: trainee.lastName,
        employeeId: trainee.employeeId || "",
        email: trainee.email,
        hireDate: (trainee.hireDate || trainee.createdAt).toISOString(),
        startDate: (trainee.startDate || trainee.createdAt).toISOString(),
        completionDate: trainee.completionDate?.toISOString() ?? null,
        status: trainee.traineeStatus || "active",
        notes: trainee.notes,
        hasPin: !!trainee.passwordHash,
        divisionName: trainee.division?.name ?? null,
      }}
      assignments={trainee.traineeAssignments.map((a) => ({
        id: a.id,
        ftoName: `${a.fto.firstName} ${a.fto.lastName}`,
        ftoEmployeeId: a.fto.employeeId || "",
        startDate: a.startDate.toISOString(),
        endDate: a.endDate?.toISOString() ?? null,
        status: a.status,
      }))}
      phases={trainee.traineePhases.map((tp) => ({
        id: tp.id,
        phaseName: tp.phase.name,
        phaseSlug: tp.phase.slug,
        minDays: tp.phase.minDays,
        startDate: tp.startDate?.toISOString() ?? null,
        endDate: tp.endDate?.toISOString() ?? null,
        status: tp.status,
        ftoSignoffName: tp.ftoSignoff ? `${tp.ftoSignoff.firstName} ${tp.ftoSignoff.lastName}` : null,
        notes: tp.notes,
      }))}
      dors={trainee.traineeDailyEvals.map((d) => ({
        id: d.id,
        date: d.date.toISOString(),
        ftoName: `${d.fto.firstName} ${d.fto.lastName}`,
        phaseName: d.phase?.name ?? null,
        overallRating: d.overallRating,
        narrative: d.narrative,
        mostSatisfactory: d.mostSatisfactory,
        leastSatisfactory: d.leastSatisfactory,
        recommendAction: d.recommendAction,
        nrtFlag: d.nrtFlag,
        remFlag: d.remFlag,
        traineeAcknowledged: d.traineeAcknowledged,
        acknowledgedAt: d.acknowledgedAt?.toISOString() ?? null,
        supervisorNotes: d.supervisorNotes,
        status: d.status,
        ratings: d.ratings.map((r) => ({
          categoryName: r.category.name,
          rating: r.rating,
          comments: r.comments,
        })),
      }))}
      skillCategories={skillCategories.map((sc) => ({
        id: sc.id,
        name: sc.name,
        skills: sc.skills.map((s) => ({
          id: s.id,
          name: s.name,
          isCritical: s.isCritical,
          signedOff: !!signoffMap[s.id],
          signoffFto: signoffMap[s.id]?.ftoName ?? null,
          signoffDate: signoffMap[s.id]?.date ?? null,
          steps: s.steps.map((st) => ({
            id: st.id,
            stepNumber: st.stepNumber,
            description: st.description,
            isRequired: st.isRequired,
          })),
        })),
      }))}
      ftos={ftos}
    />
  );
}
