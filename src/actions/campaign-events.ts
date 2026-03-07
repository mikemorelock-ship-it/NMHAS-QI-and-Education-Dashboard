"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CampaignEventSchema = z.object({
  campaignId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  label: z.string().min(1, "Label is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(["milestone", "barrier", "event"]).default("milestone"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/campaigns");
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

function parseDate(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00Z");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createCampaignEvent(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = CampaignEventSchema.safeParse({
    campaignId: raw.campaignId,
    date: raw.date,
    label: raw.label,
    description: raw.description || null,
    category: raw.category || "milestone",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;

  try {
    const event = await prisma.campaignEvent.create({
      data: {
        campaignId: data.campaignId,
        date: parseDate(data.date),
        label: data.label,
        description: data.description ?? null,
        category: data.category,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "CampaignEvent",
        entityId: event.id,
        details: `Created ${data.category} "${data.label}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true, data: { id: event.id } };
  } catch (err) {
    console.error("createCampaignEvent error:", err);
    return { success: false, error: "Failed to create event." };
  }
}

export async function updateCampaignEvent(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = CampaignEventSchema.safeParse({
    campaignId: raw.campaignId,
    date: raw.date,
    label: raw.label,
    description: raw.description || null,
    category: raw.category || "milestone",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;

  try {
    await prisma.campaignEvent.update({
      where: { id },
      data: {
        date: parseDate(data.date),
        label: data.label,
        description: data.description ?? null,
        category: data.category,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "CampaignEvent",
        entityId: id,
        details: `Updated ${data.category} "${data.label}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("updateCampaignEvent error:", err);
    return { success: false, error: "Failed to update event." };
  }
}

export async function deleteCampaignEvent(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const event = await prisma.campaignEvent.findUnique({ where: { id } });
    if (!event) return { success: false, error: "Event not found." };

    await prisma.campaignEvent.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "CampaignEvent",
        entityId: id,
        details: `Deleted ${event.category} "${event.label}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("deleteCampaignEvent error:", err);
    return { success: false, error: "Failed to delete event." };
  }
}
