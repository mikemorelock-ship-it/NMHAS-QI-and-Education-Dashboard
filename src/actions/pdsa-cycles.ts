"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import type { ActionResult } from "./metrics";
import { requireAdmin } from "@/lib/require-auth";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const PdsaCycleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  cycleNumber: z.coerce.number().int().min(1).default(1),
  status: z.enum(["planning", "doing", "studying", "acting", "completed", "abandoned"]).default("planning"),
  outcome: z.enum(["adopt", "adapt", "abandon"]).optional().nullable(),
  driverDiagramId: z.string().optional().nullable(),
  metricDefinitionId: z.string().optional().nullable(),
  changeIdeaNodeId: z.string().optional().nullable(),

  planDescription: z.string().max(2000).optional().nullable(),
  planPrediction: z.string().max(2000).optional().nullable(),
  planDataCollection: z.string().max(2000).optional().nullable(),
  planStartDate: z.string().optional().nullable(),

  doObservations: z.string().max(2000).optional().nullable(),
  doStartDate: z.string().optional().nullable(),
  doEndDate: z.string().optional().nullable(),

  studyResults: z.string().max(2000).optional().nullable(),
  studyLearnings: z.string().max(2000).optional().nullable(),
  studyDate: z.string().optional().nullable(),

  actDecision: z.string().max(2000).optional().nullable(),
  actNextSteps: z.string().max(2000).optional().nullable(),
  actDate: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateAll() {
  revalidatePath("/admin/pdsa-cycles");
  revalidatePath("/admin/driver-diagrams");
  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/qi-workflow");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/quality-improvement");
}

