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

const JcaSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(["draft", "in_progress", "completed"]).default("draft"),
  incidentDate: z.string().optional().nullable(),
  responses: z.string().optional().nullable(),
  behaviorType: z
    .enum(["system_issue", "human_error", "at_risk", "reckless"])
    .optional()
    .nullable(),
  recommendation: z.enum(["system_fix", "console", "coach", "discipline"]).optional().nullable(),
  involvedPerson: z.string().max(200).optional().nullable(),
  involvedRole: z.string().max(200).optional().nullable(),
  supervisorNotes: z.string().max(5000).optional().nullable(),
  campaignId: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/just-culture");
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

export async function createJca(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = JcaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const jca = await prisma.justCultureAssessment.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        incidentDate: parseDate(parsed.data.incidentDate),
        responses: parsed.data.responses ?? null,
        behaviorType: parsed.data.behaviorType ?? null,
        recommendation: parsed.data.recommendation ?? null,
        involvedPerson: parsed.data.involvedPerson ?? null,
        involvedRole: parsed.data.involvedRole ?? null,
        supervisorNotes: parsed.data.supervisorNotes ?? null,
        campaignId: parsed.data.campaignId || null,
        createdById: session.userId,
      },
    });

    await createAuditLog({
      action: "create",
      entity: "JustCultureAssessment",
      entityId: jca.id,
      details: `Created JCA: ${parsed.data.title}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true, data: { id: jca.id } };
  } catch (err) {
    console.error("Failed to create JCA:", err);
    return { success: false, error: "Failed to create assessment" };
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateJca(id: string, data: Record<string, unknown>): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = JcaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.justCultureAssessment.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
        incidentDate: parseDate(parsed.data.incidentDate),
        responses: parsed.data.responses ?? null,
        behaviorType: parsed.data.behaviorType ?? null,
        recommendation: parsed.data.recommendation ?? null,
        involvedPerson: parsed.data.involvedPerson ?? null,
        involvedRole: parsed.data.involvedRole ?? null,
        supervisorNotes: parsed.data.supervisorNotes ?? null,
        campaignId: parsed.data.campaignId || null,
      },
    });

    await createAuditLog({
      action: "update",
      entity: "JustCultureAssessment",
      entityId: id,
      details: `Updated JCA: ${parsed.data.title}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to update JCA:", err);
    return { success: false, error: "Failed to update assessment" };
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteJca(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const jca = await prisma.justCultureAssessment.findUnique({
      where: { id },
    });
    if (!jca) return { success: false, error: "Assessment not found" };

    await prisma.justCultureAssessment.delete({ where: { id } });

    await createAuditLog({
      action: "delete",
      entity: "JustCultureAssessment",
      entityId: id,
      details: `Deleted JCA: ${jca.title}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to delete JCA:", err);
    return { success: false, error: "Failed to delete assessment" };
  }
}
