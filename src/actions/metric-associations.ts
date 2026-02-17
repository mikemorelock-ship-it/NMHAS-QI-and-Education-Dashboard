"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/require-auth";

interface AssociationInput {
  divisionId?: string | null;
  regionId?: string | null; // Region in DB = "Department" in UI
}

/**
 * Replace all associations for a metric with the given set.
 * Each association links a metric to a Division and/or a Department (Region in DB).
 */
export async function setMetricAssociations(
  metricDefinitionId: string,
  associations: AssociationInput[]
) {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    // Delete existing associations
    await prisma.metricAssociation.deleteMany({
      where: { metricDefinitionId },
    });

    // Create new associations (filter out empty entries)
    const validAssociations = associations.filter(
      (a) => a.divisionId || a.regionId
    );

    if (validAssociations.length > 0) {
      await prisma.metricAssociation.createMany({
        data: validAssociations.map((a) => ({
          metricDefinitionId,
          divisionId: a.divisionId || null,
          regionId: a.regionId || null,
        })),
      });
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricAssociation",
        entityId: metricDefinitionId,
        details: `Set ${validAssociations.length} associations`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidatePath("/admin/metrics");
    revalidatePath("/scorecards");
    return { success: true };
  } catch (error) {
    console.error("Failed to set metric associations:", error);
    return { success: false, error: "Failed to update associations." };
  }
}

/**
 * Get all associations for a metric definition.
 */
export async function getMetricAssociations(metricDefinitionId: string) {
  try {
    const associations = await prisma.metricAssociation.findMany({
      where: { metricDefinitionId },
      include: {
        division: { select: { id: true, name: true } },
        region: { select: { id: true, name: true, divisionId: true } },
      },
    });

    return associations.map((a) => ({
      id: a.id,
      divisionId: a.divisionId,
      divisionName: a.division?.name ?? null,
      regionId: a.regionId,
      regionName: a.region?.name ?? null,
      regionDivisionId: a.region?.divisionId ?? null,
    }));
  } catch (error) {
    console.error("Failed to get metric associations:", error);
    return [];
  }
}
