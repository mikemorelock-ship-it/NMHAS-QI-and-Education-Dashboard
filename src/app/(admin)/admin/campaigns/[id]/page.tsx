import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/utils";
import { computeSPCData } from "@/lib/spc-server";
import { AdminCampaignReport } from "./admin-campaign-report";
import type { ChartDataPoint, SPCChartData, QIAnnotation } from "@/types";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_campaigns")) {
    notFound();
  }

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true } },
      metricDefinition: { select: { id: true, name: true } },
      division: { select: { name: true } },
      region: { select: { name: true } },
      campaignDivisions: {
        include: { division: { select: { id: true, name: true } } },
      },
      campaignRegions: {
        include: { region: { select: { id: true, name: true } } },
      },
      driverDiagrams: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          metricDefinition: {
            select: {
              id: true,
              name: true,
              slug: true,
              unit: true,
              chartType: true,
              target: true,
              dataType: true,
              spcSigmaLevel: true,
              baselineStart: true,
              baselineEnd: true,
              departmentId: true,
              rateMultiplier: true,
              rateSuffix: true,
            },
          },
          nodes: {
            orderBy: [{ sortOrder: "asc" }],
            include: {
              _count: { select: { pdsaCycles: true } },
            },
          },
          pdsaCycles: {
            orderBy: [{ cycleNumber: "asc" }],
            include: {
              metricDefinition: { select: { name: true } },
              changeIdeaNode: { select: { text: true } },
            },
          },
        },
      },
      actionItems: {
        orderBy: [{ status: "asc" }, { priority: "desc" }, { dueDate: "asc" }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true } },
          pdsaCycle: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!campaign) notFound();

  // -------------------------------------------------------------------------
  // Fetch admin-specific lookup data in parallel
  // -------------------------------------------------------------------------

  const [unassignedDiagrams, users, allCycles, divisions, regions] = await Promise.all([
    prisma.driverDiagram.findMany({
      where: { campaignId: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.pdsaCycle.findMany({
      where: { driverDiagram: { campaignId: id } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.division.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, divisionId: true },
    }),
  ]);

  // -------------------------------------------------------------------------
  // Build metric chart data + SPC (same logic as public page)
  // -------------------------------------------------------------------------

  const metricIds = new Set<string>();
  for (const d of campaign.driverDiagrams) {
    if (d.metricDefinition) metricIds.add(d.metricDefinition.id);
  }

  const pdsaAnnotations: Record<string, QIAnnotation[]> = {};
  for (const d of campaign.driverDiagrams) {
    if (!d.metricDefinition) continue;
    const mid = d.metricDefinition.id;
    if (!pdsaAnnotations[mid]) pdsaAnnotations[mid] = [];

    for (const cycle of d.pdsaCycles) {
      const dateStr =
        cycle.doStartDate?.toISOString() ??
        cycle.planStartDate?.toISOString() ??
        cycle.createdAt.toISOString();
      pdsaAnnotations[mid].push({
        id: cycle.id,
        date: dateStr,
        period: formatPeriod(new Date(dateStr)),
        label: `PDSA #${cycle.cycleNumber}: ${cycle.title}`,
        type: "pdsa",
      });
    }
  }

  interface MetricReportData {
    id: string;
    name: string;
    unit: string;
    chartType: string;
    target: number | null;
    rateMultiplier: number | null;
    rateSuffix: string | null;
    chartData: ChartDataPoint[];
    spcData: SPCChartData | null;
    annotations: QIAnnotation[];
    changeIdeaRanges: Array<{
      label: string;
      startDate: string | null;
      endDate: string | null;
    }>;
    baselineStartPeriod: string | null;
    baselineEndPeriod: string | null;
  }

  const metricsData: MetricReportData[] = [];

  for (const metricId of metricIds) {
    const diagramWithMetric = campaign.driverDiagrams.find(
      (d) => d.metricDefinition?.id === metricId
    );
    if (!diagramWithMetric?.metricDefinition) continue;
    const metricDef = diagramWithMetric.metricDefinition;

    const entryWhere: Record<string, unknown> = {
      metricDefinitionId: metricId,
      departmentId: metricDef.departmentId,
    };
    if (campaign.regionId) {
      entryWhere.regionId = campaign.regionId;
    } else if (campaign.divisionId) {
      entryWhere.divisionId = campaign.divisionId;
      entryWhere.regionId = null;
    } else {
      entryWhere.divisionId = null;
      entryWhere.regionId = null;
    }

    const entries = await prisma.metricEntry.findMany({
      where: entryWhere,
      orderBy: { periodStart: "asc" },
      select: { periodStart: true, value: true },
    });

    const chartData: ChartDataPoint[] = entries.map((e) => ({
      period: formatPeriod(e.periodStart),
      value: e.value,
    }));

    let spcData: SPCChartData | null = null;
    if (chartData.length >= 2) {
      spcData =
        (await computeSPCData(
          {
            metricId,
            dataType: metricDef.dataType,
            spcSigmaLevel: metricDef.spcSigmaLevel,
            baselineStart: metricDef.baselineStart,
            baselineEnd: metricDef.baselineEnd,
            entryWhereClause: entryWhere,
          },
          chartData
        )) ?? null;
    }

    const changeIdeaRanges: MetricReportData["changeIdeaRanges"] = [];
    for (const d of campaign.driverDiagrams) {
      if (d.metricDefinition?.id !== metricId) continue;
      for (const cycle of d.pdsaCycles) {
        changeIdeaRanges.push({
          label: cycle.changeIdeaNode?.text ?? cycle.title,
          startDate: cycle.doStartDate?.toISOString().split("T")[0] ?? null,
          endDate: cycle.doEndDate?.toISOString().split("T")[0] ?? null,
        });
      }
    }

    metricsData.push({
      id: metricId,
      name: metricDef.name,
      unit: metricDef.unit,
      chartType: metricDef.chartType,
      target: metricDef.target,
      rateMultiplier: metricDef.rateMultiplier,
      rateSuffix: metricDef.rateSuffix,
      chartData,
      spcData,
      annotations: pdsaAnnotations[metricId] ?? [],
      changeIdeaRanges,
      baselineStartPeriod: metricDef.baselineStart ? formatPeriod(metricDef.baselineStart) : null,
      baselineEndPeriod: metricDef.baselineEnd ? formatPeriod(metricDef.baselineEnd) : null,
    });
  }

  // -------------------------------------------------------------------------
  // Build driver diagram data with full trees
  // -------------------------------------------------------------------------

  const diagramsData = campaign.driverDiagrams.map((d) => ({
    id: d.id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    metricName: d.metricDefinition?.name ?? null,
    nodes: d.nodes.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      type: n.type as "aim" | "primary" | "secondary" | "changeIdea",
      text: n.text,
      description: n.description,
      sortOrder: n.sortOrder,
      pdsaCycleCount: n._count.pdsaCycles,
    })),
    cycles: d.pdsaCycles.map((c) => ({
      id: c.id,
      title: c.title,
      cycleNumber: c.cycleNumber,
      status: c.status,
      outcome: c.outcome,
      changeIdea: c.changeIdeaNode?.text ?? null,
      changeIdeaNodeId: c.changeIdeaNodeId,
      metricName: c.metricDefinition?.name ?? null,
      planDescription: c.planDescription,
      planPrediction: c.planPrediction,
      doStartDate: c.doStartDate?.toISOString().split("T")[0] ?? null,
      doEndDate: c.doEndDate?.toISOString().split("T")[0] ?? null,
      doObservations: c.doObservations,
      studyResults: c.studyResults,
      studyLearnings: c.studyLearnings,
      actDecision: c.actDecision,
      actNextSteps: c.actNextSteps,
    })),
  }));

  // -------------------------------------------------------------------------
  // Build milestones
  // -------------------------------------------------------------------------

  const milestones: Array<{
    date: string;
    label: string;
    type: "action" | "pdsa" | "campaign";
  }> = [];

  if (campaign.startDate) {
    milestones.push({
      date: campaign.startDate.toISOString().split("T")[0],
      label: "Campaign Start",
      type: "campaign",
    });
  }
  if (campaign.endDate) {
    milestones.push({
      date: campaign.endDate.toISOString().split("T")[0],
      label: "Campaign End (Target)",
      type: "campaign",
    });
  }

  for (const a of campaign.actionItems) {
    if (a.completedAt) {
      milestones.push({
        date: a.completedAt.toISOString().split("T")[0],
        label: a.title,
        type: "action",
      });
    }
  }

  for (const d of campaign.driverDiagrams) {
    for (const c of d.pdsaCycles) {
      if (c.status === "completed" && c.actDate) {
        milestones.push({
          date: c.actDate.toISOString().split("T")[0],
          label: `PDSA #${c.cycleNumber}: ${c.title} — ${c.outcome ?? "completed"}`,
          type: "pdsa",
        });
      }
    }
  }

  milestones.sort((a, b) => a.date.localeCompare(b.date));

  // -------------------------------------------------------------------------
  // Build Gantt items
  // -------------------------------------------------------------------------

  const ganttItems: Array<{
    id: string;
    label: string;
    type: "campaign" | "pdsa" | "action";
    status: string;
    startDate: string | null;
    endDate: string | null;
  }> = [];

  ganttItems.push({
    id: campaign.id,
    label: campaign.name,
    type: "campaign",
    status: campaign.status,
    startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
    endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
  });

  for (const d of campaign.driverDiagrams) {
    for (const c of d.pdsaCycles) {
      const start =
        c.planStartDate?.toISOString().split("T")[0] ??
        c.doStartDate?.toISOString().split("T")[0] ??
        null;
      const end =
        c.actDate?.toISOString().split("T")[0] ?? c.doEndDate?.toISOString().split("T")[0] ?? null;

      ganttItems.push({
        id: c.id,
        label: `PDSA #${c.cycleNumber}: ${c.title}`,
        type: "pdsa",
        status: c.status,
        startDate: start,
        endDate: end,
      });
    }
  }

  for (const a of campaign.actionItems) {
    if (a.dueDate || a.completedAt) {
      ganttItems.push({
        id: a.id,
        label: a.title,
        type: "action",
        status: a.status,
        startDate: a.createdAt.toISOString().split("T")[0],
        endDate:
          a.completedAt?.toISOString().split("T")[0] ??
          a.dueDate?.toISOString().split("T")[0] ??
          null,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Serialize campaign data
  // -------------------------------------------------------------------------

  const campaignData = {
    id: campaign.id,
    name: campaign.name,
    slug: campaign.slug,
    description: campaign.description,
    goals: campaign.goals,
    keyFindings: campaign.keyFindings,
    status: campaign.status,
    ownerId: campaign.ownerId,
    ownerName: campaign.owner ? `${campaign.owner.firstName} ${campaign.owner.lastName}` : null,
    metricName: campaign.metricDefinition?.name ?? null,
    divisionName: campaign.division?.name ?? null,
    regionName: campaign.region?.name ?? null,
    divisionNames: campaign.campaignDivisions.map((cd) => cd.division.name),
    regionNames: campaign.campaignRegions.map((cr) => cr.region.name),
    startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
    endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
  };

  const actionItemsData = campaign.actionItems.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    priority: a.priority,
    dueDate: a.dueDate?.toISOString().split("T")[0] ?? null,
    completedAt: a.completedAt?.toISOString().split("T")[0] ?? null,
    assigneeId: a.assigneeId,
    assigneeName: a.assignee ? `${a.assignee.firstName} ${a.assignee.lastName}` : null,
    pdsaCycleId: a.pdsaCycleId,
    pdsaCycleName: a.pdsaCycle?.title ?? null,
    campaignId: id,
  }));

  return (
    <AdminCampaignReport
      campaign={campaignData}
      diagrams={diagramsData}
      metrics={metricsData}
      actionItems={actionItemsData}
      milestones={milestones}
      ganttItems={ganttItems}
      generatedAt={new Date().toISOString()}
      unassignedDiagrams={unassignedDiagrams}
      users={users}
      campaignCycles={allCycles}
      divisions={divisions}
      regions={regions}
    />
  );
}
