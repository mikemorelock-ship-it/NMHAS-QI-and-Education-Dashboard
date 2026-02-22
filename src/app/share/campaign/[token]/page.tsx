import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/utils";
import { computeSPCData } from "@/lib/spc-server";
import { CampaignReportView } from "@/app/(public)/quality-improvement/campaign/[slug]/report/CampaignReportView";
import type { ChartDataPoint, SPCChartData, QIAnnotation } from "@/types";

export const dynamic = "force-dynamic";

export default async function SharedCampaignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate the share link
  const shareLink = await prisma.campaignShareLink.findUnique({
    where: { token },
    include: { campaign: true },
  });

  if (!shareLink || !shareLink.isActive) notFound();
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) notFound();

  const campaignId = shareLink.campaignId;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      division: { select: { name: true } },
      region: { select: { name: true } },
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
          assignee: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!campaign || !campaign.isActive) notFound();

  // ---------------------------------------------------------------------------
  // Build metric data (same logic as the authenticated page)
  // ---------------------------------------------------------------------------

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

    // Scope entries by campaign division/region
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

  // ---------------------------------------------------------------------------
  // Build diagram, milestone, and gantt data
  // ---------------------------------------------------------------------------

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
      metricName: c.metricDefinition?.name ?? null,
      planDescription: c.planDescription,
      planPrediction: c.planPrediction,
      doStartDate: c.doStartDate?.toISOString().split("T")[0] ?? null,
      doEndDate: c.doEndDate?.toISOString().split("T")[0] ?? null,
      studyResults: c.studyResults,
      studyLearnings: c.studyLearnings,
      actDecision: c.actDecision,
      actNextSteps: c.actNextSteps,
    })),
  }));

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

  return (
    <CampaignReportView
      campaign={{
        name: campaign.name,
        description: campaign.description,
        goals: campaign.goals,
        keyFindings: campaign.keyFindings,
        status: campaign.status,
        ownerName: campaign.owner ? `${campaign.owner.firstName} ${campaign.owner.lastName}` : null,
        startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
        endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
        slug: campaign.slug,
        divisionName: campaign.division?.name ?? null,
        regionName: campaign.region?.name ?? null,
      }}
      diagrams={diagramsData}
      metrics={metricsData}
      actionItems={campaign.actionItems.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        status: a.status,
        priority: a.priority,
        dueDate: a.dueDate?.toISOString().split("T")[0] ?? null,
        completedAt: a.completedAt?.toISOString().split("T")[0] ?? null,
        assigneeName: a.assignee ? `${a.assignee.firstName} ${a.assignee.lastName}` : null,
      }))}
      milestones={milestones}
      ganttItems={ganttItems}
      isShared
      generatedAt={new Date().toISOString()}
    />
  );
}
