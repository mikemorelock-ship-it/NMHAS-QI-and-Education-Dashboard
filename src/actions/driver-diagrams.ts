"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DiagramSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  metricDefinitionId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const NodeSchema = z.object({
  driverDiagramId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  type: z.enum(["aim", "primary", "secondary", "changeIdea"]),
  text: z.string().min(1, "Text is required").max(500),
  description: z.string().max(1000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/driver-diagrams");
  revalidatePath("/admin/pdsa-cycles");
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

// ---------------------------------------------------------------------------
// Driver Diagram CRUD
// ---------------------------------------------------------------------------

export async function createDriverDiagram(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = DiagramSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    status: raw.status || "draft",
    metricDefinitionId: raw.metricDefinitionId || null,
    campaignId: raw.campaignId || null,
    sortOrder: raw.sortOrder ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    const existing = await prisma.driverDiagram.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: `A diagram with the slug "${slug}" already exists.` };
    }

    const diagram = await prisma.driverDiagram.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        status: data.status,
        metricDefinitionId: data.metricDefinitionId || null,
        campaignId: data.campaignId || null,
        sortOrder: data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "DriverDiagram",
        entityId: diagram.id,
        details: `Created driver diagram "${data.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true, data: { id: diagram.id } };
  } catch (err) {
    console.error("createDriverDiagram error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create driver diagram: ${msg.slice(0, 200)}` };
  }
}

export async function updateDriverDiagram(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = DiagramSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    status: raw.status || "draft",
    metricDefinitionId: raw.metricDefinitionId || null,
    campaignId: raw.campaignId || null,
    sortOrder: raw.sortOrder ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    const existing = await prisma.driverDiagram.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another diagram already uses the slug "${slug}".` };
    }

    await prisma.driverDiagram.update({
      where: { id },
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        status: data.status,
        metricDefinitionId: data.metricDefinitionId || null,
        campaignId: data.campaignId || null,
        sortOrder: data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DriverDiagram",
        entityId: id,
        details: `Updated driver diagram "${data.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateDriverDiagram error:", err);
    return { success: false, error: "Failed to update driver diagram." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteDriverDiagram(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const diagram = await prisma.driverDiagram.findUnique({ where: { id } });
    if (!diagram) return { success: false, error: "Diagram not found." };

    await prisma.driverDiagram.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "DriverDiagram",
        entityId: id,
        details: `Deleted driver diagram "${diagram.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteDriverDiagram error:", err);
    return { success: false, error: "Failed to delete driver diagram." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleDriverDiagramActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const diagram = await prisma.driverDiagram.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DriverDiagram",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} driver diagram "${diagram.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleDriverDiagramActive error:", err);
    return { success: false, error: "Failed to toggle diagram status." };
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Driver Node CRUD
// ---------------------------------------------------------------------------

export async function createDriverNode(formData: FormData): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = NodeSchema.safeParse({
    driverDiagramId: raw.driverDiagramId,
    parentId: raw.parentId || null,
    type: raw.type,
    text: raw.text,
    description: raw.description || null,
    sortOrder: raw.sortOrder ?? 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  try {
    // Validate parent belongs to same diagram
    if (data.parentId) {
      const parent = await prisma.driverNode.findUnique({ where: { id: data.parentId } });
      if (!parent || parent.driverDiagramId !== data.driverDiagramId) {
        return { success: false, error: "Parent node does not belong to this diagram." };
      }
    }

    const node = await prisma.driverNode.create({
      data: {
        driverDiagramId: data.driverDiagramId,
        parentId: data.parentId ?? null,
        type: data.type,
        text: data.text,
        description: data.description ?? null,
        sortOrder: data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "DriverNode",
        entityId: node.id,
        details: `Created ${data.type} node "${data.text}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true, data: { id: node.id } };
  } catch (err) {
    console.error("createDriverNode error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Foreign key constraint") || msg.includes("foreign key")) {
      return {
        success: false,
        error: "The driver diagram was not found. Please go back and create the diagram first.",
      };
    }
    return { success: false, error: `Failed to create node: ${msg.slice(0, 200)}` };
  }
}

export async function updateDriverNode(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);

  const text = raw.text;
  const description = raw.description || null;
  const sortOrder = parseInt(raw.sortOrder ?? "0", 10);

  if (!text || text.length === 0) {
    return { success: false, error: "Text is required." };
  }

  try {
    await prisma.driverNode.update({
      where: { id },
      data: { text, description, sortOrder },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DriverNode",
        entityId: id,
        details: `Updated node "${text}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateDriverNode error:", err);
    return { success: false, error: "Failed to update node." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteDriverNode(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const node = await prisma.driverNode.findUnique({ where: { id } });
    if (!node) return { success: false, error: "Node not found." };

    await prisma.driverNode.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "DriverNode",
        entityId: id,
        details: `Deleted ${node.type} node "${node.text}" and its descendants`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteDriverNode error:", err);
    return { success: false, error: "Failed to delete node." };
  }

  revalidateAll();
  return { success: true };
}

export async function reorderDriverNodes(
  nodeOrders: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.$transaction(
      nodeOrders.map((n) =>
        prisma.driverNode.update({
          where: { id: n.id },
          data: { sortOrder: n.sortOrder },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DriverNode",
        entityId: "bulk",
        details: `Reordered ${nodeOrders.length} driver nodes`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("reorderDriverNodes error:", err);
    return { success: false, error: "Failed to reorder nodes." };
  }

  revalidateAll();
  return { success: true };
}
