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
export async function getDivisionsWithoutRegions(
  divisionIds: string[]
): Promise<Set<string>> {
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
 * For divisions WITH regions: fetches region-level entries (regionId != null)
 * For divisions WITHOUT regions: fetches division-level entries (regionId = null)
 *
 * Returns an OR clause that can be spread into a Prisma where object.
 * If all divisions have regions, returns the original `regionId: { not: null }` filter.
 */
export function buildEntryWhereForDivisions(
  divisionsWithoutRegions: Set<string>
): Record<string, unknown> {
  if (divisionsWithoutRegions.size === 0) {
    // All divisions have regions — original behavior
    return { regionId: { not: null } };
  }

  const noRegionIds = Array.from(divisionsWithoutRegions);

  // Include both: region-level entries + division-level entries for region-less divisions
  return {
    OR: [
      { regionId: { not: null } },
      { divisionId: { in: noRegionIds }, regionId: null },
    ],
  };
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
