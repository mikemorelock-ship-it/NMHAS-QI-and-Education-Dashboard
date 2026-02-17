import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Coaching Engine — auto-assigns remedial activities based on poor DOR scores
// ---------------------------------------------------------------------------

/** Rating at or below this threshold triggers coaching activity assignment */
export const POOR_SCORE_THRESHOLD = 3;

/**
 * After a DOR is submitted, check each category rating.
 * For any rating ≤ POOR_SCORE_THRESHOLD, assign available coaching activities
 * for that category to the trainee (if not already assigned and incomplete).
 *
 * Returns the number of new assignments created.
 */
export async function assignCoachingForDor(dorId: string): Promise<number> {
  // Load the DOR with its category ratings
  const dor = await prisma.dailyEvaluation.findUnique({
    where: { id: dorId },
    select: {
      id: true,
      traineeId: true,
      ratings: {
        select: { categoryId: true, rating: true },
      },
    },
  });

  if (!dor) return 0;

  // Find categories with poor scores
  const poorCategoryIds = dor.ratings
    .filter((r) => r.rating <= POOR_SCORE_THRESHOLD)
    .map((r) => r.categoryId);

  if (poorCategoryIds.length === 0) return 0;

  // Fetch active coaching activities for those categories
  const activities = await prisma.coachingActivity.findMany({
    where: {
      categoryId: { in: poorCategoryIds },
      isActive: true,
    },
    select: { id: true, categoryId: true },
  });

  if (activities.length === 0) return 0;

  // Fetch existing assignments for this trainee that are not completed
  // (so we don't re-assign activities the trainee already has)
  const existingAssignments = await prisma.traineeCoachingAssignment.findMany({
    where: {
      traineeId: dor.traineeId,
      activityId: { in: activities.map((a) => a.id) },
      status: { in: ["assigned", "in_progress"] },
    },
    select: { activityId: true },
  });

  const alreadyAssignedIds = new Set(existingAssignments.map((a) => a.activityId));

  // Create new assignments for activities not already in-flight
  const newAssignments = activities
    .filter((a) => !alreadyAssignedIds.has(a.id))
    .map((a) => ({
      traineeId: dor.traineeId,
      activityId: a.id,
      dorId: dor.id,
      status: "assigned" as const,
      progress: 0,
    }));

  if (newAssignments.length === 0) return 0;

  // Create assignments one by one, skipping duplicates
  for (const assignment of newAssignments) {
    try {
      await prisma.traineeCoachingAssignment.create({ data: assignment });
    } catch {
      // Skip duplicate — unique constraint violation
    }
  }

  return newAssignments.length;
}
