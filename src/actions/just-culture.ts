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
    .enum(["system_issue", "human_error", "at_risk", "reckless", "intentional_harm", "incapacity"])
    .optional()
    .nullable(),
  recommendation: z
    .enum(["system_fix", "console", "coach", "discipline", "referral", "health_pathway"])
    .optional()
    .nullable(),
  involvedPerson: z.string().max(200).optional().nullable(),
  involvedRole: z.string().max(200).optional().nullable(),
  supervisorNotes: z.string().max(5000).optional().nullable(),
  campaignId: z.string().optional().nullable(),
});

const PublicJcaSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional().nullable(),
  incidentDate: z.string().optional().nullable(),
  responses: z.string().optional().nullable(),
  behaviorType: z
    .enum(["system_issue", "human_error", "at_risk", "reckless", "intentional_harm", "incapacity"])
    .optional()
    .nullable(),
  recommendation: z
    .enum(["system_fix", "console", "coach", "discipline", "referral", "health_pathway"])
    .optional()
    .nullable(),
  involvedPerson: z.string().max(200).optional().nullable(),
  involvedRole: z.string().max(200).optional().nullable(),
  submitterName: z.string().max(200).optional().nullable(),
  submitterEmail: z.string().email().max(200).optional().nullable().or(z.literal("")),
  shareToken: z.string().min(1),
});

const ShareLinkSchema = z.object({
  label: z.string().max(200).optional().nullable(),
  expiresAt: z.string().optional().nullable(),
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
// Create (admin)
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
// Update (admin)
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
// Delete (admin)
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

// ---------------------------------------------------------------------------
// Create Public JCA (no auth — uses share link token)
// ---------------------------------------------------------------------------

export async function createPublicJca(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string }>> {
  const parsed = PublicJcaSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  // Validate the share link
  try {
    const link = await prisma.jcaShareLink.findUnique({
      where: { token: parsed.data.shareToken },
    });

    if (!link || !link.isActive) {
      return { success: false, error: "This share link is invalid or has been deactivated" };
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return { success: false, error: "This share link has expired" };
    }

    const jca = await prisma.justCultureAssessment.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: "completed",
        incidentDate: parseDate(parsed.data.incidentDate),
        responses: parsed.data.responses ?? null,
        behaviorType: parsed.data.behaviorType ?? null,
        recommendation: parsed.data.recommendation ?? null,
        involvedPerson: parsed.data.involvedPerson ?? null,
        involvedRole: parsed.data.involvedRole ?? null,
        submitterName: parsed.data.submitterName ?? null,
        submitterEmail: parsed.data.submitterEmail || null,
        shareToken: parsed.data.shareToken,
        createdById: null,
      },
    });

    await createAuditLog({
      action: "create",
      entity: "JustCultureAssessment",
      entityId: jca.id,
      details: `Public JCA submission: ${parsed.data.title} (via share link)`,
      actorId: "public",
      actorType: "system",
    });

    revalidateAll();
    return { success: true, data: { id: jca.id } };
  } catch (err) {
    console.error("Failed to create public JCA:", err);
    return { success: false, error: "Failed to save assessment" };
  }
}

// ---------------------------------------------------------------------------
// Share link CRUD (admin)
// ---------------------------------------------------------------------------

export async function createJcaShareLink(
  data: Record<string, unknown>
): Promise<ActionResult<{ id: string; token: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = ShareLinkSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const link = await prisma.jcaShareLink.create({
      data: {
        label: parsed.data.label ?? null,
        expiresAt: parseDate(parsed.data.expiresAt),
        createdById: session.userId,
      },
    });

    await createAuditLog({
      action: "create",
      entity: "JcaShareLink",
      entityId: link.id,
      details: `Created JCA share link: ${parsed.data.label ?? "(no label)"}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true, data: { id: link.id, token: link.token } };
  } catch (err) {
    console.error("Failed to create share link:", err);
    return { success: false, error: "Failed to create share link" };
  }
}

export async function deleteJcaShareLink(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const link = await prisma.jcaShareLink.findUnique({ where: { id } });
    if (!link) return { success: false, error: "Share link not found" };

    await prisma.jcaShareLink.delete({ where: { id } });

    await createAuditLog({
      action: "delete",
      entity: "JcaShareLink",
      entityId: id,
      details: `Deleted JCA share link: ${link.label ?? link.token}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to delete share link:", err);
    return { success: false, error: "Failed to delete share link" };
  }
}

export async function toggleJcaShareLink(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const link = await prisma.jcaShareLink.findUnique({ where: { id } });
    if (!link) return { success: false, error: "Share link not found" };

    await prisma.jcaShareLink.update({
      where: { id },
      data: { isActive: !link.isActive },
    });

    await createAuditLog({
      action: "update",
      entity: "JcaShareLink",
      entityId: id,
      details: `${link.isActive ? "Deactivated" : "Activated"} JCA share link: ${link.label ?? link.token}`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to toggle share link:", err);
    return { success: false, error: "Failed to toggle share link" };
  }
}
