"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const CategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sortOrder: z.coerce.number().int().min(0).default(0),
  color: z.string().max(20).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/reference-data");
  revalidatePath("/admin/metrics");
  revalidatePath("/admin/scorecards");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/scorecards");
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createCategory(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_categories");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });

  const parsed = CategorySchema.safeParse({
    name: raw.name,
    sortOrder: raw.sortOrder || 0,
    color: raw.color || null,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, sortOrder, color } = parsed.data;
  const slug = slugify(name);

  try {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return {
        success: false,
        error: `A category with the name "${name}" already exists.`,
      };
    }

    const category = await prisma.category.create({
      data: { name, slug, sortOrder, color: color ?? null },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Category",
        entityId: category.id,
        details: `Created category "${name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createCategory error:", err);
    return { success: false, error: "Failed to create category." };
  }

  revalidateAll();
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_categories");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });

  const parsed = CategorySchema.safeParse({
    name: raw.name,
    sortOrder: raw.sortOrder || 0,
    color: raw.color || null,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, sortOrder, color } = parsed.data;
  const slug = slugify(name);

  try {
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: `Another category already uses the name "${name}".`,
      };
    }

    await prisma.category.update({
      where: { id },
      data: { name, slug, sortOrder, color: color ?? null },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Category",
        entityId: id,
        details: `Updated category to "${name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateCategory error:", err);
    return { success: false, error: "Failed to update category." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_categories");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Category",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} category "${category.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleCategoryActive error:", err);
    return { success: false, error: "Failed to toggle category status." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_categories");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { metricDefinitions: true } } },
    });

    if (!category) {
      return { success: false, error: "Category not found." };
    }

    if (category._count.metricDefinitions > 0) {
      // Set metrics to null instead of blocking deletion
      await prisma.metricDefinition.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      });
    }

    await prisma.category.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Category",
        entityId: id,
        details: `Deleted category "${category.name}" (${category._count.metricDefinitions} metrics unlinked)`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteCategory error:", err);
    return { success: false, error: "Failed to delete category." };
  }

  revalidateAll();
  return { success: true };
}
