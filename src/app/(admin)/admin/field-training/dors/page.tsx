import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { DorsClient } from "./dors-client";
import { parsePagination } from "@/lib/pagination";
import { PaginationControls } from "@/components/PaginationControls";

export const dynamic = "force-dynamic";

export default async function DorsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_dors_skills")) {
    notFound();
  }

  const params = await searchParams;
  const { page, pageSize } = parsePagination(params, { pageSize: 50 });
  const skip = (page - 1) * pageSize;

  const [dors, totalCount] = await Promise.all([
    prisma.dailyEvaluation.findMany({
      orderBy: { date: "desc" },
      include: {
        trainee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
        fto: { select: { firstName: true, lastName: true } },
        phase: { select: { name: true } },
        ratings: {
          include: { category: { select: { name: true, sortOrder: true } } },
          orderBy: { category: { sortOrder: "asc" } },
        },
      },
      skip,
      take: pageSize,
    }),
    prisma.dailyEvaluation.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pagination = {
    page: Math.min(page, totalPages),
    pageSize,
    totalItems: totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };

  return (
    <>
      <DorsClient
        dors={dors.map((d) => ({
          id: d.id,
          date: d.date.toISOString(),
          traineeId: d.trainee.id,
          traineeName: `${d.trainee.firstName} ${d.trainee.lastName}`,
          traineeEmployeeId: d.trainee.employeeId || "",
          ftoName: `${d.fto.firstName} ${d.fto.lastName}`,
          phaseName: d.phase?.name ?? null,
          overallRating: d.overallRating,
          narrative: d.narrative,
          mostSatisfactory: d.mostSatisfactory,
          leastSatisfactory: d.leastSatisfactory,
          recommendAction: d.recommendAction,
          nrtFlag: d.nrtFlag,
          remFlag: d.remFlag,
          traineeAcknowledged: d.traineeAcknowledged,
          status: d.status,
          supervisorReviewedBy: d.supervisorReviewedBy,
          ratings: d.ratings.map((r) => ({
            categoryName: r.category.name,
            rating: r.rating,
            comments: r.comments,
          })),
        }))}
      />
      <div className="mt-4 px-2">
        <PaginationControls
          pagination={pagination}
          basePath="/admin/field-training/dors"
          searchParams={params as Record<string, string | string[] | undefined>}
        />
      </div>
    </>
  );
}
