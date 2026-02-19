"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";
import { createAuditLog, computeChanges } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CampaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(2000).optional().nullable(),
  goals: z.string().max(2000).optional().nullable(),
  status: z.enum(["planning", "active", "completed", "archived"]).default("planning"),
  ownerId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/driver-diagrams");
  revalidatePath("/admin/action-items");
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
// Campaign CRUD
// ---------------------------------------------------------------------------

export async function createCampaign(formData: FormData): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = CampaignSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    goals: raw.goals || null,
    status: raw.status || "planning",
    ownerId: raw.ownerId && raw.ownerId !== "__none__" ? raw.ownerId : null,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    sortOrder: raw.sortOrder ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    const existing = await prisma.campaign.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: `A campaign with the slug "${slug}" already exists.` };
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        goals: data.goals ?? null,
        status: data.status,
        ownerId: data.ownerId || null,
        startDate: parseDate(data.startDate),
        endDate: parseDate(data.endDate),
        sortOrder: data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Campaign",
        entityId: campaign.id,
        details: `Created campaign "${data.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true, data: { id: campaign.id } };
  } catch (err) {
    console.error("createCampaign error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    // Surface useful constraint messages to the user
    if (msg.includes("Foreign key constraint") || msg.includes("foreign key")) {
      return {
        success: false,
        error: "Invalid owner selected. Please choose a valid user or leave unassigned.",
      };
    }
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return {
        success: false,
        error: "A campaign with this name already exists. Please choose a different name.",
      };
    }
    return { success: false, error: `Failed to create campaign: ${msg.slice(0, 200)}` };
  }
}

export async function updateCampaign(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = CampaignSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    goals: raw.goals || null,
    status: raw.status || "planning",
    ownerId: raw.ownerId && raw.ownerId !== "__none__" ? raw.ownerId : null,
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    sortOrder: raw.sortOrder ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    // Fetch current state for change tracking
    const current = await prisma.campaign.findUnique({ where: { id } });
    if (!current) {
      return { success: false, error: "Campaign not found." };
    }

    // Check slug conflict
    if (slug !== current.slug) {
      const existing = await prisma.campaign.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        return { success: false, error: `Another campaign already uses the slug "${slug}".` };
      }
    }

    await prisma.campaign.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        goals: data.goals ?? null,
        status: data.status,
        ownerId: data.ownerId || null,
        startDate: parseDate(data.startDate),
        endDate: parseDate(data.endDate),
        sortOrder: data.sortOrder,
      },
    });

    const changes = computeChanges(
      {
        name: current.name,
        status: current.status,
        goals: current.goals,
        ownerId: current.ownerId,
        description: current.description,
      },
      {
        name: data.name,
        status: data.status,
        goals: data.goals ?? null,
        ownerId: data.ownerId || null,
        description: data.description ?? null,
      },
    );

    await createAuditLog({
      action: "UPDATE",
      entity: "Campaign",
      entityId: id,
      details: `Updated campaign "${data.name}"`,
      changes: changes ?? undefined,
      actorId: session.userId,
      actorType: "user",
    });
  } catch (err) {
    console.error("updateCampaign error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Foreign key constraint") || msg.includes("foreign key")) {
      return {
        success: false,
        error: "Invalid owner selected. Please choose a valid user or leave unassigned.",
      };
    }
    return { success: false, error: `Failed to update campaign: ${msg.slice(0, 200)}` };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return { success: false, error: "Campaign not found." };

    await prisma.campaign.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Campaign",
        entityId: id,
        details: `Deleted campaign "${campaign.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteCampaign error:", err);
    return { success: false, error: "Failed to delete campaign." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleCampaignActive(id: string, isActive: boolean): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Campaign",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} campaign "${campaign.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleCampaignActive error:", err);
    return { success: false, error: "Failed to toggle campaign status." };
  }

  revalidateAll();
  return { success: true };
}

export async function assignDiagramToCampaign(
  diagramId: string,
  campaignId: string | null
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const diagram = await prisma.driverDiagram.update({
      where: { id: diagramId },
      data: { campaignId: campaignId || null },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DriverDiagram",
        entityId: diagramId,
        details: campaignId
          ? `Assigned diagram "${diagram.name}" to campaign`
          : `Removed diagram "${diagram.name}" from campaign`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("assignDiagramToCampaign error:", err);
    return { success: false, error: "Failed to update diagram assignment." };
  }

  revalidateAll();
  return { success: true };
}
