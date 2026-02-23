import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const associations = await prisma.metricAssociation.findMany({
    where: { metricDefinitionId: id },
    include: {
      division: { select: { id: true, name: true } },
      region: { select: { id: true, name: true, divisionId: true } },
    },
  });

  const divisionIds = [
    ...new Set(associations.filter((a) => a.divisionId).map((a) => a.divisionId as string)),
  ];

  const regionIds = [
    ...new Set(associations.filter((a) => a.regionId).map((a) => a.regionId as string)),
  ];

  return NextResponse.json({ divisionIds, regionIds });
}
