"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const DepartmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["quality", "clinical", "education", "operations"]),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const DivisionSchema = z.object({
  departmentId: z.string().min(1, "Department ID is required"),
  name: z.string().min(1, "Division name is required").max(100),
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

// ---------------------------------------------------------------------------
// Department actions
// ---------------------------------------------------------------------------

export async function createDepartment(
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = DepartmentSchema.safeParse({
    name: raw.name,
    type: raw.type,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, type, description, sortOrder } = parsed.data;
  const slug = slugify(name);

  try {
    const existing = await prisma.department.findUnique({ where: { slug } });
    if (existing) {
      return {
        success: false,
        error: `A department with the slug "${slug}" already exists.`,
      };
    }

    const department = await prisma.department.create({
      data: { name, slug, type, description: description ?? null, sortOrder },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Department",
        entityId: department.id,
        details: `Created department "${name}" (${type})`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createDepartment error:", err);
    return { success: false, error: "Failed to create department." };
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin/departments");
}

export async function updateDepartment(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = DepartmentSchema.safeParse({
    name: raw.name,
    type: raw.type,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, type, description, sortOrder } = parsed.data;
  const slug = slugify(name);

  try {
    // Check for slug conflict with a different department
    const existing = await prisma.department.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: `Another department already uses the slug "${slug}".`,
      };
    }

    await prisma.department.update({
      where: { id },
      data: { name, slug, type, description: description ?? null, sortOrder },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Department",
        entityId: id,
        details: `Updated department "${name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateDepartment error:", err);
    return { success: false, error: "Failed to update department." };
  }

  revalidatePath("/admin/departments");
  revalidatePath(`/admin/departments/${id}`);
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function toggleDepartmentActive(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Department",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} department "${department.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleDepartmentActive error:", err);
    return { success: false, error: "Failed to toggle department status." };
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const department = await prisma.department.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!department) {
      return { success: false, error: "Department not found." };
    }

    await prisma.department.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Department",
        entityId: id,
        details: `Deleted department "${department.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteDepartment error:", err);
    return { success: false, error: "Failed to delete department." };
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin/departments");
}

// ---------------------------------------------------------------------------
// Division actions
// ---------------------------------------------------------------------------

export async function createDivision(
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = DivisionSchema.safeParse({
    departmentId: raw.departmentId,
    name: raw.name,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { departmentId, name, sortOrder } = parsed.data;
  const slug = slugify(name);

  try {
    const existing = await prisma.division.findUnique({
      where: { departmentId_slug: { departmentId, slug } },
    });
    if (existing) {
      return {
        success: false,
        error: `A division with the slug "${slug}" already exists in this department.`,
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
        details: `Created division "${name}" in department ${departmentId}`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createDivision error:", err);
    return { success: false, error: "Failed to create division." };
  }

  revalidatePath(`/admin/departments/${departmentId}`);
  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function updateDivision(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);
  const name = raw.name?.trim();

  if (!name) {
    return { success: false, error: "Division name is required." };
  }

  const slug = slugify(name);

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      select: { departmentId: true },
    });

    if (!division) {
      return { success: false, error: "Division not found." };
    }

    // Check for slug conflict within the same department
    const existing = await prisma.division.findUnique({
      where: {
        departmentId_slug: { departmentId: division.departmentId, slug },
      },
    });
    if (existing && existing.id !== id) {
      return {
        success: false,
        error: `Another division already uses the slug "${slug}" in this department.`,
      };
    }

    await prisma.division.update({
      where: { id },
      data: { name, slug },
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

    revalidatePath(`/admin/departments/${division.departmentId}`);
  } catch (err) {
    console.error("updateDivision error:", err);
    return { success: false, error: "Failed to update division." };
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function deleteDivision(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const division = await prisma.division.findUnique({
      where: { id },
      select: { name: true, departmentId: true },
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

    revalidatePath(`/admin/departments/${division.departmentId}`);
  } catch (err) {
    console.error("deleteDivision error:", err);
    return { success: false, error: "Failed to delete division." };
  }

  revalidatePath("/admin/departments");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}
