"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-auth";

interface YearTargetInput {
  year: number;
  target: number;
}

/**
 * Replace all year-specific targets for a metric with the given set.
 */
export async function setMetricYearTargets(metricDefinitionId: string, targets: YearTargetInput[]) {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    // Delete existing year targets
    await prisma.metricYearTarget.deleteMany({
      where: { metricDefinitionId },
    });

    // Create new year targets (filter out invalid entries)
    const validTargets = targets.filter(
      (t) =>
        Number.isFinite(t.year) && t.year >= 2020 && t.year <= 2100 && Number.isFinite(t.target)
    );

    if (validTargets.length > 0) {
      await prisma.metricYearTarget.createMany({
        data: validTargets.map((t) => ({
          metricDefinitionId,
          year: t.year,
          target: t.target,
        })),
      });
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricYearTarget",
        entityId: metricDefinitionId,
        details: `Set ${validTargets.length} year-specific target(s)`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidatePath("/admin/metrics");
    revalidatePath("/scorecards");
    return { success: true };
  } catch (error) {
    console.error("Failed to set metric year targets:", error);
    return { success: false, error: "Failed to update year targets." };
  }
}

/**
 * Get all year-specific targets for a metric definition.
 */
export async function getMetricYearTargets(metricDefinitionId: string) {
  try {
    const targets = await prisma.metricYearTarget.findMany({
      where: { metricDefinitionId },
      orderBy: { year: "asc" },
      select: { year: true, target: true },
    });

    return targets;
  } catch (error) {
    console.error("Failed to get metric year targets:", error);
    return [];
  }
}
