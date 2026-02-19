import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/filters
 *
 * Returns cascading filter options:
 * - divisions (top-level organizational units)
 * - regions (granular "departments" in UI, cascading from divisionId)
 *
 * Note: the old "Department" (Organization) concept is no longer
 * exposed in filters. All filtering is by Division → Region.
 */
export async function GET() {
  try {
    const [divisions, regions] = await Promise.all([
      prisma.division.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true },
      }),
      prisma.region.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          divisionId: true,
        },
      }),
    ]);

    return NextResponse.json({
      divisions,
      regions: regions.map((r) => ({
        id: r.id,
        name: r.name,
        divisionId: r.divisionId,
      })),
    });
  } catch (error) {
    console.error("Filters API error:", error);
    return NextResponse.json({ error: "Failed to fetch filter options" }, { status: 500 });
  }
}
