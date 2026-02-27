import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { JustCulturePageClient } from "./just-culture-client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types shared with the client component
// ---------------------------------------------------------------------------

export interface JcaSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  incidentDate: string | null;
  behaviorType: string | null;
  recommendation: string | null;
  involvedPerson: string | null;
  involvedRole: string | null;
  campaignId: string | null;
  campaignName: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CampaignOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function JustCulturePage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_campaigns")) {
    notFound();
  }

  const [assessments, campaigns] = await Promise.all([
    prisma.justCultureAssessment.findMany({
      orderBy: { createdAt: "desc" },
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

  const jcaSummaries: JcaSummary[] = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    incidentDate: a.incidentDate?.toISOString().split("T")[0] ?? null,
    behaviorType: a.behaviorType,
    recommendation: a.recommendation,
    involvedPerson: a.involvedPerson,
    involvedRole: a.involvedRole,
    campaignId: a.campaign?.id ?? null,
    campaignName: a.campaign?.name ?? null,
    createdByName: a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : null,
    createdAt: a.createdAt.toISOString(),
  }));

  return <JustCulturePageClient assessments={jcaSummaries} campaigns={campaigns} />;
}
