"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";
import { createAuditLog } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MapSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(2000).optional().nullable(),
});

const NodeSchema = z.object({
  mapId: z.string().min(1),
  nodeType: z.enum(["org_unit", "individual", "external", "process"]),
  label: z.string().min(1, "Label is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  linkedEntityType: z.string().optional().nullable(),
  linkedEntityId: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
});

const EdgeSchema = z.object({
  mapId: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  relationshipType: z.enum([
    "reporting",
    "collaboration",
    "process_flow",
    "influence",
  ]),
  label: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/ecosystem-map");
}

// ---------------------------------------------------------------------------
// Map CRUD
// ---------------------------------------------------------------------------

export async function getEcosystemMaps() {
  await requireAdmin("manage_ecosystem_maps");

  return prisma.ecosystemMap.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { nodes: true, edges: true } },
    },
  });
}

export async function getEcosystemMap(id: string) {
  await requireAdmin("manage_ecosystem_maps");

  return prisma.ecosystemMap.findUnique({
    where: { id },
    include: {
      nodes: { orderBy: { createdAt: "asc" } },
      edges: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function createEcosystemMap(
  data: z.infer<typeof MapSchema>,
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = MapSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const slug = slugify(parsed.data.name);

    // Ensure unique slug
    const existing = await prisma.ecosystemMap.findUnique({
      where: { slug },
    });
    const finalSlug = existing
      ? `${slug}-${Date.now().toString(36)}`
      : slug;

    const map = await prisma.ecosystemMap.create({
      data: {
        name: parsed.data.name,
        slug: finalSlug,
        description: parsed.data.description ?? null,
        createdById: session.userId,
      },
    });

    await createAuditLog({
      action: "create",
      entity: "EcosystemMap",
      entityId: map.id,
      details: `Created ecosystem map "${map.name}"`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true, data: { id: map.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create map",
    };
  }
}

export async function updateEcosystemMap(
  id: string,
  data: z.infer<typeof MapSchema>,
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = MapSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.ecosystemMap.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });

    await createAuditLog({
      action: "update",
      entity: "EcosystemMap",
      entityId: id,
      details: `Updated ecosystem map "${parsed.data.name}"`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update map",
    };
  }
}

export async function deleteEcosystemMap(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const map = await prisma.ecosystemMap.delete({ where: { id } });

    await createAuditLog({
      action: "delete",
      entity: "EcosystemMap",
      entityId: id,
      details: `Deleted ecosystem map "${map.name}"`,
      actorId: session.userId,
      actorType: "user",
    });

    revalidateAll();
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete map",
    };
  }
}

// ---------------------------------------------------------------------------
// Node CRUD
// ---------------------------------------------------------------------------

export async function createEcosystemNode(
  data: z.infer<typeof NodeSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = NodeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const node = await prisma.ecosystemNode.create({
      data: {
        mapId: parsed.data.mapId,
        nodeType: parsed.data.nodeType,
        label: parsed.data.label,
        description: parsed.data.description ?? null,
        positionX: parsed.data.positionX,
        positionY: parsed.data.positionY,
        linkedEntityType: parsed.data.linkedEntityType ?? null,
        linkedEntityId: parsed.data.linkedEntityId ?? null,
        color: parsed.data.color ?? null,
      },
    });

    return { success: true, data: { id: node.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create node",
    };
  }
}

export async function updateEcosystemNode(
  id: string,
  data: Partial<z.infer<typeof NodeSchema>>,
): Promise<ActionResult> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.ecosystemNode.update({
      where: { id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.description !== undefined && {
          description: data.description ?? null,
        }),
        ...(data.nodeType !== undefined && { nodeType: data.nodeType }),
        ...(data.positionX !== undefined && { positionX: data.positionX }),
        ...(data.positionY !== undefined && { positionY: data.positionY }),
        ...(data.color !== undefined && { color: data.color ?? null }),
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update node",
    };
  }
}

export async function updateNodePositions(
  updates: { id: string; positionX: number; positionY: number }[],
): Promise<ActionResult> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.ecosystemNode.update({
          where: { id: u.id },
          data: { positionX: u.positionX, positionY: u.positionY },
        }),
      ),
    );

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update positions",
    };
  }
}

export async function deleteEcosystemNode(id: string): Promise<ActionResult> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.ecosystemNode.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete node",
    };
  }
}

// ---------------------------------------------------------------------------
// Edge CRUD
// ---------------------------------------------------------------------------

