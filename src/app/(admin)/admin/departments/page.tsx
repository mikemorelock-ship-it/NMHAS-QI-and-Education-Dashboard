import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DivisionsAndDepartmentsClient } from "./departments-client";

export const dynamic = "force-dynamic";

export default async function DivisionsAndDepartmentsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_departments")) {
    notFound();
  }

  // Fetch divisions (UI: "Division" — top-level units)
  const divisions = await prisma.division.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          regions: true,
          metricEntries: true,
          metricAssociations: true,
        },
      },
    },
  });

  const divisionsData = divisions.map((div) => ({
    id: div.id,
    name: div.name,
    slug: div.slug,
    sortOrder: div.sortOrder,
    isActive: div.isActive,
    departmentsCount: div._count.regions, // Region in DB = Department in UI
    entriesCount: div._count.metricEntries,
    associationsCount: div._count.metricAssociations,
  }));

  // Fetch departments (UI: "Department" — granular units under Division)
  // In DB these are Region records
  const departments = await prisma.region.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      division: { select: { id: true, name: true } },
      _count: {
        select: {
          metricEntries: true,
          metricAssociations: true,
        },
      },
    },
  });

  const departmentsData = departments.map((dept) => ({
    id: dept.id,
    divisionId: dept.divisionId,
    divisionName: dept.division.name,
    name: dept.name,
    role: dept.role,
    isActive: dept.isActive,
    entriesCount: dept._count.metricEntries,
    associationsCount: dept._count.metricAssociations,
  }));

  return <DivisionsAndDepartmentsClient divisions={divisionsData} departments={departmentsData} />;
}
