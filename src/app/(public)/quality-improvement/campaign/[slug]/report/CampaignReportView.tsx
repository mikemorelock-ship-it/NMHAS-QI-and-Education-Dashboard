"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Printer,
  Target,
  Calendar,
  User,
  GitBranchPlus,
  RefreshCcw,
  ListChecks,
  BarChart3,
  CheckCircle2,
  Clock,
  Flag,
  LineChart,
  Activity,
  Building2,
  Share2,
  Copy,
  Check,
  ClipboardList,
  Play,
  Search,
  Zap,
  XCircle,
  ThumbsUp,
  Repeat2,
  Ban,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCampaignShareLink } from "@/actions/campaigns";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  PDSA_STATUS_LABELS,
  PDSA_STATUS_COLORS,
  PDSA_OUTCOME_LABELS,
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_COLORS,
  ACTION_ITEM_PRIORITY_LABELS,
  ACTION_ITEM_PRIORITY_COLORS,
  DRIVER_NODE_TYPE_COLORS,
  NMH_COLORS,
} from "@/lib/constants";
import { ControlChart } from "@/components/dashboard/ControlChart";
import { MetricChart } from "@/components/dashboard/MetricChart";
import { differenceInDays, addDays, format } from "date-fns";
import type { ChartDataPoint, SPCChartData, QIAnnotation } from "@/types";
import { QICoachPanel } from "@/components/qi-coach/QICoachPanel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignInfo {
  name: string;
  slug: string;
  description: string | null;
  goals: string | null;
  keyFindings: string | null;
  status: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
  divisionName?: string | null;
  regionName?: string | null;
}

interface DiagramNodeInfo {
  id: string;
  parentId: string | null;
  type: "aim" | "primary" | "secondary" | "changeIdea";
  text: string;
  description: string | null;
  sortOrder: number;
  pdsaCycleCount: number;
}

interface CycleInfo {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
  changeIdea: string | null;
  metricName: string | null;
  planDescription: string | null;
  planPrediction: string | null;
  doStartDate: string | null;
  doEndDate: string | null;
  studyResults: string | null;
  studyLearnings: string | null;
  actDecision: string | null;
  actNextSteps: string | null;
}

interface DiagramInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  metricName: string | null;
  nodes: DiagramNodeInfo[];
  cycles: CycleInfo[];
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

interface ActionItemInfo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  assigneeName: string | null;
}

interface MilestoneInfo {
  date: string;
  label: string;
  type: "action" | "pdsa" | "campaign";
}

