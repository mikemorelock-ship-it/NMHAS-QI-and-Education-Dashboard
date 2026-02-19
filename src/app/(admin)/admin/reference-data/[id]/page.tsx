import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DepartmentEditClient } from "./department-edit-client";

export const dynamic = "force-dynamic";

export default async function DepartmentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_metric_defs")) {
    notFound();
  }

  const { id } = await params;

  const department = await prisma.department.findUnique({
    where: { id },
    include: {
      divisions: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!department) {
    notFound();
  }

  return (
    <DepartmentEditClient
      department={{
        id: department.id,
        name: department.name,
        type: department.type,
        description: department.description,
      }}
      divisions={department.divisions.map((d) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        isActive: d.isActive,
      }))}
    />
  );
}
