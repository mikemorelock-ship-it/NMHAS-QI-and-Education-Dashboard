import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { TraineeDetailClient } from "@/app/(admin)/admin/field-training/trainees/[id]/trainee-detail-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingTraineeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  if (!session) notFound();
  if (!hasPermission(session.role, "view_all_trainees")) notFound();

  const { id } = await params;

  const trainee = await prisma.user.findUnique({
    where: { id, role: "trainee" },
    include: {
      division: { select: { id: true, name: true } },
      traineeAssignments: {
        orderBy: { startDate: "desc" },
        include: {
          fto: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
        },
      },
      traineePhases: {
        orderBy: { phase: { sortOrder: "asc" } },
        include: {
          phase: true,
          ftoSignoff: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      traineeDailyEvals: {
        orderBy: { date: "desc" },
        include: {
          fto: { select: { firstName: true, lastName: true } },
          phase: { select: { name: true } },
          ratings: {
            include: {
              category: { select: { name: true, sortOrder: true } },
            },
            orderBy: { category: { sortOrder: "asc" } },
          },
          supervisorNoteEntries: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      traineeSkillSignoffs: {
        include: {
          skill: {
            include: {
              category: {
                select: { id: true, name: true, sortOrder: true },
              },
            },
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
            select: {
              id: true,
              stepNumber: true,
              description: true,
              isRequired: true,
            },
          },
        },
      },
    },
  });

  const ftos = await prisma.user.findMany({
    where: {
      role: { in: ["fto", "supervisor", "manager", "admin"] },
      isActive: true,
    },
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

  // Filter out orientation phase
  const nonOrientationPhases = trainee.traineePhases.filter(
    (tp) => tp.phase.slug !== "orientation"
  );

  return (
    <TraineeDetailClient
      backUrl="/fieldtraining/trainees"
      dorNewUrl={`/fieldtraining/dors/new?traineeId=${trainee.id}`}
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
      phases={nonOrientationPhases.map((tp) => ({
        id: tp.id,
        phaseName: tp.phase.name,
        phaseSlug: tp.phase.slug,
        minDays: tp.phase.minDays,
        startDate: tp.startDate?.toISOString() ?? null,
        endDate: tp.endDate?.toISOString() ?? null,
        status: tp.status,
        ftoSignoffName: tp.ftoSignoff
          ? `${tp.ftoSignoff.firstName} ${tp.ftoSignoff.lastName}`
          : null,
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
        noteEntries: d.supervisorNoteEntries.map((n) => ({
          id: n.id,
          text: n.text,
          authorName: `${n.author.firstName} ${n.author.lastName}`,
          authorId: n.authorId,
          createdAt: n.createdAt.toISOString(),
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
      currentUserId={session.userId}
    />
  );
}
