import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { FtoDorListClient } from "./fto-dor-list-client";
import { TraineeDorListClient } from "./trainee-dor-list-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingDorsPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  if (session.role !== "trainee") {
    const dors = await prisma.dailyEvaluation.findMany({
      where: { ftoId: session.userId },
      orderBy: { date: "desc" },
      include: {
        trainee: { select: { firstName: true, lastName: true, employeeId: true } },
        phase: { select: { name: true } },
      },
    });

    return (
      <FtoDorListClient
        dors={dors.map((d) => ({
          id: d.id,
          date: d.date.toISOString(),
          traineeName: `${d.trainee.lastName}, ${d.trainee.firstName}`,
          traineeEmployeeId: d.trainee.employeeId || "",
          phaseName: d.phase?.name || null,
          overallRating: d.overallRating,
          status: d.status,
          traineeAcknowledged: d.traineeAcknowledged,
          recommendAction: d.recommendAction,
        }))}
      />
    );
  }

  // Trainee: Only show submitted DORs (not drafts)
  const dors = await prisma.dailyEvaluation.findMany({
    where: { traineeId: session.userId, status: "submitted" },
    orderBy: { date: "desc" },
    include: {
      fto: { select: { firstName: true, lastName: true } },
      phase: { select: { name: true } },
    },
  });

  return (
    <TraineeDorListClient
      dors={dors.map((d) => ({
        id: d.id,
        date: d.date.toISOString(),
        ftoName: `${d.fto.lastName}, ${d.fto.firstName}`,
        phaseName: d.phase?.name || null,
        overallRating: d.overallRating,
        traineeAcknowledged: d.traineeAcknowledged,
        acknowledgedAt: d.acknowledgedAt?.toISOString() || null,
        recommendAction: d.recommendAction,
      }))}
    />
  );
}
