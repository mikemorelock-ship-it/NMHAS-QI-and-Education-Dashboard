"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";
import { createAuditLog } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RcaSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  method: z.enum(["fishbone", "five_whys", "combined"]).default("fishbone"),
  status: z.enum(["draft", "in_progress", "completed", "archived"]).default("draft"),
  severity: z.enum(["low", "medium", "high", "critical"]).optional().nullable(),
  incidentDate: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  // JSON fields
  people: z.string().optional().nullable(),
  process: z.string().optional().nullable(),
  equipment: z.string().optional().nullable(),
  environment: z.string().optional().nullable(),
  management: z.string().optional().nullable(),
  materials: z.string().optional().nullable(),
  whyChain: z.string().optional().nullable(),
  rootCauses: z.string().optional().nullable(),
  contributingFactors: z.string().optional().nullable(),
  correctiveActions: z.string().optional().nullable(),
  preventiveActions: z.string().optional().nullable(),
  summary: z.string().max(5000).optional().nullable(),
  recommendations: z.string().max(5000).optional().nullable(),
  lessonsLearned: z.string().max(5000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/root-cause-analysis");
  revalidatePath("/admin/qi-workflow");
  revalidatePath("/admin");
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createRca(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = RcaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const rca = await prisma.rootCauseAnalysis.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        method: parsed.data.method,
        status: parsed.data.status,
        severity: parsed.data.severity ?? null,
        incidentDate: parseDate(parsed.data.incidentDate),
        campaignId: parsed.data.campaignId || null,
        createdById: session.userId,
        people: parsed.data.people ?? null,
        process: parsed.data.process ?? null,
        equipment: parsed.data.equipment ?? null,
        environment: parsed.data.environment ?? null,
        management: parsed.data.management ?? null,
        materials: parsed.data.materials ?? null,
        whyChain: parsed.data.whyChain ?? null,
        rootCauses: parsed.data.rootCauses ?? null,
        contributingFactors: parsed.data.contributingFactors ?? null,
        correctiveActions: parsed.data.correctiveActions ?? null,
        preventiveActions: parsed.data.preventiveActions ?? null,
        summary: parsed.data.summary ?? null,
        recommendations: parsed.data.recommendations ?? null,
        lessonsLearned: parsed.data.lessonsLearned ?? null,
      },
    });

    await createAuditLog({
      action: "create",
      entity: "RootCauseAnalysis",
      entityId: rca.id,
      details: `Created RCA: ${parsed.data.title}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true, data: { id: rca.id } };
  } catch (err) {
    console.error("Failed to create RCA:", err);
    return { success: false, error: "Failed to create root cause analysis" };
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateRca(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = RcaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.rootCauseAnalysis.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        method: parsed.data.method,
        status: parsed.data.status,
        severity: parsed.data.severity ?? null,
        incidentDate: parseDate(parsed.data.incidentDate),
        campaignId: parsed.data.campaignId || null,
        people: parsed.data.people ?? null,
        process: parsed.data.process ?? null,
        equipment: parsed.data.equipment ?? null,
        environment: parsed.data.environment ?? null,
        management: parsed.data.management ?? null,
        materials: parsed.data.materials ?? null,
        whyChain: parsed.data.whyChain ?? null,
        rootCauses: parsed.data.rootCauses ?? null,
        contributingFactors: parsed.data.contributingFactors ?? null,
        correctiveActions: parsed.data.correctiveActions ?? null,
        preventiveActions: parsed.data.preventiveActions ?? null,
        summary: parsed.data.summary ?? null,
        recommendations: parsed.data.recommendations ?? null,
        lessonsLearned: parsed.data.lessonsLearned ?? null,
      },
    });

    await createAuditLog({
      action: "update",
      entity: "RootCauseAnalysis",
      entityId: id,
      details: `Updated RCA: ${parsed.data.title}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to update RCA:", err);
    return { success: false, error: "Failed to update root cause analysis" };
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteRca(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const rca = await prisma.rootCauseAnalysis.findUnique({ where: { id } });
    if (!rca) return { success: false, error: "RCA not found" };

    await prisma.rootCauseAnalysis.delete({ where: { id } });

    await createAuditLog({
      action: "delete",
      entity: "RootCauseAnalysis",
      entityId: id,
      details: `Deleted RCA: ${rca.title}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to delete RCA:", err);
    return { success: false, error: "Failed to delete root cause analysis" };
  }
}
