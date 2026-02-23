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
  keyFindings: z.string().max(5000).optional().nullable(),
  status: z.enum(["planning", "active", "completed", "archived"]).default("planning"),
  ownerId: z.string().optional().nullable(),
  metricDefinitionId: z.string().optional().nullable(),
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
    // Skip array keys (handled separately)
    if (!key.endsWith("[]")) {
      raw[key] = value.toString();
    }
  });
  return raw;
}

function getFormDataArray(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((v) => v.toString())
    .filter(Boolean);
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
  const divisionIds = getFormDataArray(formData, "divisionIds[]");
  const regionIds = getFormDataArray(formData, "regionIds[]");

  const parsed = CampaignSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    goals: raw.goals || null,
    keyFindings: raw.keyFindings || null,
    status: raw.status || "planning",
    ownerId: raw.ownerId && raw.ownerId !== "__none__" ? raw.ownerId : null,
    metricDefinitionId:
      raw.metricDefinitionId && raw.metricDefinitionId !== "__none__"
        ? raw.metricDefinitionId
        : null,
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
        keyFindings: data.keyFindings ?? null,
        status: data.status,
        ownerId: data.ownerId || null,
        metricDefinitionId: data.metricDefinitionId || null,
        startDate: parseDate(data.startDate),
        endDate: parseDate(data.endDate),
        sortOrder: data.sortOrder,
      },
    });

    // Create division scope records
    if (divisionIds.length > 0) {
      await prisma.campaignDivision.createMany({
        data: divisionIds.map((divisionId) => ({
          campaignId: campaign.id,
          divisionId,
        })),
      });
    }

    // Create region (department) scope records
    if (regionIds.length > 0) {
      await prisma.campaignRegion.createMany({
        data: regionIds.map((regionId) => ({
          campaignId: campaign.id,
          regionId,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Campaign",
        entityId: campaign.id,
        details: `Created campaign "${data.name}" with ${divisionIds.length} divisions and ${regionIds.length} departments`,
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
        error: "Invalid owner or metric selected. Please choose valid options or leave unassigned.",
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
  const divisionIds = getFormDataArray(formData, "divisionIds[]");
  const regionIds = getFormDataArray(formData, "regionIds[]");

  const parsed = CampaignSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    goals: raw.goals || null,
    keyFindings: raw.keyFindings || null,
    status: raw.status || "planning",
    ownerId: raw.ownerId && raw.ownerId !== "__none__" ? raw.ownerId : null,
    metricDefinitionId:
      raw.metricDefinitionId && raw.metricDefinitionId !== "__none__"
        ? raw.metricDefinitionId
        : null,
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
        keyFindings: data.keyFindings ?? null,
        status: data.status,
        ownerId: data.ownerId || null,
        metricDefinitionId: data.metricDefinitionId || null,
        startDate: parseDate(data.startDate),
        endDate: parseDate(data.endDate),
        sortOrder: data.sortOrder,
      },
    });

    // Replace division scope records
    await prisma.campaignDivision.deleteMany({ where: { campaignId: id } });
    if (divisionIds.length > 0) {
      await prisma.campaignDivision.createMany({
        data: divisionIds.map((divisionId) => ({
          campaignId: id,
          divisionId,
        })),
      });
    }

    // Replace region (department) scope records
    await prisma.campaignRegion.deleteMany({ where: { campaignId: id } });
    if (regionIds.length > 0) {
      await prisma.campaignRegion.createMany({
        data: regionIds.map((regionId) => ({
          campaignId: id,
          regionId,
        })),
      });
    }

    const changes = computeChanges(
      {
        name: current.name,
        status: current.status,
        goals: current.goals,
        keyFindings: current.keyFindings,
        ownerId: current.ownerId,
        metricDefinitionId: current.metricDefinitionId,
        description: current.description,
      },
      {
        name: data.name,
        status: data.status,
        goals: data.goals ?? null,
        keyFindings: data.keyFindings ?? null,
        ownerId: data.ownerId || null,
        metricDefinitionId: data.metricDefinitionId || null,
        description: data.description ?? null,
      }
    );

    await createAuditLog({
      action: "UPDATE",
      entity: "Campaign",
      entityId: id,
      details: `Updated campaign "${data.name}" with ${divisionIds.length} divisions and ${regionIds.length} departments`,
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
        error: "Invalid owner or metric selected. Please choose valid options or leave unassigned.",
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

// ---------------------------------------------------------------------------
// Campaign Share Links
// ---------------------------------------------------------------------------

export async function createCampaignShareLink(
  campaignId: string
): Promise<ActionResult<{ token: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return { success: false, error: "Campaign not found." };

    const shareLink = await prisma.campaignShareLink.create({
      data: {
        campaignId,
        createdById: session.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "CampaignShareLink",
        entityId: shareLink.id,
        details: `Created share link for campaign "${campaign.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    return { success: true, data: { token: shareLink.token } };
  } catch (err) {
    console.error("createCampaignShareLink error:", err);
    return { success: false, error: "Failed to create share link." };
  }
}

// ---------------------------------------------------------------------------
// Granular field-level update — used by admin inline edit mode
// ---------------------------------------------------------------------------

const CampaignFieldSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(2000).nullable().optional(),
  goals: z.string().max(2000).nullable().optional(),
  keyFindings: z.string().max(5000).nullable().optional(),
  status: z.enum(["planning", "active", "completed", "archived"]).optional(),
  ownerId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export async function updateCampaignField(
  id: string,
  field: string,
  value: string | null
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  // Validate the field name
  const allowedFields = [
    "name",
    "description",
    "goals",
    "keyFindings",
    "status",
    "ownerId",
    "startDate",
    "endDate",
  ];
  if (!allowedFields.includes(field)) {
    return { success: false, error: `Field "${field}" is not editable.` };
  }

  // Validate the value
  const parsed = CampaignFieldSchema.safeParse({ [field]: value });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const current = await prisma.campaign.findUnique({ where: { id } });
    if (!current) return { success: false, error: "Campaign not found." };

    // Build the update data
    const updateData: Record<string, unknown> = {};
    if (field === "startDate" || field === "endDate") {
      updateData[field] = parseDate(value);
    } else if (field === "ownerId") {
      updateData[field] = value || null;
    } else if (field === "name") {
      updateData.name = value;
      updateData.slug = slugify(value!);
    } else {
      updateData[field] = value ?? null;
    }

    await prisma.campaign.update({ where: { id }, data: updateData });

    await createAuditLog({
      action: "UPDATE",
      entity: "Campaign",
      entityId: id,
      details: `Inline update: ${field} on "${current.name}"`,
      changes: {
        [field]: {
          from: String(current[field as keyof typeof current] ?? ""),
          to: String(value ?? ""),
        },
      },
      actorId: session.userId,
      actorType: "user",
    });
  } catch (err) {
    console.error("updateCampaignField error:", err);
    return { success: false, error: "Failed to update field." };
  }

  revalidateAll();
  return { success: true };
}

export async function revokeCampaignShareLink(linkId: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_campaigns");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.campaignShareLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "CampaignShareLink",
        entityId: linkId,
        details: "Revoked campaign share link",
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("revokeCampaignShareLink error:", err);
    return { success: false, error: "Failed to revoke share link." };
  }

  return { success: true };
}
