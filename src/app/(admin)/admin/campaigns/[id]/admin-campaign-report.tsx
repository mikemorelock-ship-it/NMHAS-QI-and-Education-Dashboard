"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
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
  Pencil,
  PencilOff,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { updateCampaignField } from "@/actions/campaigns";
import { assignDiagramToCampaign } from "@/actions/campaigns";
import { updatePdsaCycleField } from "@/actions/pdsa-cycles";
import {
  createActionItem,
  updateActionItem,
  deleteActionItem,
  toggleActionItemStatus,
} from "@/actions/action-items";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  goals: string | null;
  keyFindings: string | null;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  metricName: string | null;
  divisionName: string | null;
  regionName: string | null;
  divisionNames: string[];
  regionNames: string[];
  startDate: string | null;
  endDate: string | null;
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
  doObservations: string | null;
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

interface ActionItemRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  pdsaCycleId: string | null;
  pdsaCycleName: string | null;
  campaignId: string;
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

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface Props {
  campaign: CampaignInfo;
  diagrams: DiagramInfo[];
  metrics: MetricReportData[];
  actionItems: ActionItemRow[];
  milestones: MilestoneInfo[];
  ganttItems: GanttItem[];
  generatedAt: string;
  unassignedDiagrams: { id: string; name: string }[];
  users: UserOption[];
  campaignCycles: { id: string; title: string }[];
  divisions: { id: string; name: string }[];
  regions: { id: string; name: string; divisionId: string }[];
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
  campaign: "\u{1F3C1}",
  pdsa: "\u{1F504}",
  action: "\u2705",
};

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Inline editable field components
// ---------------------------------------------------------------------------

