"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const MetricDefinitionSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  parentId: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(500).optional().nullable(),
  dataDefinition: z.string().max(2000).optional().nullable(),
  methodology: z.string().max(2000).optional().nullable(),
  unit: z.enum(["count", "currency", "percentage", "duration", "score", "rate"]),
  chartType: z.enum(["line", "bar", "area"]).default("line"),
  periodType: z.enum(["daily", "weekly", "bi-weekly", "monthly", "quarterly", "annual"]).default("monthly"),
  category: z.string().max(100).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isKpi: z.boolean().default(false),
  target: z.coerce.number().optional().nullable(),
  aggregationType: z.enum(["sum", "average", "min", "max", "latest"]).default("average"),
  dataType: z.enum(["continuous", "proportion", "rate"]).default("continuous"),
  spcSigmaLevel: z.coerce.number().int().min(1).max(3).default(3),
  baselineStart: z.string().optional().nullable(),
  baselineEnd: z.string().optional().nullable(),
  numeratorLabel: z.string().max(50).optional().nullable(),
  denominatorLabel: z.string().max(50).optional().nullable(),
  rateMultiplier: z.coerce.number().int().positive().optional().nullable(),
  rateSuffix: z.string().max(100).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type ActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  data?: T;
};

function parseMetricFormData(formData: FormData) {
  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });

  return MetricDefinitionSchema.safeParse({
    departmentId: raw.departmentId,
    parentId: raw.parentId && raw.parentId !== "none" ? raw.parentId : null,
    name: raw.name,
    description: raw.description || null,
    dataDefinition: raw.dataDefinition || null,
    methodology: raw.methodology || null,
    unit: raw.unit,
    chartType: raw.chartType || "line",
    periodType: raw.periodType || "monthly",
    category: raw.category || null,
    sortOrder: raw.sortOrder || 0,
    isKpi: raw.isKpi === "on" || raw.isKpi === "true",
    target: raw.target ? parseFloat(raw.target) : null,
    aggregationType: raw.aggregationType || "average",
    dataType: raw.dataType || "continuous",
    spcSigmaLevel: raw.spcSigmaLevel || 3,
    baselineStart: raw.baselineStart || null,
    baselineEnd: raw.baselineEnd || null,
    numeratorLabel: raw.numeratorLabel || null,
    denominatorLabel: raw.denominatorLabel || null,
    rateMultiplier: raw.rateMultiplier ? parseInt(raw.rateMultiplier, 10) : null,
    rateSuffix: raw.rateSuffix || null,
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createMetricDefinition(
  formData: FormData
): Promise<ActionResult<{ id: string; name: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = parseMetricFormData(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    // Check for unique slug within department
    const existing = await prisma.metricDefinition.findUnique({
      where: { departmentId_slug: { departmentId: data.departmentId, slug } },
    });
    if (existing) {
      return {
        success: false,
        error: `A metric with the slug "${slug}" already exists in this department.`,
      };
    }

    // Validate parent metric if specified
    if (data.parentId) {
      const parent = await prisma.metricDefinition.findUnique({
        where: { id: data.parentId },
        select: { id: true, parentId: true },
      });
      if (!parent) {
        return { success: false, error: "Parent metric not found." };
      }
      if (parent.parentId) {
        return { success: false, error: "Cannot nest more than one level deep (no grandchildren)." };
      }
    }

    const metric = await prisma.metricDefinition.create({
      data: {
        departmentId: data.departmentId,
        parentId: data.parentId ?? null,
        name: data.name,
        slug,
        description: data.description ?? null,
        dataDefinition: data.dataDefinition ?? null,
        methodology: data.methodology ?? null,
        unit: data.unit,
        chartType: data.chartType,
        periodType: data.periodType,
        categoryLegacy: data.category ?? null,
        sortOrder: data.sortOrder,
        isKpi: data.isKpi,
        target: data.target ?? null,
        aggregationType: data.aggregationType,
        dataType: data.dataType,
        spcSigmaLevel: data.spcSigmaLevel,
        baselineStart: data.baselineStart ? new Date(data.baselineStart + "T12:00:00.000Z") : null,
        baselineEnd: data.baselineEnd ? new Date(data.baselineEnd + "T12:00:00.000Z") : null,
        numeratorLabel: data.numeratorLabel ?? null,
        denominatorLabel: data.denominatorLabel ?? null,
        rateMultiplier: data.rateMultiplier ?? null,
        rateSuffix: data.rateSuffix ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "MetricDefinition",
        entityId: metric.id,
        details: `Created metric "${data.name}" (${data.unit}) for department ${data.departmentId}${data.parentId ? ` as child of ${data.parentId}` : ""}`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
    revalidatePath("/admin/metrics");
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, data: { id: metric.id, name: data.name } };
  } catch (err) {
    console.error("createMetricDefinition error:", err);
    return { success: false, error: "Failed to create metric definition." };
  }
}

export async function updateMetricDefinition(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const parsed = parseMetricFormData(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;
  const slug = slugify(data.name);

  try {
    // Check for slug conflict with a different metric in same department
    const existing = await prisma.metricDefinition.findUnique({
      where: { departmentId_slug: { departmentId: data.departmentId, slug } },
    });
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: `Another metric already uses the slug "${slug}" in this department.`,
      };
    }

    // Validate parent metric if specified
    if (data.parentId) {
      if (data.parentId === id) {
        return { success: false, error: "A metric cannot be its own parent." };
      }
      const parent = await prisma.metricDefinition.findUnique({
        where: { id: data.parentId },
        select: { id: true, parentId: true },
      });
      if (!parent) {
        return { success: false, error: "Parent metric not found." };
      }
      if (parent.parentId) {
        return { success: false, error: "Cannot nest more than one level deep (no grandchildren)." };
      }
      // Prevent making a parent into a child (if this metric already has children)
      const childCount = await prisma.metricDefinition.count({
        where: { parentId: id },
      });
      if (childCount > 0) {
        return { success: false, error: "This metric has children and cannot become a sub-metric itself." };
      }
    }

    await prisma.metricDefinition.update({
      where: { id },
      data: {
        departmentId: data.departmentId,
        parentId: data.parentId ?? null,
        name: data.name,
        slug,
        description: data.description ?? null,
        dataDefinition: data.dataDefinition ?? null,
        methodology: data.methodology ?? null,
        unit: data.unit,
        chartType: data.chartType,
        periodType: data.periodType,
        categoryLegacy: data.category ?? null,
        sortOrder: data.sortOrder,
        isKpi: data.isKpi,
        target: data.target ?? null,
        aggregationType: data.aggregationType,
        dataType: data.dataType,
        spcSigmaLevel: data.spcSigmaLevel,
        baselineStart: data.baselineStart ? new Date(data.baselineStart + "T12:00:00.000Z") : null,
        baselineEnd: data.baselineEnd ? new Date(data.baselineEnd + "T12:00:00.000Z") : null,
        numeratorLabel: data.numeratorLabel ?? null,
        denominatorLabel: data.denominatorLabel ?? null,
        rateMultiplier: data.rateMultiplier ?? null,
        rateSuffix: data.rateSuffix ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricDefinition",
        entityId: id,
        details: `Updated metric "${data.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateMetricDefinition error:", err);
    return { success: false, error: "Failed to update metric definition." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function toggleMetricActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const metric = await prisma.metricDefinition.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricDefinition",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} metric "${metric.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleMetricActive error:", err);
    return { success: false, error: "Failed to toggle metric status." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function updateMetricSortOrders(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.metricDefinition.update({
          where: { id: u.id },
          data: { sortOrder: u.sortOrder },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "MetricDefinition",
        entityId: "bulk",
        details: `Bulk-updated sort order for ${updates.length} metrics`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateMetricSortOrders error:", err);
    return { success: false, error: "Failed to update sort orders." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/admin");
  revalidatePath("/scorecards");
  revalidatePath("/");

  return { success: true };
}

export async function deleteMetricDefinition(
  id: string
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_metric_defs");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const metric = await prisma.metricDefinition.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!metric) {
      return { success: false, error: "Metric definition not found." };
    }

    await prisma.metricDefinition.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "MetricDefinition",
        entityId: id,
        details: `Deleted metric "${metric.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteMetricDefinition error:", err);
    return { success: false, error: "Failed to delete metric definition." };
  }

  revalidatePath("/admin/metrics");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}
