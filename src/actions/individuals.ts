"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RegionSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  role: z.string().max(100).optional().nullable(),
  divisionId: z.string().min(1, "Division is required"),
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

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createIndividual(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = RegionSchema.safeParse({
    name: raw.name,
    role: raw.role || null,
    divisionId: raw.divisionId,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, role, divisionId } = parsed.data;

  try {
    // Verify division exists
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: { id: true, name: true },
    });
    if (!division) {
      return { success: false, error: "Selected division does not exist." };
    }

    const region = await prisma.region.create({
      data: {
        name,
        role: role ?? null,
        divisionId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Region",
        entityId: region.id,
        details: `Created region "${name}" (${role ?? "no type"}) in division "${division.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createRegion error:", err);
    return { success: false, error: "Failed to create region." };
  }

  revalidateAll();
  return { success: true };
}

export async function updateIndividual(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToObject(formData);

  const parsed = RegionSchema.safeParse({
    name: raw.name,
    role: raw.role || null,
    divisionId: raw.divisionId,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { name, role, divisionId } = parsed.data;

  try {
    const existing = await prisma.region.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return { success: false, error: "Region not found." };
    }

    await prisma.region.update({
      where: { id },
      data: {
        name,
        role: role ?? null,
        divisionId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Region",
        entityId: id,
        details: `Updated region "${name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updateRegion error:", err);
    return { success: false, error: "Failed to update region." };
  }

  revalidateAll();
  return { success: true };
}

export async function toggleIndividualActive(id: string, isActive: boolean): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const region = await prisma.region.update({
      where: { id },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Region",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} region "${region.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("toggleRegionActive error:", err);
    return { success: false, error: "Failed to toggle region status." };
  }

  revalidateAll();
  return { success: true };
}

export async function deleteIndividual(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_departments");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const region = await prisma.region.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!region) {
      return { success: false, error: "Region not found." };
    }

    await prisma.region.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Region",
        entityId: id,
        details: `Deleted region "${region.name}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteRegion error:", err);
    return { success: false, error: "Failed to delete region." };
  }

  revalidateAll();
  return { success: true };
}
