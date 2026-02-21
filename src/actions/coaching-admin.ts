"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/require-auth";
import { isAiConfigured } from "@/lib/ai";
import { generateBatchCoachingActivities, type BatchItem } from "@/lib/coaching-generator";

type ActionResult = { success: boolean; error?: string };

// ---------------------------------------------------------------------------
// Read Actions
// ---------------------------------------------------------------------------

/** Fetch all coaching activities with admin details */
export async function getCoachingActivitiesAdmin() {
  await requirePermission("manage_coaching");

  const activities = await prisma.coachingActivity.findMany({
    include: {
      category: { select: { id: true, name: true, slug: true } },
      sourceDocument: { select: { id: true, title: true, fileName: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return activities.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    categoryId: a.category.id,
    categoryName: a.category.name,
    categorySlug: a.category.slug,
    type: a.type,
    content: a.content,
    difficulty: a.difficulty,
    estimatedMins: a.estimatedMins,
    isActive: a.isActive,
    generationStatus: a.generationStatus,
    generatedAt: a.generatedAt?.toISOString() ?? null,
    reviewedBy: a.reviewedBy ? `${a.reviewedBy.firstName} ${a.reviewedBy.lastName}` : null,
    reviewedAt: a.reviewedAt?.toISOString() ?? null,
    reviewNotes: a.reviewNotes,
    sourceDocument: a.sourceDocument
      ? { id: a.sourceDocument.id, title: a.sourceDocument.title }
      : null,
    assignmentCount: a._count.assignments,
    createdAt: a.createdAt.toISOString(),
  }));
}

/** Get all evaluation categories (for the generator form) */
export async function getEvaluationCategories() {
  await requirePermission("manage_coaching");

  const categories = await prisma.evaluationCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, description: true },
  });

  return categories;
}

/** Get all active resource documents (for the generator form) */
export async function getActiveResourceDocuments() {
  await requirePermission("manage_coaching");

  const docs = await prisma.resourceDocument.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, fileName: true, fileType: true, textLength: true },
  });

  return docs;
}

/** Check if AI is configured */
export async function checkAiConfigured(): Promise<boolean> {
  await requirePermission("manage_coaching");
  return isAiConfigured();
}

// ---------------------------------------------------------------------------
// Create / Update
// ---------------------------------------------------------------------------

/** Manually create a coaching activity */
export async function createCoachingActivity(data: {
  title: string;
  description: string;
  categoryId: string;
  type: string;
  content: string;
  difficulty: string;
  estimatedMins: number;
}): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    const activity = await prisma.coachingActivity.create({
      data: {
        title: data.title,
        description: data.description || null,
        categoryId: data.categoryId,
        type: data.type,
        content: data.content || null,
        difficulty: data.difficulty,
        estimatedMins: data.estimatedMins,
        isActive: true,
        generationStatus: "manual",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "CoachingActivity",
        entityId: activity.id,
        details: `Created coaching activity "${data.title}" (manual)`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("createCoachingActivity error:", err);
    return { success: false, error: "Failed to create activity." };
  }
}

/** Update an existing coaching activity */
export async function updateCoachingActivity(
  id: string,
  data: {
    title: string;
    description: string;
    categoryId: string;
    type: string;
    content: string;
    difficulty: string;
    estimatedMins: number;
  }
): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    await prisma.coachingActivity.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description || null,
        categoryId: data.categoryId,
        type: data.type,
        content: data.content || null,
        difficulty: data.difficulty,
        estimatedMins: data.estimatedMins,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "CoachingActivity",
        entityId: id,
        details: `Updated coaching activity "${data.title}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("updateCoachingActivity error:", err);
    return { success: false, error: "Failed to update activity." };
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/** Delete a coaching activity (only if no assignments exist) */
export async function deleteCoachingActivity(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    const activity = await prisma.coachingActivity.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });

    if (!activity) return { success: false, error: "Activity not found." };

    if (activity._count.assignments > 0) {
      return {
        success: false,
        error: `Cannot delete — ${activity._count.assignments} trainee assignments exist. Deactivate instead.`,
      };
    }

    await prisma.coachingActivity.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "CoachingActivity",
        entityId: id,
        details: `Deleted coaching activity "${activity.title}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("deleteCoachingActivity error:", err);
    return { success: false, error: "Failed to delete activity." };
  }
}

// ---------------------------------------------------------------------------
// Review Workflow
// ---------------------------------------------------------------------------