interface GanttItem {
  id: string;
  label: string;
  type: "campaign" | "pdsa" | "action";
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  campaign: CampaignInfo;
  diagrams: DiagramInfo[];
  metrics: MetricReportData[];
  actionItems: ActionItemInfo[];
  milestones: MilestoneInfo[];
  ganttItems: GanttItem[];
  generatedAt: string;
  /** Campaign ID — used for generating share links. Omit in shared view. */
  campaignId?: string;
  /** When true, hides navigation links and share button (standalone shared view). */
  isShared?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GANTT_COLORS: Record<string, string> = {
  campaign: NMH_COLORS.teal,
  pdsa: NMH_COLORS.orange,
  action: NMH_COLORS.gray,
};

const MILESTONE_ICONS: Record<string, string> = {
  campaign: "🏁",
  pdsa: "🔄",
  action: "✅",
};

/** Lucide icon for each PDSA status / phase */
const PDSA_STATUS_ICONS: Record<string, LucideIcon> = {
  planning: ClipboardList,
  doing: Play,
  studying: Search,
  acting: Zap,
  completed: CheckCircle2,
  abandoned: XCircle,
};

/** Lucide icon for each PDSA outcome */
const PDSA_OUTCOME_ICONS: Record<string, LucideIcon> = {
  adopt: ThumbsUp,
  adapt: Repeat2,
  abandon: Ban,
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact driver diagram tree for the report */

interface DiagramTreeNode extends DiagramNodeInfo {
  children: DiagramTreeNode[];
}

function CompactDriverDiagram({ nodes }: { nodes: DiagramNodeInfo[] }) {
  const nodeMap = new Map<string, DiagramTreeNode>();
  const roots: DiagramTreeNode[] = [];

  for (const node of nodes) {
    nodeMap.set(node.id, { ...node, children: [] });
  }

  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  function renderNode(node: DiagramTreeNode, depth: number) {
    const color = DRIVER_NODE_TYPE_COLORS[node.type] ?? "#4b4f54";
    const typeLabels: Record<string, string> = {
      aim: "Aim",
      primary: "Primary",
      secondary: "Secondary",
      changeIdea: "Change Idea",
    };

    return (
      <div key={node.id} style={{ marginLeft: depth * 20 }} className="py-0.5">
        <div className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color }}>
            {typeLabels[node.type] ?? node.type}
          </span>
          <span className="font-medium">{node.text}</span>
          {node.pdsaCycleCount > 0 && (
            <span className="text-[10px] text-muted-foreground">({node.pdsaCycleCount} PDSA)</span>
          )}
        </div>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return <div className="space-y-0.5">{roots.map((r) => renderNode(r, 0))}</div>;
}

/** Compact Gantt chart for the report — purely CSS, no interactivity */
function ReportGanttChart({ items }: { items: GanttItem[] }) {
  const bounds = useMemo(() => {
    const dates: Date[] = [new Date()];
    for (const item of items) {
      if (item.startDate) dates.push(new Date(item.startDate));
      if (item.endDate) dates.push(new Date(item.endDate));
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return {
      start: addDays(min, -7),
      end: addDays(max, 14),
    };
  }, [items]);

  const totalDays = differenceInDays(bounds.end, bounds.start) || 1;

  // Generate month markers, filtering out overlapping labels
  const months = useMemo(() => {
    const all: { label: string; leftPct: number }[] = [];
    const cursor = new Date(bounds.start);
    cursor.setDate(1);
    if (cursor < bounds.start) cursor.setMonth(cursor.getMonth() + 1);

    while (cursor <= bounds.end) {
      const pct = (differenceInDays(cursor, bounds.start) / totalDays) * 100;
      all.push({ label: format(cursor, "MMM yyyy"), leftPct: pct });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Filter to avoid overlapping labels — require at least 10% gap between labels
    const minGap = 10;
    const filtered: typeof all = [];
    for (const m of all) {
      if (filtered.length === 0 || m.leftPct - filtered[filtered.length - 1].leftPct >= minGap) {
        filtered.push(m);
      }
    }
    return filtered;
  }, [bounds, totalDays]);

  const todayPct = (differenceInDays(new Date(), bounds.start) / totalDays) * 100;

  if (items.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden text-sm">
      {/* Month header — uses same layout as rows: label spacer + chart area */}
      <div className="flex border-b">
        <div className="w-[220px] shrink-0 border-r bg-muted/30" />
        <div className="flex-1 relative h-6 bg-muted/30">
          {months.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-muted-foreground whitespace-nowrap"
              style={{ left: `${m.leftPct}%`, top: "4px" }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Rows */}
      {items.map((item) => {
        const isCampaign = item.type === "campaign";
        const barColor = GANTT_COLORS[item.type] ?? NMH_COLORS.gray;

        let leftPct = 0;
        let widthPct = 0;
        let hasBar = false;

        if (item.startDate) {
          const startD = new Date(item.startDate);
          const endD = item.endDate ? new Date(item.endDate) : addDays(startD, 14);
          leftPct = Math.max(0, (differenceInDays(startD, bounds.start) / totalDays) * 100);
          widthPct = Math.max(1, (differenceInDays(endD, startD) / totalDays) * 100);
          hasBar = true;
        }

        return (
          <div
            key={item.id}
            className={`flex border-b last:border-b-0 ${isCampaign ? "bg-muted/10" : ""}`}
          >
            <div
              className={`w-[220px] shrink-0 px-2 py-1.5 text-xs border-r leading-tight break-words ${isCampaign ? "font-semibold" : ""}`}
              title={item.label}
            >
              {item.label}
            </div>
            <div className="flex-1 relative min-h-7">
              {/* Today line */}
              <div
                className="absolute top-0 bottom-0 w-px bg-primary/40 z-10"
                style={{ left: `${todayPct}%` }}
              />
              {hasBar && (
                <div
                  className="absolute top-1 h-5 rounded"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    backgroundColor: barColor,
                    opacity: isCampaign ? 0.9 : 0.7,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-muted/20 border-t text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ backgroundColor: NMH_COLORS.teal }}
          />
          Campaign
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ backgroundColor: NMH_COLORS.orange }}
          />
          PDSA Cycles
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-2 rounded-sm"
            style={{ backgroundColor: NMH_COLORS.gray }}
          />
          Action Items
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-px h-3 bg-primary/40" />
          Today
        </span>
      </div>
    </div>
  );
}

/** PDSA cycle summary card for report */
function PdsaCycleSummary({ cycle }: { cycle: CycleInfo }) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";
  const StatusIcon = PDSA_STATUS_ICONS[cycle.status];
  const OutcomeIcon = cycle.outcome ? PDSA_OUTCOME_ICONS[cycle.outcome] : null;

  return (
    <div className="border rounded-md p-4 text-sm space-y-3 break-inside-avoid">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{cycle.title}</span>
          <span className="text-sm text-muted-foreground">Cycle #{cycle.cycleNumber}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="text-xs gap-1"
            style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
          >
            {StatusIcon && <StatusIcon className="h-3 w-3" />}
            {PDSA_STATUS_LABELS[cycle.status] ?? cycle.status}
          </Badge>
          {cycle.outcome && (
            <Badge
              variant="secondary"
              className={`text-xs gap-1 ${
                cycle.outcome === "adopt"
                  ? "bg-green-100 text-green-700"
                  : cycle.outcome === "adapt"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {OutcomeIcon && <OutcomeIcon className="h-3 w-3" />}
              {PDSA_OUTCOME_LABELS[cycle.outcome] ?? cycle.outcome}
            </Badge>
          )}
        </div>
      </div>

      {cycle.changeIdea && (
        <p className="text-sm text-muted-foreground">Change Idea: {cycle.changeIdea}</p>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {cycle.planDescription && (
          <div>
            <span
              className="font-medium inline-flex items-center gap-1"
              style={{ color: PDSA_STATUS_COLORS.planning }}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Plan:
            </span>{" "}
            {cycle.planDescription}
          </div>
        )}
        {cycle.planPrediction && (
          <div>
            <span className="font-medium text-muted-foreground">Prediction:</span>{" "}
            {cycle.planPrediction}
          </div>
        )}
        {(cycle.doStartDate || cycle.doEndDate) && (
          <div>
            <span
              className="font-medium inline-flex items-center gap-1"
              style={{ color: PDSA_STATUS_COLORS.doing }}
            >
              <Play className="h-3.5 w-3.5" />
              Do:
            </span>{" "}
            {cycle.doStartDate ? formatDate(cycle.doStartDate) : "—"} →{" "}
            {cycle.doEndDate ? formatDate(cycle.doEndDate) : "ongoing"}
          </div>
        )}
        {cycle.studyResults && (
          <div>
            <span
              className="font-medium inline-flex items-center gap-1"
              style={{ color: PDSA_STATUS_COLORS.studying }}
            >
              <Search className="h-3.5 w-3.5" />
              Study:
            </span>{" "}
            {cycle.studyResults}
          </div>
        )}
        {cycle.studyLearnings && (
          <div>
            <span className="font-medium text-muted-foreground">Learnings:</span>{" "}
            {cycle.studyLearnings}
          </div>
        )}
        {cycle.actDecision && (
          <div>
            <span
              className="font-medium inline-flex items-center gap-1"
              style={{ color: PDSA_STATUS_COLORS.acting }}
            >
              <Zap className="h-3.5 w-3.5" />
              Act:
            </span>{" "}
            {cycle.actDecision}
          </div>
        )}
        {cycle.actNextSteps && (
          <div>
            <span className="font-medium text-muted-foreground">Next Steps:</span>{" "}
            {cycle.actNextSteps}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart mode toggle button group
// ---------------------------------------------------------------------------

type ChartMode = "control" | "trending";

function ChartModeToggle({
  mode,
  onModeChange,
}: {
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
}) {
  return (
    <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5 print:hidden">
      <button
        onClick={() => onModeChange("control")}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          mode === "control"
            ? "bg-white text-nmh-teal shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Activity className="h-3.5 w-3.5" />
        Control Chart
      </button>
      <button
        onClick={() => onModeChange("trending")}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
          mode === "trending"
            ? "bg-white text-nmh-teal shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LineChart className="h-3.5 w-3.5" />
        Trending
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share Button
// ---------------------------------------------------------------------------

function ShareButton({ campaignId }: { campaignId: string }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleGenerateLink() {
    setError(null);
    startTransition(async () => {
      const res = await createCampaignShareLink(campaignId);
      if (res.success && res.data) {
        const url = `${window.location.origin}/share/campaign/${res.data.token}`;
        setShareUrl(url);
      } else {
        setError(res.error ?? "Failed to create share link");
      }
    });
  }

  function handleCopy() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setOpen(true);
          setShareUrl(null);
          setCopied(false);
          setError(null);
        }}
      >
        <Share2 className="h-4 w-4" /> Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share Campaign Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Generate a public link that anyone can use to view this campaign report without logging
            in. Navigation and other dashboard features will not be visible.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!shareUrl ? (
            <Button onClick={handleGenerateLink} disabled={isPending} className="w-full">
              {isPending ? "Generating..." : "Generate Share Link"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border p-2.5">
                <code className="flex-1 text-xs break-all text-muted-foreground">{shareUrl}</code>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can view the report. You can revoke links from the admin
                panel.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Report Component
// ---------------------------------------------------------------------------

export function CampaignReportView({
  campaign,
  diagrams,
  metrics,
  actionItems,
  milestones,
  ganttItems,
  generatedAt,
  campaignId,
  isShared = false,
}: Props) {
  const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#4b4f54";
  const completedCycles = diagrams.flatMap((d) => d.cycles).filter((c) => c.status === "completed");
  const totalCycles = diagrams.flatMap((d) => d.cycles).length;
  const openActions = actionItems.filter((a) => a.status !== "completed").length;

  // Chart mode per metric — default to "control" for all
  const [chartModes, setChartModes] = useState<Record<string, ChartMode>>({});
  const getChartMode = (metricId: string): ChartMode => chartModes[metricId] ?? "control";
  const setChartMode = (metricId: string, mode: ChartMode) =>
    setChartModes((prev) => ({ ...prev, [metricId]: mode }));

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {/* Screen-only navigation */}
      {!isShared && (
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/quality-improvement"
            className="text-sm text-muted-foreground hover:text-nmh-teal flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to QI Tools
          </Link>
          <div className="flex items-center gap-2">
            {campaignId && <ShareButton campaignId={campaignId} />}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
              <Printer className="h-4 w-4" /> Print Report
            </Button>
          </div>
        </div>
      )}
      {isShared && (
        <div className="flex items-center justify-end print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="h-4 w-4" /> Print Report
          </Button>
        </div>
      )}

      {/* ================================================================= */}
      {/* REPORT HEADER                                                     */}
      {/* ================================================================= */}
      <header className="border-b pb-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Target className="h-7 w-7 text-nmh-teal" />
          <h1 className="text-2xl font-bold text-nmh-gray">{campaign.name}</h1>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant="secondary"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
          >
            {CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
          </Badge>
          {campaign.ownerName && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              {campaign.ownerName}
            </span>
          )}
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            {campaign.divisionName && campaign.regionName
              ? `${campaign.divisionName} › ${campaign.regionName}`
              : (campaign.divisionName ?? campaign.regionName ?? "Organization-wide")}
          </span>
          {(campaign.startDate || campaign.endDate) && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {campaign.startDate ? formatDate(campaign.startDate) : "—"} →{" "}
              {campaign.endDate ? formatDate(campaign.endDate) : "—"}
            </span>
          )}
        </div>

        {campaign.description && (
          <p className="text-sm text-muted-foreground">{campaign.description}</p>
        )}

        <p className="text-[10px] text-muted-foreground">
          Report generated{" "}
          {new Date(generatedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </header>

      {/* ================================================================= */}
      {/* EXECUTIVE SUMMARY                                                 */}
      {/* ================================================================= */}
      <section className="space-y-4 break-inside-avoid">
        <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-nmh-teal" />
          Executive Summary
        </h2>

        {campaign.goals && (
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Goals & Objectives
            </p>
            <p className="text-sm whitespace-pre-line">{campaign.goals}</p>
          </div>
        )}

        {campaign.keyFindings && (
          <div className="bg-nmh-teal/5 border border-nmh-teal/20 rounded-lg p-4">
            <p className="text-xs font-medium text-nmh-teal uppercase tracking-wide mb-1">
              Key Findings & Lessons Learned
            </p>
            <p className="text-sm whitespace-pre-line">{campaign.keyFindings}</p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-nmh-teal">{diagrams.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Driver Diagrams</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-nmh-orange">{totalCycles}</div>
            <p className="text-xs text-muted-foreground mt-0.5">PDSA Cycles</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-nmh-gray">{completedCycles.length}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Completed Cycles</p>
          </div>
          <div className="border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-nmh-teal">{openActions}</div>
            <p className="text-xs text-muted-foreground mt-0.5">Open Actions</p>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* GANTT CHART — Campaign Timeline                                   */}
      {/* ================================================================= */}
      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
          <Clock className="h-5 w-5 text-nmh-teal" />
          Campaign Timeline
        </h2>
        <ReportGanttChart items={ganttItems} />
      </section>

      {/* ================================================================= */}
      {/* DRIVER DIAGRAMS                                                   */}
      {/* ================================================================= */}
      {diagrams.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <GitBranchPlus className="h-5 w-5 text-nmh-teal" />
            Driver Diagrams
          </h2>

          {diagrams.map((diagram) => (
            <div key={diagram.id} className="border rounded-lg p-4 space-y-3 break-inside-avoid">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/quality-improvement/diagram/${diagram.slug}`}
                  className="font-semibold text-nmh-gray hover:text-nmh-teal transition-colors flex items-center gap-1.5 print:pointer-events-none"
                >
                  {diagram.name}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground print:hidden" />
                </Link>
                {diagram.metricName && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20"
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {diagram.metricName}
                  </Badge>
                )}
              </div>
              {diagram.description && (
                <p className="text-sm text-muted-foreground">{diagram.description}</p>
              )}
              <CompactDriverDiagram nodes={diagram.nodes} />
            </div>
          ))}
        </section>
      )}

      {/* ================================================================= */}
      {/* PDSA CYCLES                                                       */}
      {/* ================================================================= */}
      {totalCycles > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-nmh-orange" />
            Change Ideas &amp; PDSA Cycles ({totalCycles})
          </h2>

          {diagrams.map((diagram) => {
            if (diagram.cycles.length === 0) return null;

            // Group cycles by change idea for progression tracking
            const grouped = new Map<string, CycleInfo[]>();
            const ungrouped: CycleInfo[] = [];
            for (const cycle of diagram.cycles) {
              if (cycle.changeIdea) {
                const key = cycle.changeIdea;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key)!.push(cycle);
              } else {
                ungrouped.push(cycle);
              }
            }

            return (
              <div key={diagram.id} className="space-y-4">
                <h3 className="text-base font-medium text-muted-foreground">{diagram.name}</h3>

                {/* Grouped by change idea */}
                {Array.from(grouped.entries()).map(([changeIdea, cycles]) => (
                  <div key={changeIdea} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-nmh-gray">Change Idea:</span>
                      <span className="text-muted-foreground">{changeIdea}</span>
                      <span className="text-muted-foreground/50">
                        ({cycles.length} cycle{cycles.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    {/* Progression chain */}
                    <div className="flex items-center gap-1.5 flex-wrap text-sm">
                      {cycles.map((c, idx) => {
                        const ChainIcon = c.outcome
                          ? PDSA_OUTCOME_ICONS[c.outcome]
                          : PDSA_STATUS_ICONS[c.status];
                        return (
                          <span key={c.id} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-muted-foreground/40">→</span>}
                            <Badge
                              variant="secondary"
                              className={`text-xs gap-1 ${
                                c.outcome === "adopt"
                                  ? "bg-green-100 text-green-700"
                                  : c.outcome === "adapt"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : c.outcome === "abandon"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-muted"
                              }`}
                            >
                              {ChainIcon && <ChainIcon className="h-3 w-3" />}
                              Cycle {c.cycleNumber}
                              {c.outcome
                                ? `: ${PDSA_OUTCOME_LABELS[c.outcome] ?? c.outcome}`
                                : ` (${PDSA_STATUS_LABELS[c.status] ?? c.status})`}
                            </Badge>
                          </span>
                        );
                      })}
                    </div>
                    <div className="space-y-2">
                      {cycles.map((cycle) => (
                        <PdsaCycleSummary key={cycle.id} cycle={cycle} />
                      ))}
                    </div>
                  </div>
                ))}

                {/* Ungrouped cycles (no change idea linked) */}
                {ungrouped.length > 0 && (
                  <div className="space-y-2">
                    {ungrouped.map((cycle) => (
                      <PdsaCycleSummary key={cycle.id} cycle={cycle} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ================================================================= */}
      {/* METRIC PERFORMANCE                                                */}
      {/* ================================================================= */}
      {metrics.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-nmh-teal" />
            Metric Performance
          </h2>

          {metrics.map((metric) => {
            const hasSpc = !!metric.spcData;
            const hasChartData = metric.chartData.length > 0;
            const mode = getChartMode(metric.id);

            return (
              <div key={metric.id} className="space-y-3 break-inside-avoid">
                {/* Change idea implementation overlay info */}
                {metric.changeIdeaRanges.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-1">
                    <p className="font-medium">Change ideas implemented during this period:</p>
                    {metric.changeIdeaRanges.map((ci, i) => (
                      <p key={i} className="pl-3">
                        • {ci.label}
                        {ci.startDate && (
                          <span>
                            {" "}
                            ({formatDate(ci.startDate)}
                            {ci.endDate ? ` → ${formatDate(ci.endDate)}` : " → ongoing"})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}

                {/* Chart with toggle */}
                {hasSpc && hasChartData ? (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {metric.name} — {mode === "control" ? "Control Chart" : "Trending"}
                      </h3>
                      <ChartModeToggle
                        mode={mode}
                        onModeChange={(m) => setChartMode(metric.id, m)}
                      />
                    </div>
                    {mode === "control" ? (
                      <ControlChart
                        spcData={metric.spcData!}
                        unit={metric.unit}
                        target={metric.target}
                        rateMultiplier={metric.rateMultiplier}
                        rateSuffix={metric.rateSuffix}
                        annotations={metric.annotations}
                        baselineStartPeriod={metric.baselineStartPeriod}
                        baselineEndPeriod={metric.baselineEndPeriod}
                      />
                    ) : (
                      <MetricChart
                        name={metric.name}
                        unit={metric.unit}
                        chartType={metric.chartType as "line" | "bar" | "area"}
                        data={metric.chartData}
                        target={metric.target ?? undefined}
                        rateMultiplier={metric.rateMultiplier}
                        rateSuffix={metric.rateSuffix}
                        baselineStartPeriod={metric.baselineStartPeriod}
                        baselineEndPeriod={metric.baselineEndPeriod}
                      />
                    )}
                  </div>
                ) : hasSpc ? (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-sm mb-3">{metric.name} — Control Chart</h3>
                    <ControlChart
                      spcData={metric.spcData!}
                      unit={metric.unit}
                      target={metric.target}
                      rateMultiplier={metric.rateMultiplier}
                      rateSuffix={metric.rateSuffix}
                      annotations={metric.annotations}
                      baselineStartPeriod={metric.baselineStartPeriod}
                      baselineEndPeriod={metric.baselineEndPeriod}
                    />
                  </div>
                ) : hasChartData ? (
                  <MetricChart
                    name={metric.name}
                    unit={metric.unit}
                    chartType={metric.chartType as "line" | "bar" | "area"}
                    data={metric.chartData}
                    target={metric.target ?? undefined}
                    rateMultiplier={metric.rateMultiplier}
                    rateSuffix={metric.rateSuffix}
                    baselineStartPeriod={metric.baselineStartPeriod}
                    baselineEndPeriod={metric.baselineEndPeriod}
                  />
                ) : (
                  <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center">
                    No data available for {metric.name}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* ================================================================= */}
      {/* MILESTONES                                                        */}
      {/* ================================================================= */}
      {milestones.length > 0 && (
        <section className="space-y-3 break-inside-avoid">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <Flag className="h-5 w-5 text-nmh-teal" />
            Milestones
          </h2>
          <div className="border rounded-lg divide-y">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="text-base">{MILESTONE_ICONS[m.type] ?? "📌"}</span>
                <span className="text-muted-foreground w-[100px] shrink-0 text-xs">
                  {formatDate(m.date)}
                </span>
                <span className="font-medium flex-1">{m.label}</span>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {m.type}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* ACTION ITEMS                                                      */}
      {/* ================================================================= */}
      {actionItems.length > 0 && (
        <section className="space-y-3 break-inside-avoid">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-nmh-teal" />
            Action Items ({actionItems.length})
          </h2>
          <div className="border rounded-lg divide-y">
            {actionItems.map((a) => {
              const pColor = ACTION_ITEM_PRIORITY_COLORS[a.priority] ?? "#4b4f54";
              const sColor = ACTION_ITEM_STATUS_COLORS[a.status] ?? "#4b4f54";
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${a.status === "completed" ? "opacity-60" : ""}`}
                >
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${a.status === "completed" ? "text-green-600" : "text-muted-foreground/30"}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium text-sm ${a.status === "completed" ? "line-through" : ""}`}
                    >
                      {a.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {a.assigneeName && <span>{a.assigneeName}</span>}
                      {a.dueDate && <span>Due {formatDate(a.dueDate)}</span>}
                      {a.completedAt && <span>Completed {formatDate(a.completedAt)}</span>}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: `${pColor}20`, color: pColor }}
                    className="text-[10px] shrink-0"
                  >
                    {ACTION_ITEM_PRIORITY_LABELS[a.priority] ?? a.priority}
                  </Badge>
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: `${sColor}20`, color: sColor }}
                    className="text-[10px] shrink-0"
                  >
                    {ACTION_ITEM_STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* FOOTER                                                            */}
      {/* ================================================================= */}
      <footer className="border-t pt-4 text-xs text-muted-foreground text-center space-y-1">
        <p>
          QI Campaign Report — {campaign.name} — Generated{" "}
          {new Date(generatedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <p>North Memorial Health Ambulance Service — Quality Improvement Department</p>
      </footer>

      {/* QI Coach floating panel */}
      <QICoachPanel
        context={{
          campaignName: campaign.name,
          campaignGoals: campaign.goals ?? undefined,
          campaignStatus: campaign.status,
          pdsaCycleCount: totalCycles,
          completedCycles: completedCycles.length,
        }}
      />
    </div>
  );
}
