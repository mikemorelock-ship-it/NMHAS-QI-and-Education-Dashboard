import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { NewDorClient } from "./new-dor-client";

export const dynamic = "force-dynamic";

export default async function NewDorPage({
  searchParams,
}: {
  searchParams: Promise<{ traineeId?: string }>;
}) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_dors_skills")) {
    notFound();
  }

  const { traineeId } = await searchParams;

  const rawTrainees = await prisma.user.findMany({
    where: { role: "trainee", traineeStatus: { in: ["active", "remediation"] } },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true, employeeId: true },
  });
  const trainees = rawTrainees.map((t) => ({
    ...t,
    employeeId: t.employeeId || "",
  }));

  const ftos = await prisma.user.findMany({
    where: { role: { in: ["fto", "supervisor", "manager", "admin"] }, isActive: true },
    orderBy: { lastName: "asc" },
    select: { id: true, firstName: true, lastName: true },
  });

  const phases = await prisma.trainingPhase.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const dorCategories = await prisma.evaluationCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true },
  });

  return (
    <NewDorClient
      trainees={trainees}
      ftos={ftos}
      phases={phases}
      dorCategories={dorCategories}
      defaultTraineeId={traineeId ?? null}
    />
  );
}
