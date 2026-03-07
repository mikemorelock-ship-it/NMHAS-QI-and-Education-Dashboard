/**
 * Utilities for querying metric entries that correctly handle divisions
 * with and without regions (departments).
 *
 * Divisions like Communications Center and Community Paramedics have no
 * sub-departments, so their metric data is stored at the division level
 * (regionId = null). These helpers build Prisma where-clauses that include
 * division-level entries for region-less divisions alongside the standard
 * region-level entries for divisions that do have regions.
 */

import { prisma } from "@/lib/db";

/**
 * Returns the set of division IDs that have NO active regions.
 *
 * This determines which divisions store metric data at the division level
 * rather than the region level.
 */
export async function getDivisionsWithoutRegions(divisionIds: string[]): Promise<Set<string>> {
  if (divisionIds.length === 0) return new Set();

  const regionsInDivisions = await prisma.region.findMany({
    where: { divisionId: { in: divisionIds }, isActive: true },
    select: { divisionId: true },
  });

  const divisionsWithRegions = new Set(regionsInDivisions.map((r) => r.divisionId));
  return new Set(divisionIds.filter((id) => !divisionsWithRegions.has(id)));
}

/**
 * Builds a Prisma where-clause fragment for fetching metric entries across
 * a set of divisions, correctly handling divisions with and without regions.
 *
 * Some metrics only have data at the division level even when the division
 * has sub-departments (regions). To handle this, we always include both:
 *   - region-level entries (regionId != null)
 *   - division-level entries (divisionId set, regionId = null)
 *
 * Returns an OR clause that can be spread into a Prisma where object.
 */
export function buildEntryWhereForDivisions(
  _divisionsWithoutRegions: Set<string>,
  allDivisionIds?: string[]
): Record<string, unknown> {
  // Always include both region-level and division-level entries so that
  // metrics with data only at the division level are not silently excluded.
  const orClauses: Record<string, unknown>[] = [{ regionId: { not: null } }];

  if (allDivisionIds && allDivisionIds.length > 0) {
    orClauses.push({ divisionId: { in: allDivisionIds }, regionId: null });
  } else if (_divisionsWithoutRegions.size > 0) {
    // Fallback: at minimum include region-less divisions
    orClauses.push({
      divisionId: { in: Array.from(_divisionsWithoutRegions) },
      regionId: null,
    });
  }

  return { OR: orClauses };
}

/**
 * Builds a Prisma where-clause for fetching metric entries scoped to a
 * single division, correctly handling whether it has regions or not.
 */
export function buildEntryWhereForSingleDivision(
  divisionId: string,
  hasRegions: boolean
): Record<string, unknown> {
  if (hasRegions) {
    return { divisionId, regionId: { not: null } };
  }
  // Division has no regions — fetch division-level entries
  return { divisionId, regionId: null };
}