function formDataToRecord(formData: FormData): Record<string, string> {
  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    const str = value.toString();
    // Strip "__none__" sentinel used by Select components for empty values
    raw[key] = str === "__none__" ? "" : str;
  });
  return raw;
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T12:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createPdsaCycle(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = PdsaCycleSchema.safeParse({
    title: raw.title,
    cycleNumber: raw.cycleNumber ?? 1,
    status: raw.status || "planning",
    outcome: raw.outcome || null,
    driverDiagramId: raw.driverDiagramId || null,
    metricDefinitionId: raw.metricDefinitionId || null,
    changeIdeaNodeId: raw.changeIdeaNodeId || null,
    planDescription: raw.planDescription || null,
    planPrediction: raw.planPrediction || null,
    planDataCollection: raw.planDataCollection || null,
    planStartDate: raw.planStartDate || null,
    doObservations: raw.doObservations || null,
    doStartDate: raw.doStartDate || null,
    doEndDate: raw.doEndDate || null,
    studyResults: raw.studyResults || null,
    studyLearnings: raw.studyLearnings || null,
    studyDate: raw.studyDate || null,
    actDecision: raw.actDecision || null,
    actNextSteps: raw.actNextSteps || null,
    actDate: raw.actDate || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  try {
    // Auto-increment cycle number within diagram + changeIdea context
    if (data.driverDiagramId && data.changeIdeaNodeId) {
      const maxCycle = await prisma.pdsaCycle.aggregate({
        where: {
          driverDiagramId: data.driverDiagramId,
          changeIdeaNodeId: data.changeIdeaNodeId,
        },
        _max: { cycleNumber: true },
      });
      data.cycleNumber = (maxCycle._max.cycleNumber ?? 0) + 1;
    }

    const cycle = await prisma.pdsaCycle.create({
      data: {
        title: data.title,
        cycleNumber: data.cycleNumber,
        status: data.status,
        outcome: data.outcome ?? null,
        driverDiagramId: data.driverDiagramId || null,
        metricDefinitionId: data.metricDefinitionId || null,
        changeIdeaNodeId: data.changeIdeaNodeId || null,
        planDescription: data.planDescription ?? null,
        planPrediction: data.planPrediction ?? null,
        planDataCollection: data.planDataCollection ?? null,
        planStartDate: parseDate(data.planStartDate),
        doObservations: data.doObservations ?? null,
        doStartDate: parseDate(data.doStartDate),
        doEndDate: parseDate(data.doEndDate),
        studyResults: data.studyResults ?? null,
        studyLearnings: data.studyLearnings ?? null,
        studyDate: parseDate(data.studyDate),
        actDecision: data.actDecision ?? null,
        actNextSteps: data.actNextSteps ?? null,
        actDate: parseDate(data.actDate),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "PdsaCycle",
        entityId: cycle.id,
        details: `Created PDSA cycle "${data.title}" (#${data.cycleNumber})`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("createPdsaCycle error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to create PDSA cycle: ${msg.slice(0, 200)}` };
  }

  revalidateAll();
  return { success: true };
}

export async function updatePdsaCycle(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw = formDataToRecord(formData);
  const parsed = PdsaCycleSchema.safeParse({
    title: raw.title,
    cycleNumber: raw.cycleNumber ?? 1,
    status: raw.status || "planning",
    outcome: raw.outcome || null,
    driverDiagramId: raw.driverDiagramId || null,
    metricDefinitionId: raw.metricDefinitionId || null,
    changeIdeaNodeId: raw.changeIdeaNodeId || null,
    planDescription: raw.planDescription || null,
    planPrediction: raw.planPrediction || null,
    planDataCollection: raw.planDataCollection || null,
    planStartDate: raw.planStartDate || null,
    doObservations: raw.doObservations || null,
    doStartDate: raw.doStartDate || null,
    doEndDate: raw.doEndDate || null,
    studyResults: raw.studyResults || null,
    studyLearnings: raw.studyLearnings || null,
    studyDate: raw.studyDate || null,
    actDecision: raw.actDecision || null,
    actNextSteps: raw.actNextSteps || null,
    actDate: raw.actDate || null,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const data = parsed.data;

  try {
    await prisma.pdsaCycle.update({
      where: { id },
      data: {
        title: data.title,
        cycleNumber: data.cycleNumber,
        status: data.status,
        outcome: data.outcome ?? null,
        driverDiagramId: data.driverDiagramId || null,
        metricDefinitionId: data.metricDefinitionId || null,
        changeIdeaNodeId: data.changeIdeaNodeId || null,
        planDescription: data.planDescription ?? null,
        planPrediction: data.planPrediction ?? null,
        planDataCollection: data.planDataCollection ?? null,
        planStartDate: parseDate(data.planStartDate),
        doObservations: data.doObservations ?? null,
        doStartDate: parseDate(data.doStartDate),
        doEndDate: parseDate(data.doEndDate),
        studyResults: data.studyResults ?? null,
        studyLearnings: data.studyLearnings ?? null,
        studyDate: parseDate(data.studyDate),
        actDecision: data.actDecision ?? null,
        actNextSteps: data.actNextSteps ?? null,
        actDate: parseDate(data.actDate),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "PdsaCycle",
        entityId: id,
        details: `Updated PDSA cycle "${data.title}"`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("updatePdsaCycle error:", err);
    return { success: false, error: "Failed to update PDSA cycle." };
  }

  revalidateAll();
  return { success: true };
}

export async function deletePdsaCycle(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const cycle = await prisma.pdsaCycle.findUnique({ where: { id } });
    if (!cycle) return { success: false, error: "Cycle not found." };

    await prisma.pdsaCycle.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "PdsaCycle",
        entityId: id,
        details: `Deleted PDSA cycle "${cycle.title}" (#${cycle.cycleNumber})`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deletePdsaCycle error:", err);
    return { success: false, error: "Failed to delete PDSA cycle." };
  }

  revalidateAll();
  return { success: true };
}

const STATUS_ORDER = ["planning", "doing", "studying", "acting", "completed"] as const;

export async function advancePdsaCycle(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const cycle = await prisma.pdsaCycle.findUnique({ where: { id } });
    if (!cycle) return { success: false, error: "Cycle not found." };

    const currentIdx = STATUS_ORDER.indexOf(cycle.status as typeof STATUS_ORDER[number]);
    if (currentIdx === -1 || currentIdx >= STATUS_ORDER.length - 1) {
      return { success: false, error: "Cannot advance this cycle further." };
    }

    const newStatus = STATUS_ORDER[currentIdx + 1];
    const now = new Date();

    // Set the appropriate date when advancing
    const dateUpdate: Record<string, Date> = {};
    if (newStatus === "doing") dateUpdate.doStartDate = now;
    if (newStatus === "studying") {
      dateUpdate.studyDate = now;
      if (!cycle.doEndDate) dateUpdate.doEndDate = now;
    }
    if (newStatus === "acting") dateUpdate.actDate = now;

    await prisma.pdsaCycle.update({
      where: { id },
      data: { status: newStatus, ...dateUpdate },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "PdsaCycle",
        entityId: id,
        details: `Advanced PDSA cycle "${cycle.title}" to ${newStatus}`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("advancePdsaCycle error:", err);
    return { success: false, error: "Failed to advance cycle." };
  }

  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Clone PDSA Cycle (Start Next Iteration)
// ---------------------------------------------------------------------------

export async function clonePdsaCycle(
  sourceId: string
): Promise<ActionResult<{ id: string }>> {
  let session;
  try {
    session = await requireAdmin("manage_driver_diagrams");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const source = await prisma.pdsaCycle.findUnique({
      where: { id: sourceId },
    });
    if (!source) return { success: false, error: "Source cycle not found." };

    // Find the max cycle number for this change idea + diagram combination
    const maxCycle = await prisma.pdsaCycle.findFirst({
      where: {
        driverDiagramId: source.driverDiagramId,
        changeIdeaNodeId: source.changeIdeaNodeId,
      },
      orderBy: { cycleNumber: "desc" },
      select: { cycleNumber: true },
    });

    const nextNumber = (maxCycle?.cycleNumber ?? 0) + 1;

    const newCycle = await prisma.pdsaCycle.create({
      data: {
        title: source.title,
        cycleNumber: nextNumber,
        status: "planning",
        driverDiagramId: source.driverDiagramId,
        metricDefinitionId: source.metricDefinitionId,
        changeIdeaNodeId: source.changeIdeaNodeId,
        planDescription: source.studyLearnings
          ? `Learnings from Cycle ${source.cycleNumber}: ${source.studyLearnings}`
          : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "PdsaCycle",
        entityId: newCycle.id,
        details: `Created PDSA cycle iteration #${nextNumber} for "${source.title}" (cloned from cycle #${source.cycleNumber})`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidateAll();
    return { success: true, data: { id: newCycle.id } };
  } catch (err) {
    console.error("clonePdsaCycle error:", err);
    return { success: false, error: "Failed to create next cycle iteration." };
  }
}
