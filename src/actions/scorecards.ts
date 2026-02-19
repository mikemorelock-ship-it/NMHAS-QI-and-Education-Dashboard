"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ScorecardSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseScorecardFormData(formData: FormData) {
  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });

  return {
    parsed: ScorecardSchema.safeParse({
      name: raw.name,
      description: raw.description || null,
      sortOrder: raw.sortOrder || 0,
    }),
    divisionIds: (raw.divisionIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    regionIds: (raw.regionIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    metricIds: (raw.metricIds ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    metricGroups: parseMetricGroups(raw.metricGroups ?? ""),
  };
}

function parseMetricGroups(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

function revalidateAll() {
  revalidatePath("/admin/scorecards");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/scorecards");
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createScorecard(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_scorecards");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const { parsed, divisionIds, regionIds, metricIds, metricGroups } =
    parseScorecardFormData(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    const existing = await prisma.scorecard.findUnique({
      where: { slug },
    });
    if (existing) {
      return {
        success: false,
        error: `A scorecard with the slug "${slug}" already exists.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      const scorecard = await tx.scorecard.create({
        data: {
          name: data.name,
          slug,
          description: data.description ?? null,
          sortOrder: data.sortOrder,
        },
      });

      // Create division associations
      if (divisionIds.length > 0) {
        await tx.scorecardDivision.createMany({
          data: divisionIds.map((divisionId) => ({
            scorecardId: scorecard.id,
            divisionId,
          })),
        });
      }

      // Create region associations
      if (regionIds.length > 0) {
        await tx.scorecardRegion.createMany({
          data: regionIds.map((regionId) => ({
            scorecardId: scorecard.id,
            regionId,
          })),
        });
      }

      // Create metric associations with sortOrder and groupName
      if (metricIds.length > 0) {
        await tx.scorecardMetric.createMany({
          data: metricIds.map((metricDefinitionId, index) => ({
            scorecardId: scorecard.id,
            metricDefinitionId,
            sortOrder: index,
            groupName: metricGroups[metricDefinitionId] || null,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "Scorecard",
          entityId: scorecard.id,
          details: `Created scorecard "${data.name}" with ${metricIds.length} metrics, ${divisionIds.length} divisions, ${regionIds.length} departments`,
          actorId: session.userId,
          actorType: "admin",
        },
      });
    });
  } catch (err) {
    console.error("createScorecard error:", err);
    return { success: false, error: "Failed to create scorecard." };
  }

  revalidateAll();
  return { success: true };
}

export async function updateScorecard(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_scorecards");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const { parsed, divisionIds, regionIds, metricIds, metricGroups } =
    parseScorecardFormData(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    const existing = await prisma.scorecard.findUnique({
      where: { slug },
    });
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: `Another scorecard already uses the slug "${slug}".`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.scorecard.update({
        where: { id },
        data: {
          name: data.name,
          slug,
          description: data.description ?? null,
          sortOrder: data.sortOrder,
        },
      });

      // Replace division associations
      await tx.scorecardDivision.deleteMany({
        where: { scorecardId: id },
      });
      if (divisionIds.length > 0) {
        await tx.scorecardDivision.createMany({
          data: divisionIds.map((divisionId) => ({
            scorecardId: id,
            divisionId,
          })),
        });
      }

      // Replace region associations
      await tx.scorecardRegion.deleteMany({
        where: { scorecardId: id },
      });
      if (regionIds.length > 0) {
        await tx.scorecardRegion.createMany({
          data: regionIds.map((regionId) => ({
            scorecardId: id,
            regionId,
          })),
        });
      }

      // Replace metric assignments
      await tx.scorecardMetric.deleteMany({
        where: { scorecardId: id },
      });
      if (metricIds.length > 0) {
        await tx.scorecardMetric.createMany({
          data: metricIds.map((metricDefinitionId, index) => ({
            scorecardId: id,
            metricDefinitionId,
            sortOrder: index,
            groupName: metricGroups[metricDefinitionId] || null,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "Scorecard",
          entityId: id,
          details: `Updated scorecard "${data.name}" with ${metricIds.length} metrics, ${divisionIds.length} divisions, ${regionIds.length} departments`,
          actorId: session.userId,
          actorType: "admin",
        },
      });
    });
  } catch (err) {
    console.error("updateScorecard error:", err);
    return { success: false, error: "Failed to update scorecard." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteScorecard(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_scorecards");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const scorecard = await prisma.scorecard.findUnique({ where: { id } });
    if (!scorecard) {
      return { success: false, error: "Scorecard not found." };
    }

    await prisma.scorecard.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Scorecard",
        entityId: id,
        details: `Deleted scorecard "${scorecard.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteScorecard error:", err);
    return { success: false, error: "Failed to delete scorecard." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleScorecardActive(id: string, isActive: boolean): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_scorecards");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const scorecard = await prisma.scorecard.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Scorecard",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} scorecard "${scorecard.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleScorecardActive error:", err);
    return { success: false, error: "Failed to toggle scorecard status." };
  }

  revalidateAll();
  return { success: true };
}