export async function createEcosystemEdge(
  data: z.infer<typeof EdgeSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = EdgeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const edge = await prisma.ecosystemEdge.create({
      data: {
        mapId: parsed.data.mapId,
        sourceNodeId: parsed.data.sourceNodeId,
        targetNodeId: parsed.data.targetNodeId,
        relationshipType: parsed.data.relationshipType,
        label: parsed.data.label ?? null,
        description: parsed.data.description ?? null,
      },
    });

    return { success: true, data: { id: edge.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create edge",
    };
  }
}

export async function updateEcosystemEdge(
  id: string,
  data: Partial<z.infer<typeof EdgeSchema>>,
): Promise<ActionResult> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.ecosystemEdge.update({
      where: { id },
      data: {
        ...(data.relationshipType !== undefined && {
          relationshipType: data.relationshipType,
        }),
        ...(data.label !== undefined && { label: data.label ?? null }),
        ...(data.description !== undefined && {
          description: data.description ?? null,
        }),
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update edge",
    };
  }
}

export async function deleteEcosystemEdge(id: string): Promise<ActionResult> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.ecosystemEdge.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete edge",
    };
  }
}

// ---------------------------------------------------------------------------
// Import from existing org data
// ---------------------------------------------------------------------------

export async function importOrgData(
  mapId: string,
  options: {
    divisions?: boolean;
    departments?: boolean;
    users?: boolean;
  },
): Promise<ActionResult<{ nodeCount: number }>> {
  try {
    await requireAdmin("manage_ecosystem_maps");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const nodesToCreate: {
      mapId: string;
      nodeType: string;
      label: string;
      positionX: number;
      positionY: number;
      linkedEntityType: string;
      linkedEntityId: string;
    }[] = [];

    let yOffset = 0;

    if (options.divisions) {
      const divisions = await prisma.division.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      // Check for already-imported divisions
      const existing = await prisma.ecosystemNode.findMany({
        where: {
          mapId,
          linkedEntityType: "division",
          linkedEntityId: { in: divisions.map((d) => d.id) },
        },
        select: { linkedEntityId: true },
      });
      const existingIds = new Set(existing.map((e) => e.linkedEntityId));

      divisions
        .filter((d) => !existingIds.has(d.id))
        .forEach((d, i) => {
          nodesToCreate.push({
            mapId,
            nodeType: "org_unit",
            label: d.name,
            positionX: 100 + (i % 4) * 250,
            positionY: 100 + yOffset + Math.floor(i / 4) * 150,
            linkedEntityType: "division",
            linkedEntityId: d.id,
          });
        });

      yOffset += Math.ceil(divisions.length / 4) * 150 + 100;
    }

    if (options.departments) {
      const regions = await prisma.region.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: { division: { select: { name: true } } },
      });

      const existing = await prisma.ecosystemNode.findMany({
        where: {
          mapId,
          linkedEntityType: "region",
          linkedEntityId: { in: regions.map((r) => r.id) },
        },
        select: { linkedEntityId: true },
      });
      const existingIds = new Set(existing.map((e) => e.linkedEntityId));

      regions
        .filter((r) => !existingIds.has(r.id))
        .forEach((r, i) => {
          nodesToCreate.push({
            mapId,
            nodeType: "org_unit",
            label: r.name,
            positionX: 100 + (i % 5) * 220,
            positionY: 100 + yOffset + Math.floor(i / 5) * 130,
            linkedEntityType: "region",
            linkedEntityId: r.id,
          });
        });

      yOffset += Math.ceil(regions.length / 5) * 130 + 100;
    }

    if (options.users) {
      const users = await prisma.user.findMany({
        where: { isActive: true, status: "active" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      const existing = await prisma.ecosystemNode.findMany({
        where: {
          mapId,
          linkedEntityType: "user",
          linkedEntityId: { in: users.map((u) => u.id) },
        },
        select: { linkedEntityId: true },
      });
      const existingIds = new Set(existing.map((e) => e.linkedEntityId));

      users
        .filter((u) => !existingIds.has(u.id))
        .forEach((u, i) => {
          nodesToCreate.push({
            mapId,
            nodeType: "individual",
            label: `${u.firstName} ${u.lastName}`,
            positionX: 100 + (i % 5) * 220,
            positionY: 100 + yOffset + Math.floor(i / 5) * 130,
            linkedEntityType: "user",
            linkedEntityId: u.id,
          });
        });
    }

    if (nodesToCreate.length > 0) {
      await prisma.ecosystemNode.createMany({ data: nodesToCreate });
    }

    revalidateAll();
    return { success: true, data: { nodeCount: nodesToCreate.length } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to import org data",
    };
  }
}
