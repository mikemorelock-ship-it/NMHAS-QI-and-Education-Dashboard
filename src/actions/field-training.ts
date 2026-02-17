"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { hashPassword } from "@/lib/auth";
import { requirePermission, requireAuth } from "@/lib/require-auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import { buildDorNotificationEmail } from "@/lib/email-templates";
import { assignCoachingForDor } from "@/lib/coaching-engine";

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

function revalidateFieldTraining() {
  revalidatePath("/admin/field-training", "layout");
}

// ---------------------------------------------------------------------------
// DOR Email Notification Helper
// ---------------------------------------------------------------------------

async function notifyDorSubmission(dorId: string): Promise<void> {
  if (!isEmailConfigured()) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Fetch full DOR with trainee, FTO, ratings
  const dor = await prisma.dailyEvaluation.findUnique({
    where: { id: dorId },
    include: {
      trainee: { select: { firstName: true, lastName: true } },
      fto: { select: { firstName: true, lastName: true } },
      phase: { select: { name: true } },
      ratings: {
        include: { category: { select: { name: true, sortOrder: true } } },
        orderBy: { category: { sortOrder: "asc" } },
      },
    },
  });

  if (!dor) return;

  // Fetch all active supervisors and managers with email addresses
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ["supervisor", "manager"] },
      status: "active",
      email: { not: "" },
    },
    select: { email: true },
  });

  if (recipients.length === 0) return;

  const emailData = {
    dorId: dor.id,
    traineeName: `${dor.trainee.firstName} ${dor.trainee.lastName}`,
    ftoName: `${dor.fto.firstName} ${dor.fto.lastName}`,
    date: dor.date.toISOString(),
    phaseName: dor.phase?.name ?? null,
    overallRating: dor.overallRating,
    narrative: dor.narrative,
    recommendAction: dor.recommendAction,
    nrtFlag: dor.nrtFlag,
    remFlag: dor.remFlag,
    mostSatisfactory: dor.mostSatisfactory,
    leastSatisfactory: dor.leastSatisfactory,
    ratings: dor.ratings.map((r) => ({
      categoryName: r.category.name,
      rating: r.rating,
      comments: r.comments,
    })),
    portalUrl: siteUrl,
  };

  const { subject, html } = buildDorNotificationEmail(emailData);
  const emails = recipients.map((r) => r.email);

  await sendEmail({ to: emails, subject, html });

  // Audit log the notification
  await prisma.auditLog.create({
    data: {
      action: "NOTIFY",
      entity: "DailyObservationReport",
      entityId: dorId,
      details: `DOR notification sent to ${emails.length} supervisor(s)/manager(s)`,
      actorId: dor.ftoId,
      actorType: "system",
    },
  });
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const TraineeSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  employeeId: z.string().min(1, "Employee ID is required").max(50),
  email: z.string().email("Valid email is required"),
  hireDate: z.coerce.date(),
  divisionId: z.string().optional().nullable(),
  status: z.enum(["active", "completed", "separated", "remediation"]).default("active"),
  startDate: z.coerce.date(),
  notes: z.string().max(2000).optional().nullable(),
});

const FtoSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  employeeId: z.string().min(1, "Employee ID is required").max(50),
  email: z.string().email("Valid email is required"),
  badgeNumber: z.string().max(50).optional().nullable(),
  divisionId: z.string().optional().nullable(),
  role: z.enum(["fto", "supervisor", "manager", "admin"]).default("fto"),
});

