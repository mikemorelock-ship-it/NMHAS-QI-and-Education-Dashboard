import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { RcaPageClient } from "./rca-client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types shared with the client component
// ---------------------------------------------------------------------------

export interface RcaSummary {
  id: string;
  title: string;
  description: string | null;
  method: string;
  status: string;
  severity: string | null;
  incidentDate: string | null;
  campaignId: string | null;
  campaignName: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function RootCauseAnalysisPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_campaigns")) {
    notFound();
  }

  const [rcas, campaigns] = await Promise.all([
    prisma.rootCauseAnalysis.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rcaSummaries: RcaSummary[] = rcas.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    method: r.method,
    status: r.status,
    severity: r.severity,
    incidentDate: r.incidentDate?.toISOString().split("T")[0] ?? null,
    campaignId: r.campaign?.id ?? null,
    campaignName: r.campaign?.name ?? null,
    createdByName: r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return <RcaPageClient rcas={rcaSummaries} campaigns={campaigns} />;
}
