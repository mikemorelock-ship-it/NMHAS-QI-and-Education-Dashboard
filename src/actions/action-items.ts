"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";
import { createAuditLog, computeChanges } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ActionItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(["open", "in_progress", "completed", "overdue"]).default("open"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  pdsaCycleId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/action-items");
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/qi-workflow");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/quality-improvement");
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });
  return raw;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Action Item CRUD
// ---------------------------------------------------------------------------

export async function createActionItem(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_action_items");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = ActionItemSchema.safeParse({
    title: raw.title,
    description: raw.description || null,
    status: raw.status || "open",
    priority: raw.priority || "medium",
    dueDate: raw.dueDate || null,
    campaignId: raw.campaignId || null,
    pdsaCycleId: raw.pdsaCycleId || null,
    assigneeId: raw.assigneeId || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  try {
    const item = await prisma.actionItem.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        dueDate: parseDate(data.dueDate),
        completedAt: data.status === "completed" ? new Date() : null,
        campaignId: data.campaignId || null,
        pdsaCycleId: data.pdsaCycleId || null,
        assigneeId: data.assigneeId || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "ActionItem",
        entityId: item.id,
        details: `Created action item "${data.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createActionItem error:", err);
    return { success: false, error: "Failed to create action item." };
  }

  revalidateAll();
  return { success: true };
}

export async function updateActionItem(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_action_items");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = ActionItemSchema.safeParse({
    title: raw.title,
    description: raw.description || null,
    status: raw.status || "open",
    priority: raw.priority || "medium",
    dueDate: raw.dueDate || null,
    campaignId: raw.campaignId || null,
    pdsaCycleId: raw.pdsaCycleId || null,
    assigneeId: raw.assigneeId || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  try {
    const existing = await prisma.actionItem.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Action item not found." };

    // Auto-set completedAt when marking complete
    const completedAt =
      data.status === "completed" && existing.status !== "completed"
        ? new Date()
        : data.status !== "completed"
          ? null
          : existing.completedAt;

    await prisma.actionItem.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        dueDate: parseDate(data.dueDate),
        completedAt,
        campaignId: data.campaignId || null,
        pdsaCycleId: data.pdsaCycleId || null,
        assigneeId: data.assigneeId || null,
      },
    });

    const changes = computeChanges(
      {
        title: existing.title,
        status: existing.status,
        priority: existing.priority,
        assigneeId: existing.assigneeId,
        dueDate: existing.dueDate?.toISOString() ?? null,
      },
      {
        title: data.title,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ?? null,
      }
    );

    await createAuditLog({
      action: "UPDATE",
      entity: "ActionItem",
      entityId: id,
      details: `Updated action item "${data.title}"`,
      changes: changes ?? undefined,
      actorId: session.userId,
      actorType: "user",
    });
  } catch (err) {
    console.error("updateActionItem error:", err);
    return { success: false, error: "Failed to update action item." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteActionItem(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_action_items");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const item = await prisma.actionItem.findUnique({ where: { id } });
    if (!item) return { success: false, error: "Action item not found." };

    await prisma.actionItem.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "ActionItem",
        entityId: id,
        details: `Deleted action item "${item.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteActionItem error:", err);
    return { success: false, error: "Failed to delete action item." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleActionItemStatus(id: string, status: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_action_items");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const item = await prisma.actionItem.findUnique({ where: { id } });
    if (!item) return { success: false, error: "Action item not found." };

    const completedAt = status === "completed" ? new Date() : null;

    await prisma.actionItem.update({
      where: { id },
      data: { status, completedAt },
    });

    const changes = computeChanges({ status: item.status }, { status });

    await createAuditLog({
      action: "UPDATE",
      entity: "ActionItem",
      entityId: id,
      details: `Changed action item "${item.title}" status to ${status}`,
      changes: changes ?? undefined,
      actorId: session.userId,
      actorType: "user",
    });
  } catch (err) {
    console.error("toggleActionItemStatus error:", err);
    return { success: false, error: "Failed to update action item status." };
  }

  revalidateAll();
  return { success: true };
}