const TrainingPhaseSchema = z.object({
  name: z.string().min(1, "Phase name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  minDays: z.coerce.number().int().min(0).optional().nullable(),
});

const EvaluationCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const SkillCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const SkillSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Skill name is required").max(200),
  description: z.string().max(500).optional().nullable(),
  isCritical: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const DailyObservationReportSchema = z.object({
  traineeId: z.string().min(1, "Trainee is required"),
  ftoId: z.string().min(1, "FTO is required"),
  phaseId: z.string().optional().nullable(),
  date: z.coerce.date(),
  overallRating: z.coerce.number().int().min(1).max(7),
  narrative: z.string().max(5000).optional().nullable(),
  mostSatisfactory: z.string().max(200).optional().nullable(),
  leastSatisfactory: z.string().max(200).optional().nullable(),
  recommendAction: z.enum(["continue", "advance", "extend", "remediate", "nrt", "release", "terminate"]).default("continue"),
  nrtFlag: z.coerce.boolean().default(false),
  remFlag: z.coerce.boolean().default(false),
  traineeAcknowledged: z.coerce.boolean().default(false),
  supervisorReviewedBy: z.string().max(200).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Trainee Actions
// ---------------------------------------------------------------------------

export async function createTrainee(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  const raw = formDataToObject(formData);
  const parsed = TraineeSchema.safeParse({
    firstName: raw.firstName,
    lastName: raw.lastName,
    employeeId: raw.employeeId,
    email: raw.email,
    hireDate: raw.hireDate,
    divisionId: raw.divisionId || null,
    status: raw.status || "active",
    startDate: raw.startDate,
    notes: raw.notes || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { employeeId: parsed.data.employeeId },
    });
    if (existing) {
      return { success: false, error: `A user with employee ID "${parsed.data.employeeId}" already exists.` };
    }

    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) {
      return { success: false, error: `A user with email "${parsed.data.email}" already exists.` };
    }

    const defaultPassword = await hashPassword("changeme");
    const trainee = await prisma.user.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        employeeId: parsed.data.employeeId,
        email: parsed.data.email,
        passwordHash: defaultPassword,
        role: "trainee",
        status: "active",
        hireDate: parsed.data.hireDate,
        divisionId: parsed.data.divisionId ?? null,
        traineeStatus: parsed.data.status,
        startDate: parsed.data.startDate,
        notes: parsed.data.notes ?? null,
      },
    });

    // Auto-create TraineePhase records for all active phases
    const phases = await prisma.trainingPhase.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    if (phases.length > 0) {
      await prisma.traineePhase.createMany({
        data: phases.map((phase, i) => ({
          traineeId: trainee.id,
          phaseId: phase.id,
          status: i === 0 ? "in_progress" : "not_started",
          startDate: i === 0 ? parsed.data.startDate : null,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "User",
        entityId: trainee.id,
        details: `Created trainee "${parsed.data.firstName} ${parsed.data.lastName}" (${parsed.data.employeeId})`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createTrainee error:", err);
    return { success: false, error: "Failed to create trainee." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updateTrainee(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  const raw = formDataToObject(formData);
  const parsed = TraineeSchema.safeParse({
    firstName: raw.firstName,
    lastName: raw.lastName,
    employeeId: raw.employeeId,
    email: raw.email,
    hireDate: raw.hireDate,
    divisionId: raw.divisionId || null,
    status: raw.status || "active",
    startDate: raw.startDate,
    notes: raw.notes || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { employeeId: parsed.data.employeeId },
    });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another user already uses employee ID "${parsed.data.employeeId}".` };
    }

    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken && emailTaken.id !== id) {
      return { success: false, error: `Another user already uses email "${parsed.data.email}".` };
    }

    await prisma.user.update({
      where: { id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        employeeId: parsed.data.employeeId,
        email: parsed.data.email,
        hireDate: parsed.data.hireDate,
        divisionId: parsed.data.divisionId ?? null,
        traineeStatus: parsed.data.status,
        startDate: parsed.data.startDate,
        completionDate: parsed.data.status === "completed" ? new Date() : null,
        notes: parsed.data.notes ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: id,
        details: `Updated trainee "${parsed.data.firstName} ${parsed.data.lastName}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateTrainee error:", err);
    return { success: false, error: "Failed to update trainee." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deleteTrainee(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  try {
    const trainee = await prisma.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, role: true },
    });
    if (!trainee) return { success: false, error: "Trainee not found." };
    if (trainee.role !== "trainee") return { success: false, error: "User is not a trainee." };

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "User",
        entityId: id,
        details: `Deleted trainee "${trainee.firstName} ${trainee.lastName}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteTrainee error:", err);
    return { success: false, error: "Failed to delete trainee." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// FTO Actions
// ---------------------------------------------------------------------------

export async function createFto(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  const raw = formDataToObject(formData);
  const parsed = FtoSchema.safeParse({
    firstName: raw.firstName,
    lastName: raw.lastName,
    employeeId: raw.employeeId,
    email: raw.email,
    badgeNumber: raw.badgeNumber || null,
    divisionId: raw.divisionId || null,
    role: raw.role || "fto",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { employeeId: parsed.data.employeeId },
    });
    if (existing) {
      return { success: false, error: `A user with employee ID "${parsed.data.employeeId}" already exists.` };
    }

    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken) {
      return { success: false, error: `A user with email "${parsed.data.email}" already exists.` };
    }

    const defaultPassword = await hashPassword("changeme");
    const fto = await prisma.user.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        employeeId: parsed.data.employeeId,
        email: parsed.data.email,
        passwordHash: defaultPassword,
        role: parsed.data.role,
        status: "active",
        badgeNumber: parsed.data.badgeNumber ?? null,
        divisionId: parsed.data.divisionId ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "User",
        entityId: fto.id,
        details: `Created FTO "${parsed.data.firstName} ${parsed.data.lastName}" (${parsed.data.employeeId})`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createFto error:", err);
    return { success: false, error: "Failed to create FTO." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updateFto(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  const raw = formDataToObject(formData);
  const parsed = FtoSchema.safeParse({
    firstName: raw.firstName,
    lastName: raw.lastName,
    employeeId: raw.employeeId,
    email: raw.email,
    badgeNumber: raw.badgeNumber || null,
    divisionId: raw.divisionId || null,
    role: raw.role || "fto",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { employeeId: parsed.data.employeeId },
    });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another user already uses employee ID "${parsed.data.employeeId}".` };
    }

    const emailTaken = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (emailTaken && emailTaken.id !== id) {
      return { success: false, error: `Another user already uses email "${parsed.data.email}".` };
    }

    await prisma.user.update({
      where: { id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        employeeId: parsed.data.employeeId,
        email: parsed.data.email,
        role: parsed.data.role,
        badgeNumber: parsed.data.badgeNumber ?? null,
        divisionId: parsed.data.divisionId ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: id,
        details: `Updated FTO "${parsed.data.firstName} ${parsed.data.lastName}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateFto error:", err);
    return { success: false, error: "Failed to update FTO." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deleteFto(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  try {
    const fto = await prisma.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, role: true },
    });
    if (!fto) return { success: false, error: "FTO not found." };
    if (fto.role === "trainee") return { success: false, error: "User is a trainee, not an FTO." };

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "User",
        entityId: id,
        details: `Deleted FTO "${fto.firstName} ${fto.lastName}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteFto error:", err);
    return { success: false, error: "Failed to delete FTO." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function toggleFtoActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  try {
    // When deactivating, increment sessionVersion to invalidate active sessions
    const updateData: Record<string, unknown> = { isActive };
    if (!isActive) {
      updateData.sessionVersion = { increment: 1 };
    }
    const fto = await prisma.user.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: id,
        details: `${isActive ? "Activated" : "Deactivated"} FTO "${fto.firstName} ${fto.lastName}"${!isActive ? " (sessions invalidated)" : ""}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("toggleFtoActive error:", err);
    return { success: false, error: "Failed to toggle FTO status." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Training Assignment Actions
// ---------------------------------------------------------------------------

export async function createAssignment(
  traineeId: string,
  ftoId: string,
  startDate: string
): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  try {
    // Mark any current active assignment as reassigned
    await prisma.trainingAssignment.updateMany({
      where: { traineeId, status: "active" },
      data: { status: "reassigned", endDate: new Date() },
    });

    await prisma.trainingAssignment.create({
      data: { traineeId, ftoId, startDate: new Date(startDate), status: "active" },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "TrainingAssignment",
        entityId: traineeId,
        details: `Assigned trainee ${traineeId} to FTO ${ftoId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createAssignment error:", err);
    return { success: false, error: "Failed to create assignment." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Training Phase Actions
// ---------------------------------------------------------------------------

export async function createPhase(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = TrainingPhaseSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
    minDays: raw.minDays || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.trainingPhase.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: `A phase with the slug "${slug}" already exists.` };
    }

    const phase = await prisma.trainingPhase.create({
      data: { ...parsed.data, slug },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "TrainingPhase",
        entityId: phase.id,
        details: `Created training phase "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createPhase error:", err);
    return { success: false, error: "Failed to create phase." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updatePhase(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = TrainingPhaseSchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
    minDays: raw.minDays || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.trainingPhase.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another phase already uses the slug "${slug}".` };
    }

    await prisma.trainingPhase.update({ where: { id }, data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "TrainingPhase",
        entityId: id,
        details: `Updated training phase "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updatePhase error:", err);
    return { success: false, error: "Failed to update phase." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deletePhase(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  try {
    const phase = await prisma.trainingPhase.findUnique({ where: { id }, select: { name: true } });
    if (!phase) return { success: false, error: "Phase not found." };

    await prisma.trainingPhase.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "TrainingPhase",
        entityId: id,
        details: `Deleted training phase "${phase.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deletePhase error:", err);
    return { success: false, error: "Failed to delete phase." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Trainee Phase Actions
// ---------------------------------------------------------------------------

export async function updateTraineePhase(
  id: string,
  data: { status?: string; startDate?: string; endDate?: string; ftoSignoffId?: string; notes?: string }
): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  try {
    // Validate that ftoSignoffId (if provided) belongs to a user with signoff_phases permission
    if (data.ftoSignoffId) {
      const signoffUser = await prisma.user.findUnique({
        where: { id: data.ftoSignoffId },
        select: { firstName: true, lastName: true, role: true },
      });
      if (!signoffUser) {
        return { success: false, error: "Selected user not found." };
      }
      if (!hasPermission(signoffUser.role as Parameters<typeof hasPermission>[0], "signoff_phases")) {
        return {
          success: false,
          error: `${signoffUser.firstName} ${signoffUser.lastName} is a ${signoffUser.role} and cannot sign off phases. Only supervisors, managers, and admins can sign off phases.`,
        };
      }
    }

    await prisma.traineePhase.update({
      where: { id },
      data: {
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        ftoSignoffId: data.ftoSignoffId || undefined,
        notes: data.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "TraineePhase",
        entityId: id,
        details: `Updated trainee phase status to "${data.status}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateTraineePhase error:", err);
    return { success: false, error: "Failed to update trainee phase." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Evaluation Category Actions
// ---------------------------------------------------------------------------

export async function createEvaluationCategory(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = EvaluationCategorySchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.evaluationCategory.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: `A category with the slug "${slug}" already exists.` };
    }

    const cat = await prisma.evaluationCategory.create({ data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "EvaluationCategory",
        entityId: cat.id,
        details: `Created evaluation category "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createEvaluationCategory error:", err);
    return { success: false, error: "Failed to create evaluation category." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updateEvaluationCategory(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = EvaluationCategorySchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.evaluationCategory.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another category already uses the slug "${slug}".` };
    }

    await prisma.evaluationCategory.update({ where: { id }, data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "EvaluationCategory",
        entityId: id,
        details: `Updated evaluation category "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateEvaluationCategory error:", err);
    return { success: false, error: "Failed to update evaluation category." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deleteEvaluationCategory(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  try {
    const cat = await prisma.evaluationCategory.findUnique({ where: { id }, select: { name: true } });
    if (!cat) return { success: false, error: "Category not found." };

    await prisma.evaluationCategory.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "EvaluationCategory",
        entityId: id,
        details: `Deleted evaluation category "${cat.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteEvaluationCategory error:", err);
    return { success: false, error: "Failed to delete evaluation category." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Skill Category Actions
// ---------------------------------------------------------------------------

export async function createSkillCategory(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = SkillCategorySchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.skillCategory.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: `A skill category with the slug "${slug}" already exists.` };
    }

    const cat = await prisma.skillCategory.create({ data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "SkillCategory",
        entityId: cat.id,
        details: `Created skill category "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createSkillCategory error:", err);
    return { success: false, error: "Failed to create skill category." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updateSkillCategory(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = SkillCategorySchema.safeParse({
    name: raw.name,
    description: raw.description || null,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.skillCategory.findUnique({ where: { slug } });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another category already uses the slug "${slug}".` };
    }

    await prisma.skillCategory.update({ where: { id }, data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "SkillCategory",
        entityId: id,
        details: `Updated skill category "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateSkillCategory error:", err);
    return { success: false, error: "Failed to update skill category." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deleteSkillCategory(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  try {
    const cat = await prisma.skillCategory.findUnique({ where: { id }, select: { name: true } });
    if (!cat) return { success: false, error: "Skill category not found." };

    await prisma.skillCategory.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "SkillCategory",
        entityId: id,
        details: `Deleted skill category "${cat.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteSkillCategory error:", err);
    return { success: false, error: "Failed to delete skill category." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Skill Actions
// ---------------------------------------------------------------------------

export async function createSkill(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = SkillSchema.safeParse({
    categoryId: raw.categoryId,
    name: raw.name,
    description: raw.description || null,
    isCritical: raw.isCritical === "true" || raw.isCritical === "on",
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.skill.findUnique({
      where: { categoryId_slug: { categoryId: parsed.data.categoryId, slug } },
    });
    if (existing) {
      return { success: false, error: `A skill with the slug "${slug}" already exists in this category.` };
    }

    const skill = await prisma.skill.create({ data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "Skill",
        entityId: skill.id,
        details: `Created skill "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createSkill error:", err);
    return { success: false, error: "Failed to create skill." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updateSkill(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = SkillSchema.safeParse({
    categoryId: raw.categoryId,
    name: raw.name,
    description: raw.description || null,
    isCritical: raw.isCritical === "true" || raw.isCritical === "on",
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const slug = slugify(parsed.data.name);

  try {
    const existing = await prisma.skill.findUnique({
      where: { categoryId_slug: { categoryId: parsed.data.categoryId, slug } },
    });
    if (existing && existing.id !== id) {
      return { success: false, error: `Another skill already uses the slug "${slug}" in this category.` };
    }

    await prisma.skill.update({ where: { id }, data: { ...parsed.data, slug } });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "Skill",
        entityId: id,
        details: `Updated skill "${parsed.data.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateSkill error:", err);
    return { success: false, error: "Failed to update skill." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deleteSkill(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  try {
    const skill = await prisma.skill.findUnique({ where: { id }, select: { name: true } });
    if (!skill) return { success: false, error: "Skill not found." };

    await prisma.skill.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "Skill",
        entityId: id,
        details: `Deleted skill "${skill.name}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteSkill error:", err);
    return { success: false, error: "Failed to delete skill." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Daily Observation Report (DOR) Actions
// ---------------------------------------------------------------------------

export async function createDailyObservationReport(
  formData: FormData,
  ratings: { categoryId: string; rating: number; comments?: string }[],
  status: "draft" | "submitted" = "submitted"
): Promise<ActionResult> {
  const session = await requirePermission("create_edit_own_dors");
  const raw = formDataToObject(formData);
  const parsed = DailyObservationReportSchema.safeParse({
    traineeId: raw.traineeId,
    ftoId: raw.ftoId,
    phaseId: raw.phaseId || null,
    date: raw.date,
    overallRating: raw.overallRating,
    narrative: raw.narrative || null,
    mostSatisfactory: raw.mostSatisfactory || null,
    leastSatisfactory: raw.leastSatisfactory || null,
    recommendAction: raw.recommendAction || "continue",
    nrtFlag: raw.nrtFlag === "true" || raw.nrtFlag === "on",
    remFlag: raw.remFlag === "true" || raw.remFlag === "on",
    traineeAcknowledged: raw.traineeAcknowledged === "true" || raw.traineeAcknowledged === "on",
    supervisorReviewedBy: raw.supervisorReviewedBy || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const d = parsed.data;
    const dor = await prisma.dailyEvaluation.create({
      data: {
        traineeId: d.traineeId,
        ftoId: d.ftoId,
        phaseId: d.phaseId ?? null,
        date: d.date,
        overallRating: d.overallRating,
        narrative: d.narrative ?? null,
        mostSatisfactory: d.mostSatisfactory ?? null,
        leastSatisfactory: d.leastSatisfactory ?? null,
        recommendAction: d.recommendAction,
        nrtFlag: d.nrtFlag,
        remFlag: d.remFlag,
        traineeAcknowledged: d.traineeAcknowledged,
        supervisorReviewedBy: d.supervisorReviewedBy ?? null,
        status,
      },
    });

    if (ratings.length > 0) {
      await prisma.evaluationRating.createMany({
        data: ratings.map((r) => ({
          evaluationId: dor.id,
          categoryId: r.categoryId,
          rating: Math.min(7, Math.max(1, r.rating)),
          comments: r.comments || null,
        })),
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "DailyObservationReport",
        entityId: dor.id,
        details: `Created DOR for trainee ${parsed.data.traineeId} on ${parsed.data.date.toISOString().split("T")[0]}`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    // Fire-and-forget: email notification + coaching assignment (only for submitted DORs)
    if (status === "submitted") {
      notifyDorSubmission(dor.id).catch((err) => {
        console.error("[email] DOR notification failed (non-blocking):", err);
      });
      assignCoachingForDor(dor.id).catch((err) => {
        console.error("[coaching] Auto-assignment failed (non-blocking):", err);
      });
    }
  } catch (err) {
    console.error("createDailyObservationReport error:", err);
    return { success: false, error: "Failed to create Daily Observation Report." };
  }

  revalidateFieldTraining();
  return { success: true };
}

/** @deprecated Use createDailyObservationReport instead */
export const createDailyEvaluation = createDailyObservationReport;

export async function deleteDailyObservationReport(id: string): Promise<ActionResult> {
  const session = await requirePermission("create_edit_own_dors");
  try {
    const dor = await prisma.dailyEvaluation.findUnique({ where: { id }, select: { date: true } });
    if (!dor) return { success: false, error: "DOR not found." };

    await prisma.dailyEvaluation.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "DailyObservationReport",
        entityId: id,
        details: `Deleted DOR from ${dor.date.toISOString().split("T")[0]}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteDailyObservationReport error:", err);
    return { success: false, error: "Failed to delete Daily Observation Report." };
  }

  revalidateFieldTraining();
  return { success: true };
}

/** @deprecated Use deleteDailyObservationReport instead */
export const deleteDailyEvaluation = deleteDailyObservationReport;

// ---------------------------------------------------------------------------
// Skill Signoff Actions
// ---------------------------------------------------------------------------

export async function signoffSkill(
  traineeId: string,
  skillId: string,
  ftoId: string,
  date: string,
  notes?: string
): Promise<ActionResult> {
  const session = await requirePermission("create_edit_own_dors");
  try {
    const existing = await prisma.skillSignoff.findUnique({
      where: { traineeId_skillId: { traineeId, skillId } },
    });
    if (existing) {
      return { success: false, error: "This skill has already been signed off." };
    }

    await prisma.skillSignoff.create({
      data: { traineeId, skillId, ftoId, date: new Date(date), notes: notes || null },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "SkillSignoff",
        entityId: `${traineeId}/${skillId}`,
        details: `Signed off skill ${skillId} for trainee ${traineeId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("signoffSkill error:", err);
    return { success: false, error: "Failed to sign off skill." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Skill Step Actions
// ---------------------------------------------------------------------------

const SkillStepSchema = z.object({
  skillId: z.string().min(1, "Skill is required"),
  stepNumber: z.coerce.number().int().min(1, "Step number must be at least 1").max(20, "Maximum 20 steps"),
  description: z.string().min(1, "Description is required").max(500),
  isRequired: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function createSkillStep(formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = SkillStepSchema.safeParse({
    skillId: raw.skillId,
    stepNumber: raw.stepNumber,
    description: raw.description,
    isRequired: raw.isRequired === "true" || raw.isRequired === "on" || raw.isRequired === undefined,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const existing = await prisma.skillStep.findUnique({
      where: { skillId_stepNumber: { skillId: parsed.data.skillId, stepNumber: parsed.data.stepNumber } },
    });
    if (existing) {
      return { success: false, error: `Step #${parsed.data.stepNumber} already exists for this skill.` };
    }

    const stepCount = await prisma.skillStep.count({ where: { skillId: parsed.data.skillId } });
    if (stepCount >= 20) {
      return { success: false, error: "Maximum of 20 steps per skill." };
    }

    const step = await prisma.skillStep.create({ data: parsed.data });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "SkillStep",
        entityId: step.id,
        details: `Created step #${parsed.data.stepNumber} for skill ${parsed.data.skillId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createSkillStep error:", err);
    return { success: false, error: "Failed to create skill step." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function updateSkillStep(id: string, formData: FormData): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  const raw = formDataToObject(formData);
  const parsed = SkillStepSchema.safeParse({
    skillId: raw.skillId,
    stepNumber: raw.stepNumber,
    description: raw.description,
    isRequired: raw.isRequired === "true" || raw.isRequired === "on" || raw.isRequired === undefined,
    sortOrder: raw.sortOrder || 0,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const existing = await prisma.skillStep.findUnique({
      where: { skillId_stepNumber: { skillId: parsed.data.skillId, stepNumber: parsed.data.stepNumber } },
    });
    if (existing && existing.id !== id) {
      return { success: false, error: `Step #${parsed.data.stepNumber} already exists for this skill.` };
    }

    await prisma.skillStep.update({ where: { id }, data: parsed.data });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "SkillStep",
        entityId: id,
        details: `Updated step #${parsed.data.stepNumber} for skill ${parsed.data.skillId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("updateSkillStep error:", err);
    return { success: false, error: "Failed to update skill step." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function deleteSkillStep(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  try {
    const step = await prisma.skillStep.findUnique({ where: { id }, select: { stepNumber: true, skillId: true } });
    if (!step) return { success: false, error: "Step not found." };

    await prisma.skillStep.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "SkillStep",
        entityId: id,
        details: `Deleted step #${step.stepNumber} from skill ${step.skillId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteSkillStep error:", err);
    return { success: false, error: "Failed to delete skill step." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Password Reset Actions (replaces PIN management)
// ---------------------------------------------------------------------------

export async function resetUserPassword(id: string, newPassword: string): Promise<ActionResult> {
  const session = await requirePermission("manage_ftos_trainees");
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    // Increment sessionVersion to invalidate any active sessions
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
      select: { firstName: true, lastName: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "User",
        entityId: id,
        details: `Reset password for "${user.firstName} ${user.lastName}" (sessions invalidated)`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("resetUserPassword error:", err);
    return { success: false, error: "Failed to reset password." };
  }

  revalidateFieldTraining();
  return { success: true };
}

/** @deprecated Use resetUserPassword instead */
export async function setFtoPin(id: string, pin: string): Promise<ActionResult> {
  return resetUserPassword(id, pin);
}

/** @deprecated Use resetUserPassword instead */
export async function setTraineePin(id: string, pin: string): Promise<ActionResult> {
  return resetUserPassword(id, pin);
}

// ---------------------------------------------------------------------------
// DOR Draft / Submit Actions
// ---------------------------------------------------------------------------

export async function updateDorDraft(
  id: string,
  formData: FormData,
  ratings: { categoryId: string; rating: number; comments?: string }[]
): Promise<ActionResult> {
  const session = await requirePermission("create_edit_own_dors");
  const raw = formDataToObject(formData);
  const parsed = DailyObservationReportSchema.safeParse({
    traineeId: raw.traineeId,
    ftoId: raw.ftoId,
    phaseId: raw.phaseId || null,
    date: raw.date,
    overallRating: raw.overallRating,
    narrative: raw.narrative || null,
    mostSatisfactory: raw.mostSatisfactory || null,
    leastSatisfactory: raw.leastSatisfactory || null,
    recommendAction: raw.recommendAction || "continue",
    nrtFlag: raw.nrtFlag === "true" || raw.nrtFlag === "on",
    remFlag: raw.remFlag === "true" || raw.remFlag === "on",
    traineeAcknowledged: raw.traineeAcknowledged === "true" || raw.traineeAcknowledged === "on",
    supervisorReviewedBy: raw.supervisorReviewedBy || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    // Verify this is a draft
    const existing = await prisma.dailyEvaluation.findUnique({
      where: { id },
      select: { status: true, ftoId: true },
    });
    if (!existing) return { success: false, error: "DOR not found." };
    if (existing.status !== "draft") return { success: false, error: "Only draft DORs can be edited." };

    const d = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.dailyEvaluation.update({
        where: { id },
        data: {
          traineeId: d.traineeId,
          ftoId: d.ftoId,
          phaseId: d.phaseId ?? null,
          date: d.date,
          overallRating: d.overallRating,
          narrative: d.narrative ?? null,
          mostSatisfactory: d.mostSatisfactory ?? null,
          leastSatisfactory: d.leastSatisfactory ?? null,
          recommendAction: d.recommendAction,
          nrtFlag: d.nrtFlag,
          remFlag: d.remFlag,
          traineeAcknowledged: d.traineeAcknowledged,
          supervisorReviewedBy: d.supervisorReviewedBy ?? null,
        },
      });

      // Delete existing ratings and re-create
      await tx.evaluationRating.deleteMany({ where: { evaluationId: id } });
      if (ratings.length > 0) {
        await tx.evaluationRating.createMany({
          data: ratings.map((r) => ({
            evaluationId: id,
            categoryId: r.categoryId,
            rating: Math.min(7, Math.max(1, r.rating)),
            comments: r.comments || null,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "DailyObservationReport",
          entityId: id,
          details: `Updated draft DOR`,
          actorId: session.userId,
          actorType: "user",
        },
      });
    });
  } catch (err) {
    console.error("updateDorDraft error:", err);
    return { success: false, error: "Failed to update draft DOR." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function submitDor(id: string): Promise<ActionResult> {
  const session = await requirePermission("create_edit_own_dors");
  try {
    const existing = await prisma.dailyEvaluation.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!existing) return { success: false, error: "DOR not found." };
    if (existing.status !== "draft") return { success: false, error: "This DOR has already been submitted." };

    await prisma.dailyEvaluation.update({
      where: { id },
      data: { status: "submitted" },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DailyObservationReport",
        entityId: id,
        details: `Submitted DOR (changed status from draft to submitted)`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("submitDor error:", err);
    return { success: false, error: "Failed to submit DOR." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// DOR Acknowledgment Actions
// ---------------------------------------------------------------------------

export async function acknowledgeDor(dorId: string, traineeId: string): Promise<ActionResult> {
  try {
    const dor = await prisma.dailyEvaluation.findUnique({
      where: { id: dorId },
      select: { traineeId: true, traineeAcknowledged: true, status: true },
    });
    if (!dor) return { success: false, error: "DOR not found." };
    if (dor.traineeId !== traineeId) return { success: false, error: "You can only acknowledge your own DORs." };
    if (dor.status !== "submitted") return { success: false, error: "Only submitted DORs can be acknowledged." };
    if (dor.traineeAcknowledged) return { success: false, error: "This DOR has already been acknowledged." };

    await prisma.dailyEvaluation.update({
      where: { id: dorId },
      data: {
        traineeAcknowledged: true,
        acknowledgedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "DailyObservationReport",
        entityId: dorId,
        details: `Trainee ${traineeId} acknowledged DOR`,
        actorId: traineeId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("acknowledgeDor error:", err);
    return { success: false, error: "Failed to acknowledge DOR." };
  }

  revalidateFieldTraining();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Supervisor Notes Actions (timestamped, multi-author)
// ---------------------------------------------------------------------------

/** Add a new timestamped supervisor note to a DOR */
export async function addSupervisorNote(
  dorId: string,
  text: string
): Promise<ActionResult> {
  const session = await requirePermission("review_approve_dors");
  if (!text.trim()) {
    return { success: false, error: "Note text cannot be empty." };
  }
  try {
    await prisma.supervisorNote.create({
      data: {
        evaluationId: dorId,
        authorId: session.userId,
        text: text.trim(),
      },
    });

    // Also update legacy supervisorNotes field for backward compat
    await prisma.dailyEvaluation.update({
      where: { id: dorId },
      data: {
        supervisorNotes: text.trim(),
        supervisorReviewedBy: `${session.firstName} ${session.lastName}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "SupervisorNote",
        entityId: dorId,
        details: `Supervisor note added by ${session.firstName} ${session.lastName}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("addSupervisorNote error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to add supervisor note: ${msg.slice(0, 200)}` };
  }

  revalidateFieldTraining();
  return { success: true };
}

/** Delete a supervisor note (only author or admin/manager can delete) */
export async function deleteSupervisorNote(noteId: string): Promise<ActionResult> {
  const session = await requirePermission("review_approve_dors");
  try {
    const note = await prisma.supervisorNote.findUnique({
      where: { id: noteId },
    });
    if (!note) {
      return { success: false, error: "Note not found." };
    }

    // Only author or admin/manager can delete
    const isAuthor = note.authorId === session.userId;
    const isAdmin = ["admin", "manager"].includes(session.role);
    if (!isAuthor && !isAdmin) {
      return { success: false, error: "You can only delete your own notes." };
    }

    await prisma.supervisorNote.delete({
      where: { id: noteId },
    });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "SupervisorNote",
        entityId: noteId,
        details: `Supervisor note deleted by ${session.firstName} ${session.lastName} from DOR ${note.evaluationId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("deleteSupervisorNote error:", err);
    return { success: false, error: "Failed to delete supervisor note." };
  }

  revalidateFieldTraining();
  return { success: true };
}

/** @deprecated Use addSupervisorNote instead */
export async function updateSupervisorNotes(dorId: string, notes: string): Promise<ActionResult> {
  return addSupervisorNote(dorId, notes);
}

export async function removeSkillSignoff(traineeId: string, skillId: string): Promise<ActionResult> {
  const session = await requirePermission("manage_dors_skills");
  try {
    await prisma.skillSignoff.delete({
      where: { traineeId_skillId: { traineeId, skillId } },
    });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "SkillSignoff",
        entityId: `${traineeId}/${skillId}`,
        details: `Removed skill signoff for trainee ${traineeId}`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("removeSkillSignoff error:", err);
    return { success: false, error: "Failed to remove skill signoff." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function getTraineeDorHistory(traineeId: string) {
  try {
    const dors = await prisma.dailyEvaluation.findMany({
      where: { traineeId, status: "submitted" },
      orderBy: { date: "desc" },
      take: 20,
      include: {
        fto: { select: { firstName: true, lastName: true } },
        phase: { select: { name: true } },
      },
    });

    return {
      success: true as const,
      dors: dors.map((d) => ({
        id: d.id,
        date: d.date.toISOString(),
        ftoName: `${d.fto.lastName}, ${d.fto.firstName}`,
        phaseName: d.phase?.name || null,
        overallRating: d.overallRating,
        recommendAction: d.recommendAction,
      })),
    };
  } catch (err) {
    console.error("getTraineeDorHistory error:", err);
    return { success: false as const, error: "Failed to load DOR history." };
  }
}

// ---------------------------------------------------------------------------
// Assignment Request Actions
// ---------------------------------------------------------------------------

const AssignmentRequestSchema = z.object({
  traineeId: z.string().min(1, "Trainee is required"),
  reason: z.string().max(1000).optional().nullable(),
});

export async function createAssignmentRequest(formData: FormData): Promise<ActionResult> {
  const session = await requireAuth();

  // Only FTOs (and above) can request
  if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], "create_edit_own_dors")) {
    return { success: false, error: "Insufficient permissions." };
  }

  const raw = formDataToObject(formData);
  const parsed = AssignmentRequestSchema.safeParse({
    traineeId: raw.traineeId,
    reason: raw.reason || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    // Check for existing pending request for the same trainee by the same FTO
    const existing = await prisma.assignmentRequest.findFirst({
      where: {
        requesterId: session.userId,
        traineeId: parsed.data.traineeId,
        status: "pending",
      },
    });
    if (existing) {
      return { success: false, error: "You already have a pending request for this trainee." };
    }

    // Verify trainee exists and is a trainee
    const trainee = await prisma.user.findUnique({
      where: { id: parsed.data.traineeId },
      select: { firstName: true, lastName: true, role: true },
    });
    if (!trainee || trainee.role !== "trainee") {
      return { success: false, error: "Selected user is not a trainee." };
    }

    await prisma.assignmentRequest.create({
      data: {
        requesterId: session.userId,
        traineeId: parsed.data.traineeId,
        reason: parsed.data.reason ?? null,
        status: "pending",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "AssignmentRequest",
        entityId: parsed.data.traineeId,
        details: `Requested assignment of trainee "${trainee.firstName} ${trainee.lastName}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("createAssignmentRequest error:", err);
    return { success: false, error: "Failed to create assignment request." };
  }

  revalidateFieldTraining();
  return { success: true };
}

export async function reviewAssignmentRequest(
  requestId: string,
  decision: "approved" | "denied",
  reviewNotes?: string
): Promise<ActionResult> {
  const session = await requirePermission("manage_training_assignments");

  try {
    const request = await prisma.assignmentRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { firstName: true, lastName: true } },
        trainee: { select: { firstName: true, lastName: true } },
      },
    });
    if (!request) return { success: false, error: "Request not found." };
    if (request.status !== "pending") {
      return { success: false, error: "This request has already been reviewed." };
    }

    await prisma.assignmentRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
    });

    // If approved, create the actual training assignment
    if (decision === "approved") {
      // End any existing active assignment for this trainee
      await prisma.trainingAssignment.updateMany({
        where: { traineeId: request.traineeId, status: "active" },
        data: { status: "reassigned", endDate: new Date() },
      });

      await prisma.trainingAssignment.create({
        data: {
          traineeId: request.traineeId,
          ftoId: request.requesterId,
          startDate: new Date(),
          status: "active",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "AssignmentRequest",
        entityId: requestId,
        details: `${decision === "approved" ? "Approved" : "Denied"} assignment request — FTO "${request.requester.firstName} ${request.requester.lastName}" → Trainee "${request.trainee.firstName} ${request.trainee.lastName}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });
  } catch (err) {
    console.error("reviewAssignmentRequest error:", err);
    return { success: false, error: "Failed to review assignment request." };
  }

  revalidateFieldTraining();
  return { success: true };
}
