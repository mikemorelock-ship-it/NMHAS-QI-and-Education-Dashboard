import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { FtoDorViewClient } from "./fto-dor-view-client";
import { DorDetailClient } from "./dor-detail-client";

export const dynamic = "force-dynamic";

export default async function FieldTrainingDorViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await verifySession();
  if (!session) redirect("/login");

  if (session.role !== "trainee") {
    return <FtoDorView dorId={id} userId={session.userId} />;
  }

  return <TraineeDorView dorId={id} userId={session.userId} />;
}

// ---------------------------------------------------------------------------
// FTO: Read-only view of submitted DORs
// ---------------------------------------------------------------------------

async function FtoDorView({ dorId, userId }: { dorId: string; userId: string }) {
  const session = await verifySession();
  const canReviewAll = session && hasPermission(session.role, "review_approve_dors");

  const dor = await prisma.dailyEvaluation.findUnique({
    where: { id: dorId },
    include: {
      trainee: { select: { firstName: true, lastName: true, employeeId: true } },
      fto: { select: { firstName: true, lastName: true } },
      phase: { select: { name: true } },
      ratings: {
        include: { category: { select: { name: true, sortOrder: true } } },
        orderBy: { category: { sortOrder: "asc" } },
      },
    },
  });

  if (!dor) notFound();

  // Draft owned by current FTO → redirect to edit
  if (dor.status === "draft" && dor.ftoId === userId) {
    redirect(`/fieldtraining/dors/${dorId}/edit`);
  }
  // Draft from another FTO → supervisors/managers/admins can view, others cannot
  if (dor.status === "draft" && !canReviewAll) notFound();

  return (
    <FtoDorViewClient
      dor={{
        id: dor.id,
        date: dor.date.toISOString(),
        traineeName: `${dor.trainee.lastName}, ${dor.trainee.firstName} (${dor.trainee.employeeId})`,
        ftoName: `${dor.fto.lastName}, ${dor.fto.firstName}`,
        phaseName: dor.phase?.name || null,
        overallRating: dor.overallRating,
        narrative: dor.narrative,
        mostSatisfactory: dor.mostSatisfactory,
        leastSatisfactory: dor.leastSatisfactory,
        recommendAction: dor.recommendAction,
        nrtFlag: dor.nrtFlag,
        remFlag: dor.remFlag,
        traineeAcknowledged: dor.traineeAcknowledged,
        acknowledgedAt: dor.acknowledgedAt?.toISOString() || null,
        ratings: dor.ratings.map((r) => ({
          categoryName: r.category.name,
          rating: r.rating,
          comments: r.comments,
        })),
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Trainee: Detail view with acknowledgment
// ---------------------------------------------------------------------------

async function TraineeDorView({ dorId, userId }: { dorId: string; userId: string }) {
  const dor = await prisma.dailyEvaluation.findUnique({
    where: { id: dorId },
    include: {
      fto: { select: { firstName: true, lastName: true } },
      phase: { select: { name: true } },
      ratings: {
        include: { category: { select: { name: true, sortOrder: true } } },
        orderBy: { category: { sortOrder: "asc" } },
      },
    },
  });

  if (!dor) notFound();
  if (dor.traineeId !== userId) redirect("/fieldtraining/dors");
  if (dor.status !== "submitted") redirect("/fieldtraining/dors");

  return (
    <DorDetailClient
      dor={{
        id: dor.id,
        date: dor.date.toISOString(),
        ftoName: `${dor.fto.lastName}, ${dor.fto.firstName}`,
        phaseName: dor.phase?.name || null,
        overallRating: dor.overallRating,
        narrative: dor.narrative,
        mostSatisfactory: dor.mostSatisfactory,
        leastSatisfactory: dor.leastSatisfactory,
        recommendAction: dor.recommendAction,
        nrtFlag: dor.nrtFlag,
        remFlag: dor.remFlag,
        traineeAcknowledged: dor.traineeAcknowledged,
        acknowledgedAt: dor.acknowledgedAt?.toISOString() || null,
        ratings: dor.ratings.map((r) => ({
          categoryName: r.category.name,
          rating: r.rating,
          comments: r.comments,
        })),
      }}
      traineeId={userId}
    />
  );
}
