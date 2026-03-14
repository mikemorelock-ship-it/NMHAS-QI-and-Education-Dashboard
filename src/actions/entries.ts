"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { requireAdmin } from "@/lib/require-auth";
import { createAuditLog, computeChanges } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const EntrySchema = z.object({
  metricDefinitionId: z.string().min(1, "Metric is required"),
  departmentId: z.string().min(1, "Department is required"),
  divisionId: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  periodType: z
    .enum(["daily", "weekly", "bi-weekly", "monthly", "quarterly", "annual"])
    .default("monthly"),
  periodStart: z.string().min(1, "Period start is required"),
  value: z.coerce.number(),
  numerator: z.coerce.number().optional().nullable(),
  denominator: z.coerce.number().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const BulkEntrySchema = z.object({
  metricDefinitionId: z.string().min(1),
  departmentId: z.string().min(1),
  divisionId: z.string().optional().nullable(),
  regionId: z.string().optional().nullable(),
  periodType: z
    .enum(["daily", "weekly", "bi-weekly", "monthly", "quarterly", "annual"])
    .default("monthly"),
  periodStart: z.string().min(1),
  value: z.number(),
  numerator: z.number().optional().nullable(),
  denominator: z.number().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type ActionResult = {
  success: boolean;
  error?: string;
  count?: number;
};

function cleanOptionalId(value: string | null | undefined): string | null {
  if (!value || value === "" || value === "none") return null;
  return value;
}

/**
 * Parse a period start string into a Date, using noon UTC to avoid
 * timezone-related off-by-one issues (midnight UTC renders as the
 * previous day in US timezones).
 */
function parsePeriodDate(periodStart: string): Date | null {
  let d: Date;
  if (periodStart.length === 7) {
    // "2026-01" format from <input type="month"> → 2026-01-01T12:00:00Z
    d = new Date(`${periodStart}-01T12:00:00.000Z`);
  } else if (periodStart.length === 10) {
    // "2026-01-15" format from <input type="date"> → 2026-01-15T12:00:00Z
    d = new Date(`${periodStart}T12:00:00.000Z`);
  } else {
    // Full ISO string or other format — normalise to noon UTC on that day
    const parsed = new Date(periodStart);
    if (isNaN(parsed.getTime())) return null;
    d = new Date(
      Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0)
    );
  }
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createEntry(formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });

  const parsed = EntrySchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    departmentId: raw.departmentId,
    divisionId: cleanOptionalId(raw.divisionId),
    regionId: cleanOptionalId(raw.regionId),
    periodType: raw.periodType || "monthly",
    periodStart: raw.periodStart,
    value: raw.value,
    numerator: raw.numerator ? parseFloat(raw.numerator) : null,
    denominator: raw.denominator ? parseFloat(raw.denominator) : null,
    notes: raw.notes || null,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;

  try {
    // Validate that the metric exists and auto-resolve departmentId
    const metricDef = await prisma.metricDefinition.findUnique({
      where: { id: data.metricDefinitionId },
      select: { departmentId: true, name: true, dataType: true, rateMultiplier: true },
    });
    if (!metricDef) {
      return { success: false, error: "Selected metric does not exist." };
    }
    // Auto-resolve departmentId from the metric definition (hidden FK)
    data.departmentId = metricDef.departmentId;

    // Auto-compute value from numerator/denominator for proportion/rate metrics
    const num = data.numerator;
    const den = data.denominator;
    if (num != null && den != null && den > 0) {
      if (metricDef.dataType === "proportion") {
        data.value = (num / den) * 100; // percentage
      } else if (metricDef.dataType === "rate") {
        data.value = num / den; // raw rate
      }
    } else if (
      metricDef.dataType === "rate" &&
      metricDef.rateMultiplier &&
      metricDef.rateMultiplier > 0
    ) {
      // Value was provided without N/D — assume it's in display units
      // (e.g., "5.5 per 100K miles"). Convert to raw rate.
      data.value = data.value / metricDef.rateMultiplier;
    }

    // Parse period start using noon UTC to avoid timezone off-by-one
    const periodDate = parsePeriodDate(data.periodStart);
    if (!periodDate) {
      return { success: false, error: "Invalid period start date." };
    }

    const entry = await prisma.metricEntry.create({
      data: {
        metricDefinitionId: data.metricDefinitionId,
        departmentId: data.departmentId,
        divisionId: data.divisionId || null,
        regionId: data.regionId || null,
        periodType: data.periodType,
        periodStart: periodDate,
        value: data.value,
        numerator: num ?? null,
        denominator: den ?? null,
        notes: data.notes ?? null,
        createdById: session.userId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "MetricEntry",
        entityId: entry.id,
        details: `Created entry: value=${data.value} for metric "${metricDef.name}", period ${data.periodStart}`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err: unknown) {
    console.error("createEntry error:", err);
    // Check for unique constraint violation
    if (err instanceof Error && err.message.includes("Unique constraint failed")) {
      return {
        success: false,
        error:
          "An entry already exists for this metric, department, division, region, and period combination.",
      };
    }
    return { success: false, error: "Failed to create entry." };
  }

  revalidatePath("/admin/data-entry");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function updateEntry(id: string, formData: FormData): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  const raw: Record<string, string> = {};
  formData.forEach((value, key) => {
    raw[key] = value.toString();
  });

  const parsed = EntrySchema.safeParse({
    metricDefinitionId: raw.metricDefinitionId,
    departmentId: raw.departmentId,
    divisionId: cleanOptionalId(raw.divisionId),
    regionId: cleanOptionalId(raw.regionId),
    periodType: raw.periodType || "monthly",
    periodStart: raw.periodStart,
    value: raw.value,
    numerator: raw.numerator ? parseFloat(raw.numerator) : null,
    denominator: raw.denominator ? parseFloat(raw.denominator) : null,
    notes: raw.notes || null,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const data = parsed.data;

  try {
    // Fetch existing entry for change tracking
    const existing = await prisma.metricEntry.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Entry not found." };
    }

    // Look up metric to check dataType for auto-compute
    const metricDef = await prisma.metricDefinition.findUnique({
      where: { id: data.metricDefinitionId },
      select: { dataType: true, rateMultiplier: true },
    });

    const num = data.numerator;
    const den = data.denominator;
    if (num != null && den != null && den > 0 && metricDef) {
      if (metricDef.dataType === "proportion") {
        data.value = (num / den) * 100;
      } else if (metricDef.dataType === "rate") {
        data.value = num / den;
      }
    } else if (
      metricDef &&
      metricDef.dataType === "rate" &&
      metricDef.rateMultiplier &&
      metricDef.rateMultiplier > 0
    ) {
      // Value without N/D — assume display units, convert to raw
      data.value = data.value / metricDef.rateMultiplier;
    }

    // Parse period start using noon UTC to avoid timezone off-by-one
    const periodDate = parsePeriodDate(data.periodStart);
    if (!periodDate) {
      return { success: false, error: "Invalid period start date." };
    }

    await prisma.metricEntry.update({
      where: { id },
      data: {
        metricDefinitionId: data.metricDefinitionId,
        departmentId: data.departmentId,
        divisionId: data.divisionId || null,
        regionId: data.regionId || null,
        periodType: data.periodType,
        periodStart: periodDate,
        value: data.value,
        numerator: num ?? null,
        denominator: den ?? null,
        notes: data.notes ?? null,
      },
    });

    const changes = computeChanges(
      {
        value: existing.value,
        numerator: existing.numerator,
        denominator: existing.denominator,
        notes: existing.notes,
      },
      {
        value: data.value,
        numerator: num ?? null,
        denominator: den ?? null,
        notes: data.notes ?? null,
      }
    );

    await createAuditLog({
      action: "UPDATE",
      entity: "MetricEntry",
      entityId: id,
      details: `Updated entry: value=${data.value}`,
      changes: changes ?? undefined,
      actorId: session.userId,
      actorType: "user",
    });
  } catch (err) {
    console.error("updateEntry error:", err);
    return { success: false, error: "Failed to update entry." };
  }

  revalidatePath("/admin/data-entry");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    const entry = await prisma.metricEntry.findUnique({
      where: { id },
      select: { value: true, metricDefinitionId: true },
    });

    if (!entry) {
      return { success: false, error: "Entry not found." };
    }

    await prisma.metricEntry.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "MetricEntry",
        entityId: id,
        details: `Deleted entry with value=${entry.value} for metric ${entry.metricDefinitionId}`,
        actorId: session.userId,
        actorType: "admin",
      },
    });
  } catch (err) {
    console.error("deleteEntry error:", err);
    return { success: false, error: "Failed to delete entry." };
  }

  revalidatePath("/admin/data-entry");
  revalidatePath("/admin");
  revalidatePath("/");

  return { success: true };
}

export async function bulkCreateEntries(
  entries: Array<{
    metricDefinitionId: string;
    departmentId: string;
    divisionId?: string | null;
    regionId?: string | null;
    periodType: string;
    periodStart: string;
    value: number;
    numerator?: number | null;
    denominator?: number | null;
    notes?: string | null;
    /** If set, update the existing row instead of creating */
    existingEntryId?: string;
  }>
): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  // Validate each entry
  const validatedEntries = [];
  for (let i = 0; i < entries.length; i++) {
    const parsed = BulkEntrySchema.safeParse(entries[i]);
    if (!parsed.success) {
      return {
        success: false,
        error: `Row ${i + 1}: ${parsed.error.issues.map((e) => e.message).join(", ")}`,
      };
    }
    validatedEntries.push({ ...parsed.data, existingEntryId: entries[i].existingEntryId });
  }

  if (validatedEntries.length === 0) {
    return { success: false, error: "No entries to create." };
  }

  try {
    // Look up metric dataTypes so we can auto-compute value from numerator/denominator
    const metricIds = [...new Set(validatedEntries.map((e) => e.metricDefinitionId))];
    const metricDefs = await prisma.metricDefinition.findMany({
      where: { id: { in: metricIds } },
      select: { id: true, dataType: true, rateMultiplier: true },
    });
    const metricDataTypes = new Map(metricDefs.map((m) => [m.id, m.dataType]));
    const metricRateMultipliers = new Map(metricDefs.map((m) => [m.id, m.rateMultiplier]));

    // Split entries into updates (prefilled rows) and creates (new rows)
    const operations = validatedEntries.map((entry) => {
      const periodDate = parsePeriodDate(entry.periodStart) ?? new Date(entry.periodStart);

      // Auto-compute value from numerator/denominator for proportion/rate metrics
      let computedValue = entry.value;
      const num = entry.numerator ?? null;
      const den = entry.denominator ?? null;
      if (num != null && den != null && den > 0) {
        const dataType = metricDataTypes.get(entry.metricDefinitionId);
        if (dataType === "proportion") {
          computedValue = (num / den) * 100;
        } else if (dataType === "rate") {
          computedValue = num / den;
        }
      } else {
        // No N/D data — for rate metrics, assume value is in display units
        // (e.g., "5.5 per 100K") and convert to raw rate
        const dataType = metricDataTypes.get(entry.metricDefinitionId);
        const multiplier = metricRateMultipliers.get(entry.metricDefinitionId);
        if (dataType === "rate" && multiplier && multiplier > 0) {
          computedValue = computedValue / multiplier;
        }
      }

      const data = {
        value: computedValue,
        numerator: num,
        denominator: den,
        notes: entry.notes ?? null,
      };

      if (entry.existingEntryId) {
        // Update existing entry
        return prisma.metricEntry.update({
          where: { id: entry.existingEntryId },
          data,
        });
      } else {
        // Create new entry
        return prisma.metricEntry.create({
          data: {
            metricDefinitionId: entry.metricDefinitionId,
            departmentId: entry.departmentId,
            divisionId: entry.divisionId || null,
            regionId: entry.regionId || null,
            periodType: entry.periodType,
            periodStart: periodDate,
            createdById: session.userId,
            ...data,
          },
        });
      }
    });

    const results = await prisma.$transaction(operations);

    const updatedCount = validatedEntries.filter((e) => e.existingEntryId).length;
    const createdCount = results.length - updatedCount;
    const parts = [];
    if (createdCount > 0) parts.push(`created ${createdCount}`);
    if (updatedCount > 0) parts.push(`updated ${updatedCount}`);

    await prisma.auditLog.create({
      data: {
        action: updatedCount > 0 ? "BULK_UPSERT" : "BULK_CREATE",
        entity: "MetricEntry",
        entityId: "bulk",
        details: `Bulk ${parts.join(", ")} metric entries`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidatePath("/admin/data-entry");
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, count: results.length };
  } catch (err: unknown) {
    console.error("bulkCreateEntries error:", err);
    if (err instanceof Error && err.message.includes("Unique constraint failed")) {
      return {
        success: false,
        error:
          "Duplicate entry detected. One or more entries already exist for the given metric/period combination.",
      };
    }
    return { success: false, error: "Failed to save entries." };
  }
}

export async function bulkDeleteEntries(ids: string[]): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  if (!ids || ids.length === 0) {
    return { success: false, error: "No entries selected for deletion." };
  }

  try {
    const result = await prisma.metricEntry.deleteMany({
      where: { id: { in: ids } },
    });

    await prisma.auditLog.create({
      data: {
        action: "BULK_DELETE",
        entity: "MetricEntry",
        entityId: "bulk",
        details: `Bulk deleted ${result.count} metric entries`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidatePath("/admin/data-entry");
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, count: result.count };
  } catch (err) {
    console.error("bulkDeleteEntries error:", err);
    return { success: false, error: "Failed to delete entries." };
  }
}

// ---------------------------------------------------------------------------
// Repair entries with stale value field (value=0 but numerator/denominator set)
// ---------------------------------------------------------------------------

export async function repairEntryValues(): Promise<ActionResult> {
  let session;
  try {
    session = await requireAdmin("enter_metric_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  try {
    // Find proportion/rate metrics
    const metrics = await prisma.metricDefinition.findMany({
      where: { dataType: { in: ["proportion", "rate"] } },
      select: { id: true, dataType: true },
    });
    const metricDataTypes = new Map(metrics.map((m) => [m.id, m.dataType]));
    const metricIds = metrics.map((m) => m.id);

    // Find entries with numerator/denominator where value might be wrong
    const entries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId: { in: metricIds },
        numerator: { not: null },
        denominator: { not: null },
      },
      select: {
        id: true,
        metricDefinitionId: true,
        value: true,
        numerator: true,
        denominator: true,
      },
    });

    let repaired = 0;
    const operations = [];

    for (const entry of entries) {
      const num = entry.numerator!;
      const den = entry.denominator!;
      if (den <= 0) continue;

      const dataType = metricDataTypes.get(entry.metricDefinitionId);
      const correctValue = dataType === "proportion" ? (num / den) * 100 : num / den;

      // Only update if the stored value is wrong (compare with tolerance)
      if (Math.abs(entry.value - correctValue) > 0.001) {
        operations.push(
          prisma.metricEntry.update({
            where: { id: entry.id },
            data: { value: correctValue },
          })
        );
        repaired++;
      }
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    await prisma.auditLog.create({
      data: {
        action: "REPAIR_VALUES",
        entity: "MetricEntry",
        entityId: "bulk",
        details: `Repaired ${repaired} entries with incorrect computed values`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidatePath("/admin/data-entry");
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, count: repaired };
  } catch (err) {
    console.error("repairEntryValues error:", err);
    return { success: false, error: "Failed to repair entries." };
  }
}

// ---------------------------------------------------------------------------
// Fetch existing entries for a specific metric + period (for data entry prefill)
// ---------------------------------------------------------------------------

export interface PrefillEntry {
  id: string;
  divisionId: string | null;
  regionId: string | null;
  value: number;
  numerator: number | null;
  denominator: number | null;
  notes: string | null;
}

export async function fetchEntriesForPeriod(
  metricDefinitionId: string,
  periodType: string,
  periodStart: string
): Promise<PrefillEntry[]> {
  const periodDate = parsePeriodDate(periodStart);
  if (!periodDate) return [];

  try {
    const entries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId,
        periodType,
        periodStart: periodDate,
      },
      select: {
        id: true,
        divisionId: true,
        regionId: true,
        value: true,
        numerator: true,
        denominator: true,
        notes: true,
      },
    });

    return entries.map((e) => ({
      id: e.id,
      divisionId: e.divisionId ?? null,
      regionId: e.regionId ?? null,
      value: e.value,
      numerator: e.numerator,
      denominator: e.denominator,
      notes: e.notes,
    }));
  } catch (err) {
    console.error("fetchEntriesForPeriod error:", err);
    return [];
  }
}
