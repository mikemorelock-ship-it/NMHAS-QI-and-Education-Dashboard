"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/require-auth";
import { analyzeFocusAreas, type FocusArea, type TraineeAnalysisInput } from "@/lib/focus-areas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FocusAreasResult =
  | { success: true; focusAreas: FocusArea[] }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * Fetch trainee data from the database and run the focus area analysis engine.
 *
 * Permission: create_edit_own_dors — FTOs, supervisors, managers, and admins
 * can call this to get focus-area recommendations for any trainee.
 */
export async function getTraineeFocusAreas(traineeId: string): Promise<FocusAreasResult> {
  try {
    await requirePermission("create_edit_own_dors");
  } catch {
    return { success: false, error: "Not authenticated or insufficient permissions." };
  }

  if (!traineeId) {
    return { success: false, error: "Trainee ID is required." };
  }

  try {
    // Verify trainee exists
    const trainee = await prisma.user.findUnique({
      where: { id: traineeId },
      select: { id: true, role: true },
    });

    if (!trainee || trainee.role !== "trainee") {
      return { success: false, error: "Trainee not found." };
    }

    // ---- Fetch last 20 submitted DORs with category ratings ----
    const dors = await prisma.dailyEvaluation.findMany({
      where: {
        traineeId,
        status: "submitted",
      },
      orderBy: { date: "desc" },
      take: 20,
      select: {
        date: true,
        overallRating: true,
        recommendAction: true,
        ratings: {
          select: {
            rating: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // ---- Fetch incomplete coaching assignments ----
    const coachingAssignments = await prisma.traineeCoachingAssignment.findMany({
      where: {
        traineeId,
        status: { in: ["assigned", "in_progress"] },
      },
      select: {
        status: true,
        activity: {
          select: {
            title: true,
          },
        },
      },
    });

    // ---- Fetch critical skills without signoff for this trainee ----
    const unsignedCriticalSkills = await prisma.skill.findMany({
      where: {
        isCritical: true,
        isActive: true,
        skillSignoffs: {
          none: {
            traineeId,
          },
        },
      },
      select: {
        name: true,
      },
    });

    // ---- Build analysis input ----
    const analysisInput: TraineeAnalysisInput = {
      recentDors: dors.map((d) => ({
        date: d.date.toISOString(),
        overallRating: d.overallRating,
        recommendAction: d.recommendAction,
        ratings: d.ratings.map((r) => ({
          categoryName: r.category.name,
          categoryId: r.category.id,
          rating: r.rating,
        })),
      })),
      incompleteCoaching: coachingAssignments.map((a) => ({
        activityTitle: a.activity.title,
        status: a.status,
      })),
      unsignedCriticalSkills: unsignedCriticalSkills.map((s) => ({
        skillName: s.name,
      })),
    };

    // ---- Run analysis ----
    const focusAreas = analyzeFocusAreas(analysisInput);

    return { success: true, focusAreas };
  } catch (err) {
    console.error("getTraineeFocusAreas error:", err);
    return { success: false, error: "Failed to analyze trainee focus areas." };
  }
}
