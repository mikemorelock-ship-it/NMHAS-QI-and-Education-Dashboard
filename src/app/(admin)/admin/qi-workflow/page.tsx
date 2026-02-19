import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { QiWorkflowClient } from "./qi-workflow-client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types shared with the client component
// ---------------------------------------------------------------------------

export interface CampaignSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  goals: string | null;
  status: string;
  isActive: boolean;
  ownerId: string | null;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
  diagramCount: number;
  pdsaCycleCount: number;
  actionItemCount: number;
  /** Completeness 0-100 */
  completeness: number;
  completenessChecks: {
    hasAim: boolean;
    hasMeasures: boolean;
    hasDiagram: boolean;
    hasPdsa: boolean;
    hasActions: boolean;
  };
}

export interface DiagramSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  campaignId: string | null;
  campaignName: string | null;
  nodeCount: number;
  pdsaCycleCount: number;
  metricDefinitionId: string | null;
}

export interface PdsaCycleSummary {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
  driverDiagramId: string | null;
  diagramName: string | null;
  changeIdeaNodeId: string | null;
  changeIdeaText: string | null;
  metricDefinitionId: string | null;
}

export interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

export interface MetricOption {
  id: string;
  name: string;
  departmentName: string | null;
}

export interface ChangeIdeaOption {
  id: string;
  text: string;
  diagramId: string;
  diagramName: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function QiWorkflowPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_campaigns")) {
    notFound();
  }

  // Fetch all QI entities in parallel
  const [campaigns, diagrams, pdsaCycles, actionItems, users, metrics, changeIdeas, departments] =
    await Promise.all([
      prisma.campaign.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          driverDiagrams: {
            select: {
              id: true,
              pdsaCycles: { select: { id: true } },
            },
          },
          _count: { select: { driverDiagrams: true, actionItems: true } },
        },
      }),
      prisma.driverDiagram.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          campaign: { select: { id: true, name: true } },
          _count: { select: { nodes: true, pdsaCycles: true } },
        },
      }),
      prisma.pdsaCycle.findMany({
        orderBy: [{ createdAt: "desc" }],
        include: {
          driverDiagram: { select: { id: true, name: true } },
          changeIdeaNode: { select: { id: true, text: true } },
        },
      }),
      prisma.actionItem.findMany({
        where: { campaignId: { not: null } },
        select: { id: true, campaignId: true },
      }),
      prisma.user.findMany({
        where: { isActive: true, status: "active" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true },
      }),
      prisma.metricDefinition.findMany({
        orderBy: { name: "asc" },
        include: {
          department: { select: { name: true } },
        },
      }),
      prisma.driverNode.findMany({
        where: { type: "changeIdea" },
        orderBy: { text: "asc" },
        include: {
          driverDiagram: { select: { id: true, name: true } },
        },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  // Build campaign summaries with completeness scores
  const campaignSummaries: CampaignSummary[] = campaigns.map((c) => {
    const totalPdsaCycles = c.driverDiagrams.reduce((sum, d) => sum + d.pdsaCycles.length, 0);

    const hasAim = Boolean(c.goals && c.goals.trim().length > 0);
    const hasMeasures = Boolean(
      c.driverDiagrams.some((d) => diagrams.find((dd) => dd.id === d.id && dd.metricDefinitionId))
    );
    const hasDiagram = c._count.driverDiagrams > 0;
    const hasPdsa = totalPdsaCycles > 0;
    const hasActions = c._count.actionItems > 0;

    const checks = [hasAim, hasMeasures, hasDiagram, hasPdsa, hasActions];
    const completeness = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      goals: c.goals,
      status: c.status,
      isActive: c.isActive,
      ownerId: c.ownerId,
      ownerName: c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : null,
      startDate: c.startDate?.toISOString().split("T")[0] ?? null,
      endDate: c.endDate?.toISOString().split("T")[0] ?? null,
      diagramCount: c._count.driverDiagrams,
      pdsaCycleCount: totalPdsaCycles,
      actionItemCount: c._count.actionItems,
      completeness,
      completenessChecks: {
        hasAim,
        hasMeasures,
        hasDiagram,
        hasPdsa,
        hasActions,
      },
    };
  });

  const diagramSummaries: DiagramSummary[] = diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    status: d.status,
    campaignId: d.campaign?.id ?? null,
    campaignName: d.campaign?.name ?? null,
    nodeCount: d._count.nodes,
    pdsaCycleCount: d._count.pdsaCycles,
    metricDefinitionId: d.metricDefinitionId,
  }));

  const pdsaCycleSummaries: PdsaCycleSummary[] = pdsaCycles.map((p) => ({
    id: p.id,
    title: p.title,
    cycleNumber: p.cycleNumber,
    status: p.status,
    outcome: p.outcome,
    driverDiagramId: p.driverDiagram?.id ?? null,
    diagramName: p.driverDiagram?.name ?? null,
    changeIdeaNodeId: p.changeIdeaNode?.id ?? null,
    changeIdeaText: p.changeIdeaNode?.text ?? null,
    metricDefinitionId: p.metricDefinitionId,
  }));

  const metricOptions: MetricOption[] = metrics.map((m) => ({
    id: m.id,
    name: m.name,
    departmentName: m.department?.name ?? null,
  }));

  const changeIdeaOptions: ChangeIdeaOption[] = changeIdeas.map((ci) => ({
    id: ci.id,
    text: ci.text,
    diagramId: ci.driverDiagram.id,
    diagramName: ci.driverDiagram.name,
  }));

  const departmentOptions: DepartmentOption[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
  }));

  return (
    <QiWorkflowClient
      campaigns={campaignSummaries}
      diagrams={diagramSummaries}
      pdsaCycles={pdsaCycleSummaries}
      users={users}
      metrics={metricOptions}
      changeIdeas={changeIdeaOptions}
      departments={departmentOptions}
    />
  );
}
