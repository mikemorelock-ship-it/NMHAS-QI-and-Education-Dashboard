"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Shared result type
// ---------------------------------------------------------------------------

export type ActionResult = {
  success: boolean;
  error?: string;
};

// ---------------------------------------------------------------------------
// Annotation Schemas & Actions
// ---------------------------------------------------------------------------

const AnnotationSchema = z.object({
  metricDefinitionId: z.string().min(1),
  date: z.string().min(1, "Date is required"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(["intervention", "milestone", "event"]),
});

export async function createAnnotation(
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((v, k) => (raw[k] = v.toString()));

  const parsed = AnnotationSchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    date: raw.date,
    title: raw.title,
    description: raw.description || null,
    type: raw.type,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const annotation = await prisma.metricAnnotation.create({
      data: {
        metricDefinitionId: parsed.data.metricDefinitionId,
        date: new Date(parsed.data.date + "T00:00:00"),
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "MetricAnnotation",
        entityId: annotation.id,
        details: `Created annotation "${parsed.data.title}" for metric ${parsed.data.metricDefinitionId}`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createAnnotation error:", err);
    return { success: false, error: "Failed to create annotation." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

export async function updateAnnotation(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((v, k) => (raw[k] = v.toString()));

  const parsed = AnnotationSchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    date: raw.date,
    title: raw.title,
    description: raw.description || null,
    type: raw.type,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.metricAnnotation.update({
      where: { id },
      data: {
        date: new Date(parsed.data.date + "T00:00:00"),
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        type: parsed.data.type,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricAnnotation",
        entityId: id,
        details: `Updated annotation "${parsed.data.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateAnnotation error:", err);
    return { success: false, error: "Failed to update annotation." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAnnotation(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const annotation = await prisma.metricAnnotation.findUnique({
      where: { id },
      select: { title: true },
    });

    await prisma.metricAnnotation.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "MetricAnnotation",
        entityId: id,
        details: `Deleted annotation "${annotation?.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteAnnotation error:", err);
    return { success: false, error: "Failed to delete annotation." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Resource Schemas & Actions
// ---------------------------------------------------------------------------

const ResourceSchema = z.object({
  metricDefinitionId: z.string().min(1),
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL").max(500),
  type: z.enum(["document", "link", "reference", "protocol"]),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function createResource(
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((v, k) => (raw[k] = v.toString()));

  const parsed = ResourceSchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    title: raw.title,
    url: raw.url,
    type: raw.type,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const resource = await prisma.metricResource.create({
      data: {
        metricDefinitionId: parsed.data.metricDefinitionId,
        title: parsed.data.title,
        url: parsed.data.url,
        type: parsed.data.type,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "MetricResource",
        entityId: resource.id,
        details: `Created resource "${parsed.data.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createResource error:", err);
    return { success: false, error: "Failed to create resource." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

export async function updateResource(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((v, k) => (raw[k] = v.toString()));

  const parsed = ResourceSchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    title: raw.title,
    url: raw.url,
    type: raw.type,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.metricResource.update({
      where: { id },
      data: {
        title: parsed.data.title,
        url: parsed.data.url,
        type: parsed.data.type,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricResource",
        entityId: id,
        details: `Updated resource "${parsed.data.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateResource error:", err);
    return { success: false, error: "Failed to update resource." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

export async function deleteResource(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const resource = await prisma.metricResource.findUnique({
      where: { id },
      select: { title: true },
    });

    await prisma.metricResource.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "MetricResource",
        entityId: id,
        details: `Deleted resource "${resource?.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteResource error:", err);
    return { success: false, error: "Failed to delete resource." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Responsible Party Schemas & Actions
// ---------------------------------------------------------------------------

const ResponsiblePartySchema = z.object({
  metricDefinitionId: z.string().min(1),
  name: z.string().min(1, "Name is required").max(150),
  role: z.string().min(1, "Role is required").max(150),
  email: z.string().email("Must be a valid email").max(250).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function createResponsibleParty(
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((v, k) => (raw[k] = v.toString()));

  const parsed = ResponsiblePartySchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    name: raw.name,
    role: raw.role,
    email: raw.email || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    const party = await prisma.metricResponsibleParty.create({
      data: {
        metricDefinitionId: parsed.data.metricDefinitionId,
        name: parsed.data.name,
        role: parsed.data.role,
        email: parsed.data.email ?? null,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "MetricResponsibleParty",
        entityId: party.id,
        details: `Created responsible party "${parsed.data.name}" (${parsed.data.role})`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createResponsibleParty error:", err);
    return { success: false, error: "Failed to create responsible party." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

export async function updateResponsibleParty(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((v, k) => (raw[k] = v.toString()));

  const parsed = ResponsiblePartySchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    name: raw.name,
    role: raw.role,
    email: raw.email || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  try {
    await prisma.metricResponsibleParty.update({
      where: { id },
      data: {
        name: parsed.data.name,
        role: parsed.data.role,
        email: parsed.data.email ?? null,
        sortOrder: parsed.data.sortOrder,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricResponsibleParty",
        entityId: id,
        details: `Updated responsible party "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateResponsibleParty error:", err);
    return { success: false, error: "Failed to update responsible party." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}

export async function deleteResponsibleParty(
  id: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const party = await prisma.metricResponsibleParty.findUnique({
      where: { id },
      select: { name: true },
    });

    await prisma.metricResponsibleParty.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "MetricResponsibleParty",
        entityId: id,
        details: `Deleted responsible party "${party?.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteResponsibleParty error:", err);
    return { success: false, error: "Failed to delete responsible party." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/");
  return { success: true };
}
