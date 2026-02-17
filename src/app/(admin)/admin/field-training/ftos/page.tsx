import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { FtosClient } from "./ftos-client";

export const dynamic = "force-dynamic";

export default async function FtosPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_ftos_trainees")) {
    notFound();
  }

  const ftos = await prisma.user.findMany({
    where: { role: { in: ["fto", "supervisor", "manager", "admin"] } },
    orderBy: { lastName: "asc" },
    include: {
      division: { select: { id: true, name: true } },
      _count: { select: { ftoAssignments: true, ftoDailyEvals: true } },
    },
  });

  const divisions = await prisma.division.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <FtosClient
      ftos={ftos.map((f) => ({
        id: f.id,
        firstName: f.firstName,
        lastName: f.lastName,
        employeeId: f.employeeId || "",
        email: f.email,
        badgeNumber: f.badgeNumber,
        divisionId: f.divisionId,
        divisionName: f.division?.name ?? null,
        role: f.role,
        hasPin: !!f.passwordHash,
        isActive: f.isActive,
        assignmentCount: f._count.ftoAssignments,
        evalCount: f._count.ftoDailyEvals,
      }))}
      divisions={divisions}
    />
  );
}
