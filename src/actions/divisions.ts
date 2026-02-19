"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DivisionCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const DivisionUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type ActionResult = {
  success: boolean;
  error?: string;
};

function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    obj[key] = value.toString();
  });
  return obj;
}

function revalidateAll() {
  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/scorecards");
}

/**
 * Get (or create) a default Organization to assign new Divisions to.
 * The old Department model is hidden from UI but required as an FK parent for Division.
 */
async function getDefaultOrganizationId(): Promise<string> {
  // Look for existing active org, or any org
  let org = await prisma.department.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  if (!org) {
    org = await prisma.department.findFirst({
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  if (!org) {
    // Create a default one if none exist
    org = await prisma.department.create({
      data: {
        name: "Default Organization",
        slug: "default-organization",
        type: "operations",
        description: "Auto-created organization for division management",
        sortOrder: 0,
        isActive: true,
      },
    });
  }

  return org.id;
}

// ---------------------------------------------------------------------------
// Division CRUD Actions (for the new "Divisions & Departments" UI)
// ---------------------------------------------------------------------------

export async function createDivisionAction(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = DivisionCreateSchema.safeParse({
    name: raw.name,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, sortOrder } = parsed.data;
  const slug = slugify(name);

  try {
    const departmentId = await getDefaultOrganizationId();

    // Check slug uniqueness within the org
    const existing = await prisma.division.findUnique({
      where: { departmentId_slug: { departmentId, slug } },
    });
    if (existing) {
      return {
        success: false,
        error: `A division with the name "${name}" already exists.`,
      };
    }

    const division = await prisma.division.create({
      data: { departmentId, name, slug, sortOrder },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Division",
        entityId: division.id,
        details: `Created division "${name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createDivision error:", err);
    return { success: false, error: "Failed to create division." };
  }

  revalidateAll();
  return { success: true };
}

export async function updateDivisionAction(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = DivisionUpdateSchema.safeParse({
    name: raw.name,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, sortOrder } = parsed.data;
  const slug = slugify(name);

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      select: { departmentId: true },
    });

    if (!division) {
      return { success: false, error: "Division not found." };
    }

    // Check slug uniqueness within the same org
    const existing = await prisma.division.findUnique({
      where: {
        departmentId_slug: { departmentId: division.departmentId, slug },
      },
    });
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: `Another division already uses the name "${name}".`,
      };
    }

    await prisma.division.update({
      where: { id },
      data: { name, slug, sortOrder },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Division",
        entityId: id,
        details: `Updated division to "${name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateDivision error:", err);
    return { success: false, error: "Failed to update division." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleDivisionActive(id: string, isActive: boolean): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const division = await prisma.division.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Division",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} division "${division.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleDivisionActive error:", err);
    return { success: false, error: "Failed to toggle division status." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteDivisionAction(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!division) {
      return { success: false, error: "Division not found." };
    }

    await prisma.division.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Division",
        entityId: id,
        details: `Deleted division "${division.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteDivision error:", err);
    return { success: false, error: "Failed to delete division." };
  }

  revalidateAll();
  return { success: true };
}
