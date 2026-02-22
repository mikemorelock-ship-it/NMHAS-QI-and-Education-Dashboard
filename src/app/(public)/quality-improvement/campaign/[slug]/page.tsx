import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPeriod } from "@/lib/utils";
import { computeSPCData } from "@/lib/spc-server";
import { CampaignReportView } from "./report/CampaignReportView";
import type { ChartDataPoint, SPCChartData, QIAnnotation } from "@/types";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { slug },
    include: {
      owner: { select: { firstName: true, lastName: true } },
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
  // Build metric data for each unique metric linked via driver diagrams
  // ---------------------------------------------------------------------------

  const metricIds = new Set<string>();
  for (const d of campaign.driverDiagrams) {
    if (d.metricDefinition) metricIds.add(d.metricDefinition.id);
  }

  // Also collect PDSA cycle date ranges for annotation overlay on metric charts
  const pdsaAnnotations: Record<string, QIAnnotation[]> = {};

  for (const d of campaign.driverDiagrams) {
    if (!d.metricDefinition) continue;
    const mid = d.metricDefinition.id;
    if (!pdsaAnnotations[mid]) pdsaAnnotations[mid] = [];

    for (const cycle of d.pdsaCycles) {
      // Use the earliest available date as the annotation point
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

  // Fetch metric chart data + SPC for each linked metric
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
    // Change idea date ranges for overlay on the chart
    changeIdeaRanges: Array<{
      label: string;
      startDate: string | null;
      endDate: string | null;
    }>;
  }

  const metricsData: MetricReportData[] = [];

  for (const metricId of metricIds) {
    const diagramWithMetric = campaign.driverDiagrams.find(
      (d) => d.metricDefinition?.id === metricId
    );
    if (!diagramWithMetric?.metricDefinition) continue;
    const metricDef = diagramWithMetric.metricDefinition;

    // Fetch all entries for this metric (department level)
    const entries = await prisma.metricEntry.findMany({
      where: {
        metricDefinitionId: metricId,
        departmentId: metricDef.departmentId,
        divisionId: null,
        regionId: null,
      },
      orderBy: { periodStart: "asc" },
      select: { periodStart: true, value: true },
    });

    const chartData: ChartDataPoint[] = entries.map((e) => ({
      period: formatPeriod(e.periodStart),
      value: e.value,
    }));

    // Compute SPC
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
            entryWhereClause: {
              metricDefinitionId: metricId,
              departmentId: metricDef.departmentId,
              divisionId: null,
              regionId: null,
            },
          },
          chartData
        )) ?? null;
    }

    // Build change idea date ranges from PDSA cycles linked to this metric's diagrams
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
    });
  }

  // ---------------------------------------------------------------------------
  // Build driver diagram data for the report
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

  // ---------------------------------------------------------------------------
  // Build milestones from action items + PDSA completions
  // ---------------------------------------------------------------------------

  const milestones: Array<{
    date: string;
    label: string;
    type: "action" | "pdsa" | "campaign";
  }> = [];

  // Campaign start/end
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

  // Completed action items
  for (const a of campaign.actionItems) {
    if (a.completedAt) {
      milestones.push({
        date: a.completedAt.toISOString().split("T")[0],
        label: a.title,
        type: "action",
      });
    }
  }

  // Completed PDSA cycles
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

  // ---------------------------------------------------------------------------
  // Gantt chart items: campaign + individual PDSA cycles
  // ---------------------------------------------------------------------------

  const ganttItems: Array<{
    id: string;
    label: string;
    type: "campaign" | "pdsa" | "action";
    status: string;
    startDate: string | null;
    endDate: string | null;
  }> = [];

  // Campaign bar
  ganttItems.push({
    id: campaign.id,
    label: campaign.name,
    type: "campaign",
    status: campaign.status,
    startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
    endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
  });

  // PDSA cycles as gantt rows
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

  // Action items with due dates
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
        status: campaign.status,
        ownerName: campaign.owner ? `${campaign.owner.firstName} ${campaign.owner.lastName}` : null,
        startDate: campaign.startDate?.toISOString().split("T")[0] ?? null,
        endDate: campaign.endDate?.toISOString().split("T")[0] ?? null,
        slug: campaign.slug,
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
      generatedAt={new Date().toISOString()}
    />
  );
}
