"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "fs/promises";
import path from "path";
import os from "os";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/require-auth";

type ActionResult = { success: boolean; error?: string };

function getStoragePath(): string {
  return (
    process.env.RESOURCE_STORAGE_PATH ||
    path.join(os.homedir(), ".local", "ems-dashboard", "resources")
  );
}

/** Fetch all resource documents with metadata */
export async function getResourceDocuments() {
  await requirePermission("manage_resources");

  const docs = await prisma.resourceDocument.findMany({
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { coachingActivities: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    fileName: d.fileName,
    fileType: d.fileType,
    fileSize: d.fileSize,
    textLength: d.textLength,
    description: d.description,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
    uploadedBy: `${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`,
    activityCount: d._count.coachingActivities,
  }));
}

/** Get a single resource document with text content preview */
export async function getResourceDocument(id: string) {
  await requirePermission("manage_resources");

  const doc = await prisma.resourceDocument.findUnique({
    where: { id },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { coachingActivities: true } },
    },
  });

  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.title,
    fileName: doc.fileName,
    fileType: doc.fileType,
    fileSize: doc.fileSize,
    textContent: doc.textContent,
    textLength: doc.textLength,
    description: doc.description,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
    uploadedBy: `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}`,
    activityCount: doc._count.coachingActivities,
  };
}

/** Update a resource document's title and description */
export async function updateResourceDocument(
  id: string,
  data: { title: string; description: string }
): Promise<ActionResult> {
  const session = await requirePermission("manage_resources");

  try {
    await prisma.resourceDocument.update({
      where: { id },
      data: { title: data.title, description: data.description || null },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "ResourceDocument",
        entityId: id,
        details: `Updated resource document "${data.title}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/resources");
    return { success: true };
  } catch (err) {
    console.error("updateResourceDocument error:", err);
    return { success: false, error: "Failed to update resource." };
  }
}

/** Delete a resource document (only if no coaching activities are linked) */
export async function deleteResourceDocument(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_resources");

  try {
    const doc = await prisma.resourceDocument.findUnique({
      where: { id },
      include: { _count: { select: { coachingActivities: true } } },
    });

    if (!doc) return { success: false, error: "Resource not found." };

    if (doc._count.coachingActivities > 0) {
      // Deactivate instead of deleting if activities reference it
      await prisma.resourceDocument.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          action: "DEACTIVATE",
          entity: "ResourceDocument",
          entityId: id,
          details: `Deactivated resource "${doc.title}" (${doc._count.coachingActivities} linked activities)`,
          actorId: session.userId,
          actorType: "user",
        },
      });
    } else {
      // Safe to delete — remove file from disk too
      try {
        const filePath = path.join(getStoragePath(), doc.filePath);
        await unlink(filePath);
      } catch {
        // File may not exist — continue with DB deletion
      }

      await prisma.resourceDocument.delete({ where: { id } });

      await prisma.auditLog.create({
        data: {
          action: "DELETE",
          entity: "ResourceDocument",
          entityId: id,
          details: `Deleted resource "${doc.title}"`,
          actorId: session.userId,
          actorType: "user",
        },
      });
    }

    revalidatePath("/admin/field-training/resources");
    return { success: true };
  } catch (err) {
    console.error("deleteResourceDocument error:", err);
    return { success: false, error: "Failed to delete resource." };
  }
}

/** Toggle active status of a resource document */
export async function toggleResourceActive(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_resources");

  try {
    const doc = await prisma.resourceDocument.findUnique({
      where: { id },
      select: { isActive: true, title: true },
    });

    if (!doc) return { success: false, error: "Resource not found." };

    const newStatus = !doc.isActive;
    await prisma.resourceDocument.update({
      where: { id },
      data: { isActive: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        action: newStatus ? "ACTIVATE" : "DEACTIVATE",
        entity: "ResourceDocument",
        entityId: id,
        details: `${newStatus ? "Activated" : "Deactivated"} resource "${doc.title}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/resources");
    return { success: true };
  } catch (err) {
    console.error("toggleResourceActive error:", err);
    return { success: false, error: "Failed to toggle resource status." };
  }
}