function EditableText({
  value,
  onSave,
  editing,
  multiline,
  placeholder,
  className,
}: {
  value: string | null;
  onSave: (val: string | null) => void;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(() => {
    const trimmed = draft.trim();
    const newVal = trimmed === "" ? null : trimmed;
    if (newVal !== value) {
      setSaving(true);
      onSave(newVal);
      // Reset saving after a short delay (server action will revalidate)
      setTimeout(() => setSaving(false), 800);
    }
  }, [draft, value, onSave]);

  if (!editing) {
    return (
      <span className={className}>
        {value || <span className="text-muted-foreground italic">{placeholder ?? "Not set"}</span>}
      </span>
    );
  }

  if (multiline) {
    return (
      <div className="relative">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          placeholder={placeholder}
          rows={3}
          className={`text-sm ${className ?? ""}`}
        />
        {saving && (
          <Loader2 className="absolute top-2 right-2 h-3 w-3 animate-spin text-nmh-teal" />
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder={placeholder}
        className={`text-sm h-8 ${className ?? ""}`}
      />
      {saving && <Loader2 className="h-3 w-3 animate-spin text-nmh-teal" />}
    </div>
  );
}

function EditableSelect({
  value,
  options,
  onSave,
  editing,
  renderValue,
}: {
  value: string;
  options: Record<string, string>;
  onSave: (val: string) => void;
  editing: boolean;
  renderValue?: (val: string) => React.ReactNode;
}) {
  if (!editing) {
    return <>{renderValue ? renderValue(value) : (options[value] ?? value)}</>;
  }

  return (
    <Select value={value} onValueChange={onSave}>
      <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([val, label]) => (
          <SelectItem key={val} value={val}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditableDateField({
  value,
  onSave,
  editing,
}: {
  value: string | null;
  onSave: (val: string | null) => void;
  editing: boolean;
}) {
  if (!editing) {
    return <span>{value ? formatDate(value) : "\u2014"}</span>;
  }

  return (
    <Input
      type="date"
      defaultValue={value ?? ""}
      onBlur={(e) => onSave(e.target.value || null)}
      className="h-8 w-auto text-xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-components (from public report, adapted)
// ---------------------------------------------------------------------------

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

function ReportGanttChart({ items }: { items: GanttItem[] }) {
  const bounds = useMemo(() => {
    const dates: Date[] = [new Date()];
    for (const item of items) {
      if (item.startDate) dates.push(new Date(item.startDate));
      if (item.endDate) dates.push(new Date(item.endDate));
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    return { start: addDays(min, -7), end: addDays(max, 14) };
  }, [items]);

  const totalDays = differenceInDays(bounds.end, bounds.start) || 1;

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

// ---------------------------------------------------------------------------
// Editable PDSA Cycle Summary
// ---------------------------------------------------------------------------

function EditablePdsaCycleSummary({
  cycle,
  editing,
  onFieldSave,
}: {
  cycle: CycleInfo;
  editing: boolean;
  onFieldSave: (cycleId: string, field: string, value: string | null) => void;
}) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";

  return (
    <div className="border rounded-md p-3 text-sm space-y-2 break-inside-avoid">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{cycle.title}</span>
          <span className="text-xs text-muted-foreground">Cycle #{cycle.cycleNumber}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <EditableSelect
            value={cycle.status}
            options={PDSA_STATUS_LABELS}
            editing={editing}
            onSave={(val) => onFieldSave(cycle.id, "status", val)}
            renderValue={(val) => (
              <Badge
                variant="secondary"
                className="text-[10px]"
                style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
              >
                {PDSA_STATUS_LABELS[val] ?? val}
              </Badge>
            )}
          />
          {editing ? (
            <EditableSelect
              value={cycle.outcome ?? "__none__"}
              options={{
                __none__: "No outcome",
                adopt: "Adopt",
                adapt: "Adapt",
                abandon: "Abandon",
              }}
              editing={editing}
              onSave={(val) => onFieldSave(cycle.id, "outcome", val === "__none__" ? null : val)}
            />
          ) : (
            cycle.outcome && (
              <Badge
                variant="secondary"
                className={`text-[10px] ${
                  cycle.outcome === "adopt"
                    ? "bg-green-100 text-green-700"
                    : cycle.outcome === "adapt"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {PDSA_OUTCOME_LABELS[cycle.outcome] ?? cycle.outcome}
              </Badge>
            )
          )}
        </div>
      </div>

      {cycle.changeIdea && (
        <p className="text-xs text-muted-foreground">Change Idea: {cycle.changeIdea}</p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="font-medium" style={{ color: PDSA_STATUS_COLORS.planning }}>
            Plan:
          </span>{" "}
          <EditableText
            value={cycle.planDescription}
            editing={editing}
            multiline={editing}
            placeholder="Plan description..."
            onSave={(val) => onFieldSave(cycle.id, "planDescription", val)}
          />
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Prediction:</span>{" "}
          <EditableText
            value={cycle.planPrediction}
            editing={editing}
            multiline={editing}
            placeholder="Prediction..."
            onSave={(val) => onFieldSave(cycle.id, "planPrediction", val)}
          />
        </div>
        <div>
          <span className="font-medium" style={{ color: PDSA_STATUS_COLORS.doing }}>
            Do:
          </span>{" "}
          <EditableDateField
            value={cycle.doStartDate}
            editing={editing}
            onSave={(val) => onFieldSave(cycle.id, "doStartDate", val)}
          />{" "}
          &rarr;{" "}
          <EditableDateField
            value={cycle.doEndDate}
            editing={editing}
            onSave={(val) => onFieldSave(cycle.id, "doEndDate", val)}
          />
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Observations:</span>{" "}
          <EditableText
            value={cycle.doObservations ?? null}
            editing={editing}
            multiline={editing}
            placeholder="Observations..."
            onSave={(val) => onFieldSave(cycle.id, "doObservations", val)}
          />
        </div>
        <div>
          <span className="font-medium" style={{ color: PDSA_STATUS_COLORS.studying }}>
            Study:
          </span>{" "}
          <EditableText
            value={cycle.studyResults}
            editing={editing}
            multiline={editing}
            placeholder="Results..."
            onSave={(val) => onFieldSave(cycle.id, "studyResults", val)}
          />
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Learnings:</span>{" "}
          <EditableText
            value={cycle.studyLearnings}
            editing={editing}
            multiline={editing}
            placeholder="Learnings..."
            onSave={(val) => onFieldSave(cycle.id, "studyLearnings", val)}
          />
        </div>
        <div>
          <span className="font-medium" style={{ color: PDSA_STATUS_COLORS.acting }}>
            Act:
          </span>{" "}
          <EditableText
            value={cycle.actDecision}
            editing={editing}
            multiline={editing}
            placeholder="Decision..."
            onSave={(val) => onFieldSave(cycle.id, "actDecision", val)}
          />
        </div>
        <div>
          <span className="font-medium text-muted-foreground">Next Steps:</span>{" "}
          <EditableText
            value={cycle.actNextSteps}
            editing={editing}
            multiline={editing}
            placeholder="Next steps..."
            onSave={(val) => onFieldSave(cycle.id, "actNextSteps", val)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart mode toggle
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
    <div className="flex gap-0.5 bg-muted/50 rounded-lg p-0.5">
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
// Action Item Form Fields (reused for create/edit dialogs)
// ---------------------------------------------------------------------------

function ActionItemFormFields({
  users,
  campaignCycles,
  defaults,
}: {
  users: UserOption[];
  campaignCycles: { id: string; title: string }[];
  defaults?: Partial<ActionItemRow>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaults?.title ?? ""}
          required
          maxLength={200}
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaults?.description ?? ""}
          rows={3}
          maxLength={2000}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaults?.status ?? "open"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_ITEM_STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select name="priority" defaultValue={defaults?.priority ?? "medium"}>
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_ITEM_PRIORITY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="assigneeId">Assignee</Label>
          <Select name="assigneeId" defaultValue={defaults?.assigneeId ?? "__none__"}>
            <SelectTrigger id="assigneeId">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dueDate">Due Date</Label>
          <Input id="dueDate" name="dueDate" type="date" defaultValue={defaults?.dueDate ?? ""} />
        </div>
      </div>
      {campaignCycles.length > 0 && (
        <div>
          <Label htmlFor="pdsaCycleId">Linked PDSA Cycle</Label>
          <Select name="pdsaCycleId" defaultValue={defaults?.pdsaCycleId ?? "__none__"}>
            <SelectTrigger id="pdsaCycleId">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {campaignCycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AdminCampaignReport({
  campaign,
  diagrams,
  metrics,
  actionItems,
  milestones,
  ganttItems,
  generatedAt,
  unassignedDiagrams,
  users,
  campaignCycles,
}: Props) {
  const [editMode, setEditMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Action item dialog state
  const [showCreateAction, setShowCreateAction] = useState(false);
  const [editAction, setEditAction] = useState<ActionItemRow | null>(null);
  const [deleteAction, setDeleteAction] = useState<ActionItemRow | null>(null);

  // Add diagram state
  const [showAddDiagram, setShowAddDiagram] = useState(false);
  const [selectedDiagramId, setSelectedDiagramId] = useState("");

  // Chart modes
  const [chartModes, setChartModes] = useState<Record<string, ChartMode>>({});
  const getChartMode = (metricId: string): ChartMode => chartModes[metricId] ?? "control";
  const setChartMode = (metricId: string, mode: ChartMode) =>
    setChartModes((prev) => ({ ...prev, [metricId]: mode }));

  // Computed stats
  const completedCycles = diagrams.flatMap((d) => d.cycles).filter((c) => c.status === "completed");
  const totalCycles = diagrams.flatMap((d) => d.cycles).length;
  const openActions = actionItems.filter((a) => a.status !== "completed").length;

  // User lookup for owner select
  const userOptions: Record<string, string> = { __none__: "Unassigned" };
  for (const u of users) {
    userOptions[u.id] = `${u.firstName} ${u.lastName}`;
  }

  // --- Save helpers ---

  function flashSave(msg?: string) {
    setSaveNotice(msg ?? "Saved");
    setTimeout(() => setSaveNotice(null), 1500);
  }

  function saveCampaignField(field: string, value: string | null) {
    startTransition(async () => {
      const res = await updateCampaignField(campaign.id, field, value);
      if (!res.success) setError(res.error ?? "Failed to save");
      else flashSave();
    });
  }

  function savePdsaField(cycleId: string, field: string, value: string | null) {
    startTransition(async () => {
      const res = await updatePdsaCycleField(cycleId, field, value);
      if (!res.success) setError(res.error ?? "Failed to save");
      else flashSave();
    });
  }

  // --- Diagram management ---

  function handleAddDiagram() {
    if (!selectedDiagramId) return;
    startTransition(async () => {
      const res = await assignDiagramToCampaign(selectedDiagramId, campaign.id);
      if (!res.success) setError(res.error ?? "Failed");
      else {
        setShowAddDiagram(false);
        setSelectedDiagramId("");
      }
    });
  }

  function handleRemoveDiagram(diagramId: string) {
    startTransition(async () => {
      const res = await assignDiagramToCampaign(diagramId, null);
      if (!res.success) setError(res.error ?? "Failed");
    });
  }

  // --- Action items ---

  function stripNone(fd: FormData) {
    for (const [key, val] of Array.from(fd.entries())) {
      if (val === "__none__") fd.set(key, "");
    }
  }

  function handleCreateAction(fd: FormData) {
    stripNone(fd);
    fd.set("campaignId", campaign.id);
    startTransition(async () => {
      const res = await createActionItem(fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setShowCreateAction(false);
    });
  }

  function handleEditAction(fd: FormData) {
    if (!editAction) return;
    stripNone(fd);
    fd.set("campaignId", campaign.id);
    startTransition(async () => {
      const res = await updateActionItem(editAction.id, fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setEditAction(null);
    });
  }

  function handleDeleteAction() {
    if (!deleteAction) return;
    startTransition(async () => {
      const res = await deleteActionItem(deleteAction.id);
      if (!res.success) setError(res.error ?? "Failed");
      else setDeleteAction(null);
    });
  }

  function handleToggleComplete(item: ActionItemRow) {
    const newStatus = item.status === "completed" ? "open" : "completed";
    startTransition(async () => {
      const res = await toggleActionItemStatus(item.id, newStatus);
      if (!res.success) setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* ================================================================= */}
      {/* NAVIGATION + EDIT MODE TOGGLE                                     */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/campaigns"
          className="text-sm text-muted-foreground hover:text-nmh-teal flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
        </Link>
        <div className="flex items-center gap-2">
          {saveNotice && (
            <span className="flex items-center gap-1 text-xs text-green-600 animate-in fade-in">
              <Check className="h-3 w-3" /> {saveNotice}
            </span>
          )}
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className="gap-1.5"
          >
            {editMode ? (
              <>
                <PencilOff className="h-4 w-4" /> Exit Edit Mode
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" /> Edit Mode
              </>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {editMode && (
        <div className="rounded-lg border border-nmh-teal/30 bg-nmh-teal/5 p-3 text-sm text-nmh-teal flex items-center gap-2">
          <Pencil className="h-4 w-4 shrink-0" />
          <span>
            <strong>Edit Mode is active.</strong> Click on any highlighted field to edit it. Changes
            save automatically.
          </span>
        </div>
      )}

      {/* ================================================================= */}
      {/* REPORT HEADER                                                     */}
      {/* ================================================================= */}
      <header className="border-b pb-6 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Target className="h-7 w-7 text-nmh-teal" />
          {editMode ? (
            <EditableText
              value={campaign.name}
              editing={editMode}
              onSave={(val) => val && saveCampaignField("name", val)}
              className="text-2xl font-bold text-nmh-gray"
            />
          ) : (
            <h1 className="text-2xl font-bold text-nmh-gray">{campaign.name}</h1>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <EditableSelect
            value={campaign.status}
            options={CAMPAIGN_STATUS_LABELS}
            editing={editMode}
            onSave={(val) => saveCampaignField("status", val)}
            renderValue={(val) => {
              const sc = CAMPAIGN_STATUS_COLORS[val] ?? "#4b4f54";
              return (
                <Badge variant="secondary" style={{ backgroundColor: `${sc}20`, color: sc }}>
                  {CAMPAIGN_STATUS_LABELS[val] ?? val}
                </Badge>
              );
            }}
          />

          {editMode ? (
            <div className="flex items-center gap-1 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <EditableSelect
                value={campaign.ownerId ?? "__none__"}
                options={userOptions}
                editing={editMode}
                onSave={(val) => saveCampaignField("ownerId", val === "__none__" ? null : val)}
              />
            </div>
          ) : (
            campaign.ownerName && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                {campaign.ownerName}
              </span>
            )
          )}

          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            {campaign.divisionName && campaign.regionName
              ? `${campaign.divisionName} \u203A ${campaign.regionName}`
              : (campaign.divisionName ?? campaign.regionName ?? "Organization-wide")}
          </span>

          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <EditableDateField
              value={campaign.startDate}
              editing={editMode}
              onSave={(val) => saveCampaignField("startDate", val)}
            />
            {" \u2192 "}
            <EditableDateField
              value={campaign.endDate}
              editing={editMode}
              onSave={(val) => saveCampaignField("endDate", val)}
            />
          </span>
        </div>

        <EditableText
          value={campaign.description}
          editing={editMode}
          multiline={editMode}
          placeholder="Campaign description..."
          onSave={(val) => saveCampaignField("description", val)}
          className="text-sm text-muted-foreground block"
        />

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

        <div
          className={`rounded-lg p-4 ${editMode ? "border border-dashed border-nmh-teal/30 bg-muted/10" : "bg-muted/30"}`}
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Goals & Objectives
          </p>
          <EditableText
            value={campaign.goals}
            editing={editMode}
            multiline
            placeholder="Add campaign goals and objectives..."
            onSave={(val) => saveCampaignField("goals", val)}
            className="text-sm whitespace-pre-line"
          />
        </div>

        <div
          className={`rounded-lg p-4 ${editMode ? "border border-dashed border-nmh-teal/30 bg-nmh-teal/5" : "bg-nmh-teal/5 border border-nmh-teal/20"}`}
        >
          <p className="text-xs font-medium text-nmh-teal uppercase tracking-wide mb-1">
            Key Findings & Lessons Learned
          </p>
          <EditableText
            value={campaign.keyFindings}
            editing={editMode}
            multiline
            placeholder="Summarize key findings, lessons learned, and interpretations..."
            onSave={(val) => saveCampaignField("keyFindings", val)}
            className="text-sm whitespace-pre-line"
          />
        </div>

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
      {/* GANTT CHART                                                       */}
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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <GitBranchPlus className="h-5 w-5 text-nmh-teal" />
            Driver Diagrams ({diagrams.length})
          </h2>
          {editMode && unassignedDiagrams.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowAddDiagram(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Diagram
            </Button>
          )}
        </div>

        {diagrams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No diagrams linked to this campaign yet.
          </p>
        ) : (
          diagrams.map((diagram) => (
            <div key={diagram.id} className="border rounded-lg p-4 space-y-3 break-inside-avoid">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/admin/driver-diagrams/${diagram.id}`}
                  className="font-semibold text-nmh-gray hover:text-nmh-teal transition-colors flex items-center gap-1.5"
                >
                  {diagram.name}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <div className="flex items-center gap-2">
                  {diagram.metricName && (
                    <Badge
                      variant="outline"
                      className="text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20"
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {diagram.metricName}
                    </Badge>
                  )}
                  {editMode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleRemoveDiagram(diagram.id)}
                      title="Remove from campaign"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
              {diagram.description && (
                <p className="text-sm text-muted-foreground">{diagram.description}</p>
              )}
              <CompactDriverDiagram nodes={diagram.nodes} />
            </div>
          ))
        )}
      </section>

      {/* ================================================================= */}
      {/* PDSA CYCLES                                                       */}
      {/* ================================================================= */}
      {(totalCycles > 0 || editMode) && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-nmh-orange" />
            PDSA Cycles ({totalCycles})
          </h2>

          {diagrams.map((diagram) => {
            if (diagram.cycles.length === 0) return null;

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
              <div key={diagram.id} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">{diagram.name}</h3>

                {Array.from(grouped.entries()).map(([changeIdea, cycles]) => (
                  <div key={changeIdea} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-nmh-gray">Change Idea:</span>
                      <span className="text-muted-foreground">{changeIdea}</span>
                      <span className="text-muted-foreground/50">
                        ({cycles.length} cycle{cycles.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    {!editMode && (
                      <div className="flex items-center gap-1 flex-wrap text-xs">
                        {cycles.map((c, idx) => (
                          <span key={c.id} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-muted-foreground/40">&rarr;</span>}
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${
                                c.outcome === "adopt"
                                  ? "bg-green-100 text-green-700"
                                  : c.outcome === "adapt"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : c.outcome === "abandon"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-muted"
                              }`}
                            >
                              Cycle {c.cycleNumber}
                              {c.outcome
                                ? `: ${PDSA_OUTCOME_LABELS[c.outcome] ?? c.outcome}`
                                : ` (${PDSA_STATUS_LABELS[c.status] ?? c.status})`}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="space-y-2">
                      {cycles.map((cycle) => (
                        <EditablePdsaCycleSummary
                          key={cycle.id}
                          cycle={cycle}
                          editing={editMode}
                          onFieldSave={savePdsaField}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {ungrouped.length > 0 && (
                  <div className="space-y-2">
                    {ungrouped.map((cycle) => (
                      <EditablePdsaCycleSummary
                        key={cycle.id}
                        cycle={cycle}
                        editing={editMode}
                        onFieldSave={savePdsaField}
                      />
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
                {metric.changeIdeaRanges.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pl-1">
                    <p className="font-medium">Change ideas implemented during this period:</p>
                    {metric.changeIdeaRanges.map((ci, i) => (
                      <p key={i} className="pl-3">
                        &bull; {ci.label}
                        {ci.startDate && (
                          <span>
                            {" "}
                            ({formatDate(ci.startDate)}
                            {ci.endDate ? ` \u2192 ${formatDate(ci.endDate)}` : " \u2192 ongoing"})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                )}

                {hasSpc && hasChartData ? (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                      <h3 className="font-semibold text-sm">
                        {metric.name} &mdash; {mode === "control" ? "Control Chart" : "Trending"}
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
                    <h3 className="font-semibold text-sm mb-3">
                      {metric.name} &mdash; Control Chart
                    </h3>
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
                <span className="text-base">{MILESTONE_ICONS[m.type] ?? "\u{1F4CC}"}</span>
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
      <section className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-nmh-teal" />
            Action Items ({actionItems.length})
          </h2>
          {editMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setError(null);
                setShowCreateAction(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Action Item
            </Button>
          )}
        </div>
        {actionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No action items yet.</p>
        ) : (
          <div className="border rounded-lg divide-y">
            {actionItems.map((a) => {
              const pColor = ACTION_ITEM_PRIORITY_COLORS[a.priority] ?? "#4b4f54";
              const sColor = ACTION_ITEM_STATUS_COLORS[a.status] ?? "#4b4f54";
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-2 text-sm ${a.status === "completed" ? "opacity-60" : ""}`}
                >
                  <button
                    onClick={() => handleToggleComplete(a)}
                    className="hover:scale-110 transition-transform"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${a.status === "completed" ? "text-green-600" : "text-muted-foreground/30"}`}
                    />
                  </button>
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
                      {a.pdsaCycleName && <span>&rarr; {a.pdsaCycleName}</span>}
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
                  {editMode && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setError(null);
                          setEditAction(a);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteAction(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* FOOTER                                                            */}
      {/* ================================================================= */}
      <footer className="border-t pt-4 text-xs text-muted-foreground text-center space-y-1">
        <p>QI Campaign Report &mdash; {campaign.name} &mdash; Admin View</p>
        <p>North Memorial Health Ambulance Service &mdash; Quality Improvement Department</p>
      </footer>

      {/* ================================================================= */}
      {/* DIALOGS                                                           */}
      {/* ================================================================= */}

      {/* Add Diagram Dialog */}
      <Dialog open={showAddDiagram} onOpenChange={setShowAddDiagram}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Diagram to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Select a diagram</Label>
            <Select value={selectedDiagramId} onValueChange={setSelectedDiagramId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose diagram..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedDiagrams.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDiagram(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDiagram} disabled={!selectedDiagramId || isPending}>
              {isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Action Item Dialog */}
      <Dialog open={showCreateAction} onOpenChange={setShowCreateAction}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Action Item</DialogTitle>
          </DialogHeader>
          <form action={handleCreateAction}>
            <ActionItemFormFields users={users} campaignCycles={campaignCycles} />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateAction(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Action Item Dialog */}
      <Dialog
        open={!!editAction}
        onOpenChange={(open) => {
          if (!open) setEditAction(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Action Item</DialogTitle>
          </DialogHeader>
          {editAction && (
            <form action={handleEditAction}>
              <ActionItemFormFields
                users={users}
                campaignCycles={campaignCycles}
                defaults={editAction}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditAction(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Action Item Dialog */}
      <Dialog
        open={!!deleteAction}
        onOpenChange={(open) => {
          if (!open) setDeleteAction(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Action Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteAction?.title}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAction(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAction} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
