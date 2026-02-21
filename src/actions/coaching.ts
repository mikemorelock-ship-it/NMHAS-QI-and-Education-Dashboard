"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = { success: boolean; error?: string };

// ---------------------------------------------------------------------------
// Trainee Actions
// ---------------------------------------------------------------------------

/** Fetch all coaching assignments for the current trainee */
export async function getMyCoachingActivities() {
  const session = await requireAuth();

  const assignments = await prisma.traineeCoachingAssignment.findMany({
    where: { traineeId: session.userId },
    include: {
      activity: {
        include: {
          category: { select: { name: true, slug: true } },
        },
      },
      dor: { select: { id: true, date: true, overallRating: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return assignments.map((a) => ({
    id: a.id,
    status: a.status,
    progress: a.progress,
    startedAt: a.startedAt?.toISOString() ?? null,
    completedAt: a.completedAt?.toISOString() ?? null,
    score: a.score,
    response: a.response,
    createdAt: a.createdAt.toISOString(),
    activity: {
      id: a.activity.id,
      title: a.activity.title,
      description: a.activity.description,
      type: a.activity.type,
      content: a.activity.content,
      difficulty: a.activity.difficulty,
      estimatedMins: a.activity.estimatedMins,
      categoryName: a.activity.category.name,
      categorySlug: a.activity.category.slug,
      generationStatus: a.activity.generationStatus,
    },
    dor: a.dor
      ? {
          id: a.dor.id,
          date: a.dor.date.toISOString(),
          overallRating: a.dor.overallRating,
        }
      : null,
  }));
}

/** Mark a coaching assignment as in-progress */
export async function startCoachingActivity(assignmentId: string): Promise<ActionResult> {
  const session = await requireAuth();

  try {
    const assignment = await prisma.traineeCoachingAssignment.findUnique({
      where: { id: assignmentId },
      select: { traineeId: true, status: true },
    });

    if (!assignment) return { success: false, error: "Assignment not found." };
    if (assignment.traineeId !== session.userId) {
      return { success: false, error: "Not your assignment." };
    }
    if (assignment.status === "completed") {
      return { success: false, error: "Already completed." };
    }

    await prisma.traineeCoachingAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "in_progress",
        startedAt: new Date(),
      },
    });

    revalidatePath("/fieldtraining/coaching");
    return { success: true };
  } catch (err) {
    console.error("startCoachingActivity error:", err);
    return { success: false, error: "Failed to start activity." };
  }
}

/** Complete a coaching assignment with optional response/score */
export async function completeCoachingActivity(
  assignmentId: string,
  response?: string,
  score?: number
): Promise<ActionResult> {
  const session = await requireAuth();

  try {
    const assignment = await prisma.traineeCoachingAssignment.findUnique({
      where: { id: assignmentId },
      select: { traineeId: true, status: true },
    });

    if (!assignment) return { success: false, error: "Assignment not found." };
    if (assignment.traineeId !== session.userId) {
      return { success: false, error: "Not your assignment." };
    }

    await prisma.traineeCoachingAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "completed",
        progress: 100,
        completedAt: new Date(),
        response: response ?? null,
        score: score ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "COMPLETE",
        entity: "CoachingAssignment",
        entityId: assignmentId,
        details: `Trainee completed coaching activity`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/fieldtraining/coaching");
    revalidatePath("/fieldtraining");
    return { success: true };
  } catch (err) {
    console.error("completeCoachingActivity error:", err);
    return { success: false, error: "Failed to complete activity." };
  }
}

/** Update progress on a coaching assignment */
export async function updateCoachingProgress(
  assignmentId: string,
  progress: number
): Promise<ActionResult> {
  const session = await requireAuth();

  try {
    const assignment = await prisma.traineeCoachingAssignment.findUnique({
      where: { id: assignmentId },
      select: { traineeId: true },
    });

    if (!assignment) return { success: false, error: "Assignment not found." };
    if (assignment.traineeId !== session.userId) {
      return { success: false, error: "Not your assignment." };
    }

    await prisma.traineeCoachingAssignment.update({
      where: { id: assignmentId },
      data: { progress: Math.min(100, Math.max(0, progress)) },
    });

    return { success: true };
  } catch (err) {
    console.error("updateCoachingProgress error:", err);
    return { success: false, error: "Failed to update progress." };
  }
}
