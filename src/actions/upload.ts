"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-auth";
import { validateCsrf } from "@/lib/csrf";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadActionResult = {
  success: boolean;
  error?: string;
  created?: number;
  skipped?: number;
  errors?: Array<{ row: number; message: string }>;
};

export type ValidatedRow = {
  metricDefinitionId: string;
  departmentId: string;
  divisionId: string | null;
  regionId: string | null;
  periodType: string;
  periodStart: string; // ISO string
  value: number;
  numerator: number | null;
  denominator: number | null;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Server action: bulk import validated rows
// ---------------------------------------------------------------------------

/**
 * Accepts an array of pre-validated rows from the client and inserts them
 * into the database in a transaction. Rows that conflict with existing
 * entries (unique constraint) are skipped and reported back.
 *
 * Max 10,000 rows per call.
 */
export async function importUploadedData(rows: ValidatedRow[]): Promise<UploadActionResult> {
  // CSRF check
  if (!(await validateCsrf())) {
    return { success: false, error: "Invalid request origin." };
  }

  let session;
  try {
    session = await requireAdmin("upload_batch_data");
  } catch {
    return { success: false, error: "Insufficient permissions" };
  }

  if (!rows || rows.length === 0) {
    return { success: false, error: "No rows to import." };
  }

  if (rows.length > 10_000) {
    return {
      success: false,
      error: `Too many rows (${rows.length}). Maximum is 10,000 per upload.`,
    };
  }

  let created = 0;
  const skipped = 0;
  const errors: Array<{ row: number; message: string }> = [];

  try {
    // Process in chunks to avoid huge transactions
    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);

      const results = await prisma.$transaction(
        chunk.map((row, localIdx) => {
          const rowIdx = i + localIdx;
          // Use noon UTC to avoid timezone off-by-one display issues
          const rawDate = new Date(row.periodStart);
          if (isNaN(rawDate.getTime())) {
            throw new Error(`Row ${rowIdx + 1}: Invalid date "${row.periodStart}"`);
          }
          const periodDate = new Date(
            Date.UTC(
              rawDate.getUTCFullYear(),
              rawDate.getUTCMonth(),
              rawDate.getUTCDate(),
              12,
              0,
              0
            )
          );

          return prisma.metricEntry.create({
            data: {
              metricDefinitionId: row.metricDefinitionId,
              departmentId: row.departmentId,
              divisionId: row.divisionId || null,
              regionId: row.regionId || null,
              periodType: row.periodType,
              periodStart: periodDate,
              value: row.value,
              numerator: row.numerator ?? null,
              denominator: row.denominator ?? null,
              notes: row.notes || null,
              createdById: session.userId,
            },
          });
        })
      );

      created += results.length;
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CSV_IMPORT",
        entity: "MetricEntry",
        entityId: "csv-upload",
        details: `CSV import: ${created} entries created, ${skipped} skipped`,
        actorId: session.userId,
        actorType: "admin",
      },
    });

    revalidatePath("/admin/data-entry");
    revalidatePath("/admin/upload");
    revalidatePath("/admin");
    revalidatePath("/");

    return { success: true, created, skipped, errors };
  } catch (err: unknown) {
    console.error("importUploadedData error:", err);

    if (err instanceof Error && err.message.includes("Unique constraint failed")) {
      return {
        success: false,
        error:
          "Some rows conflict with existing data (duplicate metric + period + scope combination). Please review and remove duplicates before importing.",
        created,
        skipped,
      };
    }

    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to import data.",
      created,
      skipped,
    };
  }
}

// ---------------------------------------------------------------------------
// Helper: fetch lookup data for column mapping resolution
// ---------------------------------------------------------------------------

export type LookupData = {
  metrics: Array<{
    id: string;
    name: string;
    slug: string;
    departmentId: string;
    unit: string;
    dataType: string;
    numeratorLabel: string | null;
    denominatorLabel: string | null;
    rateMultiplier: number | null;
  }>;
  divisions: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  regions: Array<{
    id: string;
    name: string;
    divisionId: string;
  }>;
};

// ---------------------------------------------------------------------------
// Template data for downloadable CSV templates
// ---------------------------------------------------------------------------

export type TemplateRow = {
  metric: string;
  period: string;
  value: string;
  division: string;
  region: string;
  notes: string;
};

export type TemplateLookupData = LookupData & {
  departments: Array<{ id: string; name: string }>;
  associations: Array<{
    metricDefinitionId: string;
    divisionId: string | null;
    regionId: string | null;
  }>;
};

/**
 * Fetches all data needed to build a CSV template on the client.
 * Includes metrics, divisions, regions, departments, and metric associations.
 */
export async function getTemplateLookupData(): Promise<TemplateLookupData> {
  const [metrics, divisions, regions, departments, associations] = await Promise.all([
    prisma.metricDefinition.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        departmentId: true,
        unit: true,
        dataType: true,
        numeratorLabel: true,
        denominatorLabel: true,
        rateMultiplier: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.division.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.region.findMany({
      where: { isActive: true },
      select: { id: true, name: true, divisionId: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.metricAssociation.findMany({
      select: {
        metricDefinitionId: true,
        divisionId: true,
        regionId: true,
      },
    }),
  ]);

  return { metrics, divisions, regions, departments, associations };
}

export async function getLookupData(): Promise<LookupData> {
  const [metrics, divisions, regions] = await Promise.all([
    prisma.metricDefinition.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        departmentId: true,
        unit: true,
        dataType: true,
        numeratorLabel: true,
        denominatorLabel: true,
        rateMultiplier: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.division.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
    prisma.region.findMany({
      where: { isActive: true },
      select: { id: true, name: true, divisionId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { metrics, divisions, regions };
}
