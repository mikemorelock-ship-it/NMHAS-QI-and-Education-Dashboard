import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SnapshotReportClient } from "./snapshot-report-client";
import type { SnapshotData } from "@/lib/snapshot-builder";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SnapshotPage({ params }: PageProps) {
  const { token } = await params;

  const snapshot = await prisma.traineeSnapshot.findUnique({
    where: { token },
    select: {
      id: true,
      isActive: true,
      expiresAt: true,
      snapshotData: true,
      createdAt: true,
    },
  });

  if (!snapshot || !snapshot.isActive) {
    notFound();
  }

  if (snapshot.expiresAt && new Date() > snapshot.expiresAt) {
    notFound();
  }

  let data: SnapshotData;
  try {
    data = JSON.parse(snapshot.snapshotData) as SnapshotData;
  } catch {
    notFound();
  }

  return <SnapshotReportClient data={data} />;
}