/** Approve a draft coaching activity */
export async function approveCoachingActivity(id: string, notes?: string): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    await prisma.coachingActivity.update({
      where: { id },
      data: {
        generationStatus: "approved",
        isActive: true,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "APPROVE",
        entity: "CoachingActivity",
        entityId: id,
        details: `Approved AI-generated coaching activity${notes ? `: ${notes}` : ""}`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("approveCoachingActivity error:", err);
    return { success: false, error: "Failed to approve activity." };
  }
}

/** Reject a draft coaching activity */
export async function rejectCoachingActivity(id: string, notes?: string): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    await prisma.coachingActivity.update({
      where: { id },
      data: {
        generationStatus: "rejected",
        isActive: false,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes: notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "REJECT",
        entity: "CoachingActivity",
        entityId: id,
        details: `Rejected AI-generated coaching activity${notes ? `: ${notes}` : ""}`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("rejectCoachingActivity error:", err);
    return { success: false, error: "Failed to reject activity." };
  }
}

/** Bulk approve multiple draft activities */
export async function bulkApproveActivities(ids: string[]): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    await prisma.coachingActivity.updateMany({
      where: { id: { in: ids }, generationStatus: "draft" },
      data: {
        generationStatus: "approved",
        isActive: true,
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "BULK_APPROVE",
        entity: "CoachingActivity",
        entityId: ids.join(","),
        details: `Bulk approved ${ids.length} AI-generated coaching activities`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("bulkApproveActivities error:", err);
    return { success: false, error: "Failed to bulk approve activities." };
  }
}

/** Toggle active status of a coaching activity */
export async function toggleCoachingActivityActive(id: string): Promise<ActionResult> {
  const session = await requirePermission("manage_coaching");

  try {
    const activity = await prisma.coachingActivity.findUnique({
      where: { id },
      select: { isActive: true, title: true },
    });

    if (!activity) return { success: false, error: "Activity not found." };

    const newStatus = !activity.isActive;
    await prisma.coachingActivity.update({
      where: { id },
      data: { isActive: newStatus },
    });

    await prisma.auditLog.create({
      data: {
        action: newStatus ? "ACTIVATE" : "DEACTIVATE",
        entity: "CoachingActivity",
        entityId: id,
        details: `${newStatus ? "Activated" : "Deactivated"} coaching activity "${activity.title}"`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/coaching");
    return { success: true };
  } catch (err) {
    console.error("toggleCoachingActivityActive error:", err);
    return { success: false, error: "Failed to toggle activity status." };
  }
}

// ---------------------------------------------------------------------------
// AI Generation
// ---------------------------------------------------------------------------

interface GenerateRequest {
  documentId: string;
  items: Array<{
    categoryId: string;
    activityType: "reading" | "quiz" | "scenario" | "reflection";
    difficulty: "basic" | "intermediate" | "advanced";
  }>;
  additionalInstructions?: string;
}

interface GenerateResult {
  success: boolean;
  generated: number;
  failed: number;
  errors: string[];
}

/** Generate coaching activities from a resource document using AI */
export async function generateCoachingActivitiesAction(
  request: GenerateRequest
): Promise<GenerateResult> {
  const session = await requirePermission("manage_coaching");

  if (!isAiConfigured()) {
    return {
      success: false,
      generated: 0,
      failed: 0,
      errors: ["Anthropic API key not configured."],
    };
  }

  // Load the resource document
  const doc = await prisma.resourceDocument.findUnique({
    where: { id: request.documentId },
    select: { id: true, title: true, textContent: true },
  });

  if (!doc || !doc.textContent) {
    return {
      success: false,
      generated: 0,
      failed: 0,
      errors: ["Resource document not found or has no text content."],
    };
  }

  // Load categories for the batch items
  const categoryIds = [...new Set(request.items.map((i) => i.categoryId))];
  const categories = await prisma.evaluationCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, description: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Build batch items
  const batchItems: BatchItem[] = request.items
    .map((item) => {
      const cat = categoryMap.get(item.categoryId);
      if (!cat) return null;
      return {
        categoryId: item.categoryId,
        categoryName: cat.name,
        categoryDescription: cat.description,
        activityType: item.activityType,
        difficulty: item.difficulty,
      };
    })
    .filter((x): x is BatchItem => x !== null);

  if (batchItems.length === 0) {
    return { success: false, generated: 0, failed: 0, errors: ["No valid category selections."] };
  }

  // Run batch generation
  const results = await generateBatchCoachingActivities(
    doc.textContent,
    doc.title,
    batchItems,
    request.additionalInstructions
  );

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of results) {
    if (r.result) {
      try {
        await prisma.coachingActivity.create({
          data: {
            title: r.result.activity.title,
            description: r.result.activity.description || null,
            categoryId: r.item.categoryId,
            type: r.item.activityType,
            content: r.result.activity.content,
            difficulty: r.item.difficulty,
            estimatedMins: r.result.activity.estimatedMins,
            isActive: false, // Draft — not active until approved
            sourceDocumentId: doc.id,
            generationStatus: "draft",
            generationPrompt: r.result.prompt,
            generatedAt: new Date(),
          },
        });
        generated++;
      } catch (err) {
        failed++;
        errors.push(
          `DB error for ${r.item.categoryName}: ${err instanceof Error ? err.message : "unknown"}`
        );
      }
    } else {
      failed++;
      errors.push(`${r.item.categoryName} (${r.item.activityType}): ${r.error}`);
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "AI_GENERATE",
      entity: "CoachingActivity",
      entityId: doc.id,
      details: `AI-generated ${generated} coaching activities from "${doc.title}" (${failed} failed)`,
      actorId: session.userId,
      actorType: "user",
    },
  });

  revalidatePath("/admin/field-training/coaching");
  return { success: generated > 0, generated, failed, errors };
}
