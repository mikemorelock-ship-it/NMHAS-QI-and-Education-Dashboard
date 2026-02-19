import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Trainee Snapshot Builder — collects all trainee data into a structured report
// ---------------------------------------------------------------------------

export interface SnapshotData {
  generatedAt: string;
  creatorName: string;
  profile: {
    name: string;
    employeeId: string | null;
    division: string | null;
    hireDate: string | null;
    startDate: string | null;
    currentPhase: string | null;
    traineeStatus: string | null;
  };
  dorSummary: {
    totalCount: number;
    averageOverall: number;
    ratingTrend: { date: string; rating: number }[];
    categoryAverages: { name: string; average: number; count: number }[];
    bestCategories: { name: string; average: number }[];
    worstCategories: { name: string; average: number }[];
    nrtCount: number;
    remCount: number;
    recentRecommendations: { action: string; count: number }[];
  };
  phaseProgress: {
    phases: {
      name: string;
      status: string;
      startedAt: string | null;
      completedAt: string | null;
    }[];
    completedCount: number;
    totalCount: number;
  };
  skillProgress: {
    categories: { name: string; completed: number; total: number }[];
    completedCount: number;
    totalCount: number;
  };
  coachingProgress: {
    assigned: number;
    inProgress: number;
    completed: number;
    total: number;
    completionRate: number;
  };
}

export async function buildTraineeSnapshot(
  traineeId: string,
  creatorName: string
): Promise<SnapshotData> {
  // Fetch trainee profile
  const trainee = await prisma.user.findUnique({
    where: { id: traineeId },
    select: {
      firstName: true,
      lastName: true,
      employeeId: true,
      hireDate: true,
      startDate: true,
      traineeStatus: true,
      division: { select: { name: true } },
    },
  });

  if (!trainee) throw new Error("Trainee not found");

  // Fetch current phase
  const currentPhase = await prisma.traineePhase.findFirst({
    where: { traineeId, status: "in_progress" },
    include: { phase: { select: { name: true } } },
  });

  // Fetch all DORs
  const dors = await prisma.dailyEvaluation.findMany({
    where: { traineeId, status: "submitted" },
    select: {
      date: true,
      overallRating: true,
      nrtFlag: true,
      remFlag: true,
      recommendAction: true,
    },
    orderBy: { date: "desc" },
  });

  // Fetch all category ratings
  const categoryRatings = await prisma.evaluationRating.findMany({
    where: {
      evaluation: { traineeId, status: "submitted" },
    },
    select: {
      rating: true,
      category: { select: { name: true } },
    },
  });

  // Compute category averages
  const catMap = new Map<string, number[]>();
  for (const cr of categoryRatings) {
    const arr = catMap.get(cr.category.name) || [];
    arr.push(cr.rating);
    catMap.set(cr.category.name, arr);
  }
  const categoryAverages = Array.from(catMap.entries())
    .map(([name, ratings]) => ({
      name,
      average: Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)),
      count: ratings.length,
    }))
    .sort((a, b) => a.average - b.average);

  const bestCategories = [...categoryAverages].sort((a, b) => b.average - a.average).slice(0, 3);
  const worstCategories = categoryAverages.slice(0, 3);

  // Recommendation counts
  const recCounts = new Map<string, number>();
  for (const d of dors) {
    recCounts.set(d.recommendAction, (recCounts.get(d.recommendAction) || 0) + 1);
  }

  // Phase progress
  const allPhases = await prisma.trainingPhase.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
  const traineePhases = await prisma.traineePhase.findMany({
    where: { traineeId },
    select: { phaseId: true, status: true, startDate: true, endDate: true },
  });
  const phaseStatusMap = new Map(traineePhases.map((tp) => [tp.phaseId, tp]));

  // Skill progress
  const skillCategories = await prisma.skillCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      skills: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  });
  const signoffs = await prisma.skillSignoff.findMany({
    where: { traineeId },
    select: { skillId: true },
  });
  const signedOffIds = new Set(signoffs.map((s) => s.skillId));

  // Coaching progress
  const coachingStats = await prisma.traineeCoachingAssignment.groupBy({
    by: ["status"],
    where: { traineeId },
    _count: true,
  });
  const coachingMap = new Map(coachingStats.map((s) => [s.status, s._count]));
  const coachAssigned = coachingMap.get("assigned") || 0;
  const coachInProgress = coachingMap.get("in_progress") || 0;
  const coachCompleted = coachingMap.get("completed") || 0;
  const coachTotal = coachAssigned + coachInProgress + coachCompleted;

  const avgOverall =
    dors.length > 0
      ? Number((dors.reduce((s, d) => s + d.overallRating, 0) / dors.length).toFixed(1))
      : 0;

  let totalSkills = 0;
  let completedSkills = 0;
  const skillCatProgress = skillCategories.map((sc) => {
    const total = sc.skills.length;
    const completed = sc.skills.filter((s) => signedOffIds.has(s.id)).length;
    totalSkills += total;
    completedSkills += completed;
    return { name: sc.name, completed, total };
  });

  return {
    generatedAt: new Date().toISOString(),
    creatorName,
    profile: {
      name: `${trainee.firstName} ${trainee.lastName}`,
      employeeId: trainee.employeeId,
      division: trainee.division?.name ?? null,
      hireDate: trainee.hireDate?.toISOString() ?? null,
      startDate: trainee.startDate?.toISOString() ?? null,
      currentPhase: currentPhase?.phase.name ?? null,
      traineeStatus: trainee.traineeStatus,
    },
    dorSummary: {
      totalCount: dors.length,
      averageOverall: avgOverall,
      ratingTrend: dors
        .slice(0, 20)
        .reverse()
        .map((d) => ({
          date: d.date.toISOString(),
          rating: d.overallRating,
        })),
      categoryAverages,
      bestCategories,
      worstCategories,
      nrtCount: dors.filter((d) => d.nrtFlag).length,
      remCount: dors.filter((d) => d.remFlag).length,
      recentRecommendations: Array.from(recCounts.entries()).map(([action, count]) => ({
        action,
        count,
      })),
    },
    phaseProgress: {
      phases: allPhases.map((p) => {
        const tp = phaseStatusMap.get(p.id);
        return {
          name: p.name,
          status: tp?.status ?? "not_started",
          startedAt: tp?.startDate?.toISOString() ?? null,
          completedAt: tp?.endDate?.toISOString() ?? null,
        };
      }),
      completedCount: traineePhases.filter((tp) => tp.status === "completed").length,
      totalCount: allPhases.length,
    },
    skillProgress: {
      categories: skillCatProgress,
      completedCount: completedSkills,
      totalCount: totalSkills,
    },
    coachingProgress: {
      assigned: coachAssigned,
      inProgress: coachInProgress,
      completed: coachCompleted,
      total: coachTotal,
      completionRate: coachTotal > 0 ? Math.round((coachCompleted / coachTotal) * 100) : 100,
    },
  };
}
