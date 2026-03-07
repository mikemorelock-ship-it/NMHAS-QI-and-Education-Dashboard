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
  CopyPlus,
  ClipboardList,
  Play,
  Search,
  Zap,
  XCircle,
  ThumbsUp,
  Repeat2,
  Ban,
  ChevronRight,
  type LucideIcon,
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
import { updateCampaignField, assignDiagramToCampaign } from "@/actions/campaigns";
import {
  updatePdsaCycleField,
  clonePdsaCycle,
  createPdsaCycle,
  deletePdsaCycle,
  advancePdsaCycle,
} from "@/actions/pdsa-cycles";
import {
  createDriverDiagram,
  deleteDriverDiagram,
  createDriverNode,
  updateDriverNode,
  deleteDriverNode,
} from "@/actions/driver-diagrams";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  createActionItem,
  updateActionItem,
  deleteActionItem,
  toggleActionItemStatus,
} from "@/actions/action-items";
import {
  createCampaignEvent,
  updateCampaignEvent,
  deleteCampaignEvent,
} from "@/actions/campaign-events";
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
  DRIVER_NODE_TYPE_LABELS,
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
  changeIdeaNodeId: string | null;
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
  description?: string | null;
  type: "action" | "pdsa" | "campaign" | "milestone" | "barrier" | "event";
}

interface CampaignEventRow {
  id: string;
  date: string;
  label: string;
  description: string | null;
  category: string;
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
  metricDefinitions: { id: string; name: string }[];
  campaignEvents: CampaignEventRow[];
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
  milestone: "\u{1F3C1}",
  barrier: "\u{1F6A7}",
  event: "\u{1F4CC}",
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  milestone: "Milestone",
  barrier: "Barrier",
  event: "Event",
};

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  milestone: NMH_COLORS.teal,
  barrier: NMH_COLORS.orange,
  event: NMH_COLORS.gray,
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

const CHILD_TYPE: Record<string, string | null> = {
  aim: "primary",
  primary: "secondary",
  secondary: "changeIdea",
  changeIdea: null,
};

/** Build a flat display-order list with depth from the node tree */
function buildDisplayOrder(nodes: DiagramNodeInfo[]): (DiagramNodeInfo & { depth: number })[] {
  const childrenMap = new Map<string | null, DiagramNodeInfo[]>();
  for (const node of nodes) {
    const parentKey = node.parentId ?? null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey)!.push(node);
  }

  const result: (DiagramNodeInfo & { depth: number })[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      result.push({ ...child, depth });
      walk(child.id, depth + 1);
    }
  }
  walk(null, 0);
  return result;
}

// ---------------------------------------------------------------------------
// Cascading Diagram Builder — wizard-style tree with inline PDSA cycles
// ---------------------------------------------------------------------------

function CascadingDiagramBuilder({
  diagram,
  editMode,
  expandedCycleIds,
  onAccordionChange,
  onAddNode,
  onEditNode,
  onDeleteNode,
  onCreateCycleFromNode,
  onFieldSave,
  onStartNextCycle,
  cloningCycleId,
  onDeleteCycle,
  onAdvanceCycle,
  isCollapsed,
  onToggleCollapse,
}: {
  diagram: DiagramInfo;
  editMode: boolean;
  expandedCycleIds: string[];
  onAccordionChange: (groupIds: string[], newExpanded: string[]) => void;
  onAddNode: (diagramId: string, parentId: string | null, type: string) => void;
  onEditNode: (node: DiagramNodeInfo) => void;
  onDeleteNode: (nodeId: string, text: string) => void;
  onCreateCycleFromNode: (diagramId: string, nodeId: string, text: string) => void;
  onFieldSave: (cycleId: string, field: string, value: string | null) => void;
  onStartNextCycle: (cycleId: string) => void;
  cloningCycleId: string | null;
  onDeleteCycle: (id: string, title: string) => void;
  onAdvanceCycle: (cycleId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const displayNodes = buildDisplayOrder(diagram.nodes);

  // Build a map of changeIdeaNodeId -> cycles for this diagram
  const cyclesByChangeIdea = new Map<string, CycleInfo[]>();
  const ungroupedCycles: CycleInfo[] = [];
  for (const cycle of diagram.cycles) {
    if (cycle.changeIdeaNodeId) {
      if (!cyclesByChangeIdea.has(cycle.changeIdeaNodeId)) {
        cyclesByChangeIdea.set(cycle.changeIdeaNodeId, []);
      }
      cyclesByChangeIdea.get(cycle.changeIdeaNodeId)!.push(cycle);
    } else {
      ungroupedCycles.push(cycle);
    }
  }

  const primaryCount = diagram.nodes.filter((n) => n.type === "primary").length;
  const changeIdeaCount = diagram.nodes.filter((n) => n.type === "changeIdea").length;
  const hasPrimary = primaryCount > 0;
  const hasChangeIdea = changeIdeaCount > 0;

  return (
    <div className="space-y-3">
      {/* Collapsible header */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center gap-2 w-full text-left"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${!isCollapsed ? "rotate-90" : ""}`}
        />
        <span className="font-semibold text-nmh-gray">{diagram.name}</span>
        {diagram.metricName && (
          <Badge
            variant="outline"
            className="text-xs bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20"
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            {diagram.metricName}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {diagram.nodes.length} nodes &middot; {diagram.cycles.length} cycles
        </span>
      </button>

      {!isCollapsed && (
        <div className="space-y-3 pl-2">
          {diagram.description && (
            <p className="text-sm text-muted-foreground">{diagram.description}</p>
          )}

          {editMode && (
            <p className="text-sm text-muted-foreground">
              Build your improvement tree: start with an Aim, then add Primary Drivers, Secondary
              Drivers, and Change Ideas. Test each Change Idea with a PDSA Cycle.
            </p>
          )}

          {/* Aim node prompt */}
          {editMode && !diagram.nodes.some((n) => n.type === "aim") && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-dashed"
              style={{
                borderColor: `${DRIVER_NODE_TYPE_COLORS.aim}60`,
                color: DRIVER_NODE_TYPE_COLORS.aim,
              }}
              onClick={() => onAddNode(diagram.id, null, "aim")}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Aim Statement
            </Button>
          )}

          {/* Node tree */}
          {displayNodes.length > 0 && (
            <div className="space-y-0.5 border rounded-lg p-4 bg-muted/20">
              {displayNodes.map((node) => {
                const childType = CHILD_TYPE[node.type];
                const color = DRIVER_NODE_TYPE_COLORS[node.type] ?? "#6b7280";
                const label = DRIVER_NODE_TYPE_LABELS[node.type] ?? node.type;
                const childLabel = childType
                  ? (DRIVER_NODE_TYPE_LABELS[childType] ?? childType)
                  : "";
                const childColor = childType
                  ? (DRIVER_NODE_TYPE_COLORS[childType] ?? "#6b7280")
                  : "";

                // PDSA cycles for this node (if it's a change idea)
                const nodeCycles =
                  node.type === "changeIdea"
                    ? cyclesByChangeIdea.get(node.id) ?? []
                    : [];
                const nodeCycleIds = nodeCycles.map((c) => c.id);
                const nodeExpandedIds = expandedCycleIds.filter((id) =>
                  nodeCycleIds.includes(id)
                );

                return (
                  <div key={node.id}>
                    {/* Node row */}
                    <div
                      className="flex items-center gap-2 py-1.5"
                      style={{ paddingLeft: `${node.depth * 32 + 8}px` }}
                    >
                      <Badge
                        variant="outline"
                        className="text-xs shrink-0"
                        style={{ borderColor: color, color }}
                      >
                        {label}
                      </Badge>
                      <span className="text-sm font-medium flex-1 truncate">
                        {node.text}
                      </span>
                      {editMode && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => onEditNode(node)}
                            className="p-1 rounded hover:bg-muted"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => onDeleteNode(node.id, node.text)}
                            className="p-1 rounded hover:bg-muted text-destructive/60 hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </div>

                    {/* PDSA cycles nested under change ideas */}
                    {node.type === "changeIdea" && nodeCycles.length > 0 && (
                      <div
                        style={{ paddingLeft: `${(node.depth + 1) * 32 + 8}px` }}
                        className="py-1"
                      >
                        <Accordion
                          type="multiple"
                          value={nodeExpandedIds}
                          onValueChange={(val: string[]) =>
                            onAccordionChange(nodeCycleIds, val)
                          }
                          className="space-y-1"
                        >
                          {nodeCycles.map((cycle) => (
                            <AccordionItem
                              key={cycle.id}
                              value={cycle.id}
                              className="border rounded-md px-3 bg-card"
                            >
                              <AccordionTrigger className="py-2 hover:no-underline">
                                <PdsaCycleCompactHeader cycle={cycle} />
                              </AccordionTrigger>
                              <AccordionContent>
                                <PdsaCycleExpandedContent
                                  cycle={cycle}
                                  editing={editMode}
                                  onFieldSave={onFieldSave}
                                  onStartNextCycle={onStartNextCycle}
                                  isCloning={cloningCycleId === cycle.id}
                                  onDelete={(id, title) => onDeleteCycle(id, title)}
                                  onAdvance={onAdvanceCycle}
                                />
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}

                    {/* Create PDSA button for change ideas */}
                    {editMode && node.type === "changeIdea" && (
                      <div
                        style={{ paddingLeft: `${(node.depth + 1) * 32 + 8}px` }}
                        className="py-0.5"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-dashed h-7"
                          style={{
                            borderColor: `${NMH_COLORS.orange}60`,
                            color: NMH_COLORS.orange,
                          }}
                          onClick={() =>
                            onCreateCycleFromNode(diagram.id, node.id, node.text)
                          }
                        >
                          <RefreshCcw className="h-3 w-3 mr-1" />
                          Add PDSA Cycle
                        </Button>
                      </div>
                    )}

                    {/* "Add child" button below the node */}
                    {editMode && childType && (
                      <div
                        style={{ paddingLeft: `${(node.depth + 1) * 32 + 8}px` }}
                        className="py-0.5"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-dashed h-7"
                          style={{
                            borderColor: `${childColor}60`,
                            color: childColor,
                          }}
                          onClick={() => onAddNode(diagram.id, node.id, childType)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add {childLabel}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Ungrouped cycles (not linked to any change idea) */}
          {ungroupedCycles.length > 0 && (
            <div className="space-y-1 pl-2">
              <p className="text-xs font-medium text-muted-foreground">
                Unlinked PDSA Cycles
              </p>
              <Accordion
                type="multiple"
                value={expandedCycleIds.filter((id) =>
                  ungroupedCycles.some((c) => c.id === id)
                )}
                onValueChange={(val: string[]) =>
                  onAccordionChange(
                    ungroupedCycles.map((c) => c.id),
                    val
                  )
                }
                className="space-y-1"
              >
                {ungroupedCycles.map((cycle) => (
                  <AccordionItem
                    key={cycle.id}
                    value={cycle.id}
                    className="border rounded-md px-3"
                  >
                    <AccordionTrigger className="py-2 hover:no-underline">
                      <PdsaCycleCompactHeader cycle={cycle} />
                    </AccordionTrigger>
                    <AccordionContent>
                      <PdsaCycleExpandedContent
                        cycle={cycle}
                        editing={editMode}
                        onFieldSave={onFieldSave}
                        onStartNextCycle={onStartNextCycle}
                        isCloning={cloningCycleId === cycle.id}
                        onDelete={(id, title) => onDeleteCycle(id, title)}
                        onAdvance={onAdvanceCycle}
                      />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {/* Progress summary */}
          {diagram.nodes.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              <span className="text-muted-foreground">
                {diagram.nodes.length} nodes
              </span>
              <span className={hasPrimary ? "text-green-600" : "text-amber-600"}>
                {primaryCount} primary driver{primaryCount !== 1 ? "s" : ""}
                {!hasPrimary && " (need at least 1)"}
              </span>
              <span className={hasChangeIdea ? "text-green-600" : "text-amber-600"}>
                {changeIdeaCount} change idea{changeIdeaCount !== 1 ? "s" : ""}
                {!hasChangeIdea && " (need at least 1)"}
              </span>
              <span className="text-muted-foreground">
                {diagram.cycles.length} PDSA cycle
                {diagram.cycles.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
// Editable PDSA Cycle Summary (expanded content)
// ---------------------------------------------------------------------------

function PdsaCycleExpandedContent({
  cycle,
  editing,
  onFieldSave,
  onStartNextCycle,
  isCloning,
  onDelete,
  onAdvance,
}: {
  cycle: CycleInfo;
  editing: boolean;
  onFieldSave: (cycleId: string, field: string, value: string | null) => void;
  onStartNextCycle?: (cycleId: string) => void;
  isCloning?: boolean;
  onDelete?: (cycleId: string, title: string) => void;
  onAdvance?: (cycleId: string) => void;
}) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";
  const canStartNext = cycle.status === "acting" || cycle.status === "completed";
  const canAdvance = ["planning", "doing", "studying", "acting"].includes(cycle.status);

  return (
    <div className="text-sm space-y-3">
      {/* Status + outcome controls (in edit mode) */}
      {editing && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Status:</span>
          <EditableSelect
            value={cycle.status}
            options={PDSA_STATUS_LABELS}
            editing={editing}
            onSave={(val) => onFieldSave(cycle.id, "status", val)}
            renderValue={(val) => (
              <Badge
                variant="secondary"
                className="text-xs"
                style={{ backgroundColor: `${statusColor}15`, color: statusColor }}
              >
                {PDSA_STATUS_LABELS[val] ?? val}
              </Badge>
            )}
          />
          <span className="text-sm text-muted-foreground ml-2">Outcome:</span>
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
        </div>
      )}

      {cycle.changeIdea && (
        <p className="text-sm text-muted-foreground">Change Idea: {cycle.changeIdea}</p>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span
            className="font-medium inline-flex items-center gap-1"
            style={{ color: PDSA_STATUS_COLORS.planning }}
          >
            <ClipboardList className="h-3.5 w-3.5" />
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
          <span
            className="font-medium inline-flex items-center gap-1"
            style={{ color: PDSA_STATUS_COLORS.doing }}
          >
            <Play className="h-3.5 w-3.5" />
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
          <span
            className="font-medium inline-flex items-center gap-1"
            style={{ color: PDSA_STATUS_COLORS.studying }}
          >
            <Search className="h-3.5 w-3.5" />
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
          <span
            className="font-medium inline-flex items-center gap-1"
            style={{ color: PDSA_STATUS_COLORS.acting }}
          >
            <Zap className="h-3.5 w-3.5" />
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

      {/* Cycle action buttons */}
      {(canStartNext || (editing && (canAdvance || onDelete))) && (
        <div className="pt-2 border-t mt-2 flex items-center gap-2 flex-wrap">
          {editing && canAdvance && onAdvance && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => onAdvance(cycle.id)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Advance to{" "}
              {PDSA_STATUS_LABELS[
                (["planning", "doing", "studying", "acting", "completed"] as const)[
                  ["planning", "doing", "studying", "acting"].indexOf(cycle.status) + 1
                ]
              ] ?? "Next"}
            </Button>
          )}
          {canStartNext && onStartNextCycle && (
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-nmh-teal hover:bg-nmh-teal/90 text-white"
              onClick={() => onStartNextCycle(cycle.id)}
              disabled={isCloning}
            >
              {isCloning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CopyPlus className="h-3.5 w-3.5" />
                  Start Next Cycle
                </>
              )}
            </Button>
          )}
          {editing && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs text-destructive hover:text-destructive ml-auto"
              onClick={() => onDelete(cycle.id, cycle.title)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Cycle
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact header for collapsed PDSA cycle */
function PdsaCycleCompactHeader({ cycle }: { cycle: CycleInfo }) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";
  const StatusIcon = PDSA_STATUS_ICONS[cycle.status];
  const OutcomeIcon = cycle.outcome ? PDSA_OUTCOME_ICONS[cycle.outcome] : null;

  return (
    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
      <span className="font-semibold text-sm">{cycle.title}</span>
      <span className="text-sm text-muted-foreground">#{cycle.cycleNumber}</span>
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
  metricDefinitions,
  campaignEvents,
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

  // Create diagram state
  const [showCreateDiagram, setShowCreateDiagram] = useState(false);

  // Delete diagram state
  const [deleteDiagram, setDeleteDiagram] = useState<{ id: string; name: string } | null>(null);

  // Driver node dialog state
  const [nodeDialog, setNodeDialog] = useState<{
    mode: "create" | "edit";
    diagramId: string;
    parentId: string | null;
    type: string;
    nodeId?: string;
    text?: string;
    description?: string;
  } | null>(null);
  const [deleteNode, setDeleteNode] = useState<{ id: string; text: string } | null>(null);

  // PDSA cycle create/delete state
  const [createCycleInfo, setCreateCycleInfo] = useState<{
    diagramId: string;
    changeIdeaNodeId?: string;
    changeIdeaText?: string;
  } | null>(null);
  const [deleteCycle, setDeleteCycle] = useState<{ id: string; title: string } | null>(null);

  // Chart modes
  const [chartModes, setChartModes] = useState<Record<string, ChartMode>>({});
  const getChartMode = (metricId: string): ChartMode => chartModes[metricId] ?? "control";
  const setChartMode = (metricId: string, mode: ChartMode) =>
    setChartModes((prev) => ({ ...prev, [metricId]: mode }));

  // Collapsible PDSA cycle state — default to all collapsed
  const [expandedCycleIds, setExpandedCycleIds] = useState<string[]>([]);
  const [cloningCycleId, setCloningCycleId] = useState<string | null>(null);

  // Collapsed diagram state
  const [collapsedDiagramIds, setCollapsedDiagramIds] = useState<Set<string>>(new Set());
  const isDiagramCollapsed = (id: string) => collapsedDiagramIds.has(id);
  const toggleDiagramCollapse = (id: string) =>
    setCollapsedDiagramIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Campaign event state
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [editEvent, setEditEvent] = useState<CampaignEventRow | null>(null);
  const [deleteEventRow, setDeleteEventRow] = useState<CampaignEventRow | null>(null);

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

  function handleStartNextCycle(sourceCycleId: string) {
    setCloningCycleId(sourceCycleId);
    startTransition(async () => {
      const res = await clonePdsaCycle(sourceCycleId);
      setCloningCycleId(null);
      if (!res.success) {
        setError(res.error ?? "Failed to create next cycle");
      } else if (res.data) {
        // Auto-expand the newly created cycle
        setExpandedCycleIds((prev) => [...prev, res.data!.id]);
        flashSave("New cycle created");
      }
    });
  }

  /** Helper to update expandedCycleIds for a specific change idea group's accordion */
  function handleAccordionChange(groupCycleIds: string[], newExpandedIds: string[]) {
    setExpandedCycleIds((prev) => {
      const withoutGroup = prev.filter((id) => !groupCycleIds.includes(id));
      return [...withoutGroup, ...newExpandedIds];
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

  // --- Create diagram ---

  function handleCreateDiagram(fd: FormData) {
    fd.set("campaignId", campaign.id);
    fd.set("status", "active");
    startTransition(async () => {
      const res = await createDriverDiagram(fd);
      if (!res.success) setError(res.error ?? "Failed to create diagram");
      else {
        setShowCreateDiagram(false);
        flashSave("Diagram created");
      }
    });
  }

  // --- Delete diagram ---

  function handleDeleteDiagram() {
    if (!deleteDiagram) return;
    startTransition(async () => {
      const res = await deleteDriverDiagram(deleteDiagram.id);
      if (!res.success) setError(res.error ?? "Failed to delete diagram");
      else {
        setDeleteDiagram(null);
        flashSave("Diagram deleted");
      }
    });
  }

  // --- Driver node management ---

  function handleOpenAddNode(diagramId: string, parentId: string | null, type: string) {
    setNodeDialog({ mode: "create", diagramId, parentId, type });
  }

  function handleOpenEditNode(node: DiagramNodeInfo) {
    // Find which diagram this node belongs to
    const diagram = diagrams.find((d) => d.nodes.some((n) => n.id === node.id));
    if (!diagram) return;
    setNodeDialog({
      mode: "edit",
      diagramId: diagram.id,
      parentId: node.parentId,
      type: node.type,
      nodeId: node.id,
      text: node.text,
      description: node.description ?? undefined,
    });
  }

  function handleNodeDialogSubmit(fd: FormData) {
    if (!nodeDialog) return;
    if (nodeDialog.mode === "create") {
      fd.set("driverDiagramId", nodeDialog.diagramId);
      if (nodeDialog.parentId) fd.set("parentId", nodeDialog.parentId);
      fd.set("type", nodeDialog.type);
      startTransition(async () => {
        const res = await createDriverNode(fd);
        if (!res.success) setError(res.error ?? "Failed to create node");
        else {
          setNodeDialog(null);
          flashSave("Node created");
        }
      });
    } else if (nodeDialog.nodeId) {
      startTransition(async () => {
        const res = await updateDriverNode(nodeDialog.nodeId!, fd);
        if (!res.success) setError(res.error ?? "Failed to update node");
        else {
          setNodeDialog(null);
          flashSave("Node updated");
        }
      });
    }
  }

  function handleDeleteNode() {
    if (!deleteNode) return;
    startTransition(async () => {
      const res = await deleteDriverNode(deleteNode.id);
      if (!res.success) setError(res.error ?? "Failed to delete node");
      else {
        setDeleteNode(null);
        flashSave("Node deleted");
      }
    });
  }

  // --- PDSA cycle create/delete ---

  function handleOpenCreateCycleFromNode(diagramId: string, changeIdeaNodeId: string, changeIdeaText: string) {
    setCreateCycleInfo({ diagramId, changeIdeaNodeId, changeIdeaText });
  }

  function handleCreateCycle(fd: FormData) {
    if (!createCycleInfo) return;
    fd.set("driverDiagramId", createCycleInfo.diagramId);
    if (createCycleInfo.changeIdeaNodeId) {
      fd.set("changeIdeaNodeId", createCycleInfo.changeIdeaNodeId);
    }
    startTransition(async () => {
      const res = await createPdsaCycle(fd);
      if (!res.success) setError(res.error ?? "Failed to create PDSA cycle");
      else {
        setCreateCycleInfo(null);
        flashSave("PDSA cycle created");
      }
    });
  }

  function handleDeleteCycle() {
    if (!deleteCycle) return;
    startTransition(async () => {
      const res = await deletePdsaCycle(deleteCycle.id);
      if (!res.success) setError(res.error ?? "Failed to delete PDSA cycle");
      else {
        setDeleteCycle(null);
        flashSave("PDSA cycle deleted");
      }
    });
  }

  function handleAdvanceCycle(cycleId: string) {
    startTransition(async () => {
      const res = await advancePdsaCycle(cycleId);
      if (!res.success) setError(res.error ?? "Failed to advance cycle");
      else flashSave("Cycle advanced");
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

  // --- Campaign events ---

  function handleCreateEvent(fd: FormData) {
    fd.set("campaignId", campaign.id);
    startTransition(async () => {
      const res = await createCampaignEvent(fd);
      if (!res.success) setError(res.error ?? "Failed to create event");
      else {
        setShowCreateEvent(false);
        flashSave("Event created");
      }
    });
  }

  function handleEditEvent(fd: FormData) {
    if (!editEvent) return;
    fd.set("campaignId", campaign.id);
    startTransition(async () => {
      const res = await updateCampaignEvent(editEvent.id, fd);
      if (!res.success) setError(res.error ?? "Failed to update event");
      else {
        setEditEvent(null);
        flashSave("Event updated");
      }
    });
  }

  function handleDeleteEvent() {
    if (!deleteEventRow) return;
    startTransition(async () => {
      const res = await deleteCampaignEvent(deleteEventRow.id);
      if (!res.success) setError(res.error ?? "Failed to delete event");
      else {
        setDeleteEventRow(null);
        flashSave("Event deleted");
      }
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
      {/* DRIVER DIAGRAM & IMPROVEMENT PLAN (unified builder)               */}
      {/* ================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <GitBranchPlus className="h-5 w-5 text-nmh-teal" />
            Driver Diagram &amp; Improvement Plan
          </h2>
          {editMode && (
            <div className="flex items-center gap-2">
              {unassignedDiagrams.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowAddDiagram(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Link Existing
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowCreateDiagram(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Diagram
              </Button>
            </div>
          )}
        </div>

        {editMode && (
          <div className="rounded-lg border border-nmh-teal/20 bg-nmh-teal/5 p-4 text-sm space-y-2">
            <p className="font-medium text-nmh-gray">
              How to use this section
            </p>
            <div className="text-muted-foreground space-y-1">
              <p>
                <strong className="text-nmh-teal">1. Aim</strong> &mdash; What are you trying to
                accomplish? Write a clear, measurable aim statement.
              </p>
              <p>
                <strong style={{ color: DRIVER_NODE_TYPE_COLORS.primary }}>2. Primary Drivers</strong>{" "}
                &mdash; What are the key factors that drive your aim?
              </p>
              <p>
                <strong style={{ color: DRIVER_NODE_TYPE_COLORS.secondary }}>3. Secondary Drivers</strong>{" "}
                &mdash; What specific factors influence each primary driver?
              </p>
              <p>
                <strong style={{ color: DRIVER_NODE_TYPE_COLORS.changeIdea }}>4. Change Ideas</strong>{" "}
                &mdash; What specific, testable changes can you make?
              </p>
              <p>
                <strong style={{ color: NMH_COLORS.orange }}>5. PDSA Cycles</strong> &mdash; Test each
                change idea using Plan-Do-Study-Act cycles.
              </p>
            </div>
          </div>
        )}

        {diagrams.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed">
            <GitBranchPlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No driver diagrams linked to this campaign yet.
            </p>
            {editMode && (
              <p className="text-xs text-muted-foreground mt-1">
                Create a diagram to start building your improvement plan.
              </p>
            )}
          </div>
        ) : (
          diagrams.map((diagram) => (
            <div
              key={diagram.id}
              className="border rounded-lg p-5 space-y-3 break-inside-avoid"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <CascadingDiagramBuilder
                    diagram={diagram}
                    editMode={editMode}
                    expandedCycleIds={expandedCycleIds}
                    onAccordionChange={handleAccordionChange}
                    onAddNode={handleOpenAddNode}
                    onEditNode={handleOpenEditNode}
                    onDeleteNode={(id, text) => setDeleteNode({ id, text })}
                    onCreateCycleFromNode={handleOpenCreateCycleFromNode}
                    onFieldSave={savePdsaField}
                    onStartNextCycle={handleStartNextCycle}
                    cloningCycleId={cloningCycleId}
                    onDeleteCycle={(id, title) => setDeleteCycle({ id, title })}
                    onAdvanceCycle={handleAdvanceCycle}
                    isCollapsed={isDiagramCollapsed(diagram.id)}
                    onToggleCollapse={() => toggleDiagramCollapse(diagram.id)}
                  />
                </div>
                {editMode && (
                  <div className="flex items-center gap-0.5 shrink-0 self-start mt-1">
                    <Link
                      href={`/admin/driver-diagrams/${diagram.id}`}
                      className="p-1 rounded hover:bg-muted"
                      title="Open full diagram page"
                    >
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                    <button
                      onClick={() => handleRemoveDiagram(diagram.id)}
                      className="p-1 rounded hover:bg-muted"
                      title="Unlink from campaign"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteDiagram({ id: diagram.id, name: diagram.name })
                      }
                      className="p-1 rounded hover:bg-muted"
                      title="Delete diagram"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </section>

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
      {/* MILESTONES, BARRIERS, EVENTS                                     */}
      {/* ================================================================= */}
      <section className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nmh-gray flex items-center gap-2">
            <Flag className="h-5 w-5 text-nmh-teal" />
            Milestones, Barriers, Events
          </h2>
          {editMode && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setError(null);
                setShowCreateEvent(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Entry
            </Button>
          )}
        </div>
        {milestones.length === 0 && campaignEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No milestones, barriers, or events yet.
          </p>
        ) : (
          <div className="border rounded-lg divide-y">
            {milestones.map((m, i) => {
              const catColor = EVENT_CATEGORY_COLORS[m.type] ?? NMH_COLORS.gray;
              const isUserEntry = m.type === "milestone" || m.type === "barrier" || m.type === "event";
              const matchingEvent = isUserEntry
                ? campaignEvents.find((e) => e.label === m.label && e.date === m.date)
                : null;
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2 text-sm group"
                  title={m.description ?? undefined}
                >
                  <span className="text-base">{MILESTONE_ICONS[m.type] ?? "\u{1F4CC}"}</span>
                  <span className="text-muted-foreground w-[100px] shrink-0 text-xs">
                    {formatDate(m.date)}
                  </span>
                  <span className="font-medium flex-1">
                    {m.label}
                    {m.description && (
                      <span className="ml-1 text-xs text-muted-foreground italic hidden group-hover:inline">
                        — {m.description}
                      </span>
                    )}
                  </span>
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: `${catColor}20`, color: catColor }}
                    className="text-[10px] capitalize shrink-0"
                  >
                    {EVENT_CATEGORY_LABELS[m.type] ?? m.type}
                  </Badge>
                  {editMode && matchingEvent && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setEditEvent(matchingEvent)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        onClick={() => setDeleteEventRow(matchingEvent)}
                      >
                        <Trash2 className="h-3 w-3" />
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

      {/* Create Diagram Dialog */}
      <Dialog open={showCreateDiagram} onOpenChange={setShowCreateDiagram}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Driver Diagram</DialogTitle>
          </DialogHeader>
          <form action={handleCreateDiagram}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="diagram-name">Name *</Label>
                <Input
                  id="diagram-name"
                  name="name"
                  required
                  maxLength={150}
                  placeholder="e.g., etCO2 Compliance Driver Diagram"
                />
              </div>
              <div>
                <Label htmlFor="diagram-description">Description</Label>
                <Textarea
                  id="diagram-description"
                  name="description"
                  rows={3}
                  maxLength={500}
                  placeholder="Optional description..."
                />
              </div>
              <div>
                <Label htmlFor="diagram-metric">Associated Metric</Label>
                <Select name="metricDefinitionId" defaultValue="__none__">
                  <SelectTrigger id="diagram-metric">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {metricDefinitions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreateDiagram(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Diagram Confirmation */}
      <Dialog
        open={!!deleteDiagram}
        onOpenChange={(open) => { if (!open) setDeleteDiagram(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Driver Diagram</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteDiagram?.name}</strong>? This will also
            delete all nodes and unlink PDSA cycles.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDiagram(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteDiagram} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Node Dialog */}
      <Dialog
        open={!!nodeDialog}
        onOpenChange={(open) => { if (!open) setNodeDialog(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {nodeDialog?.mode === "edit" ? "Edit" : "Add"}{" "}
              {DRIVER_NODE_TYPE_LABELS[nodeDialog?.type ?? ""] ?? "Node"}
            </DialogTitle>
          </DialogHeader>
          {nodeDialog && (
            <form action={handleNodeDialogSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="node-text">Text *</Label>
                  <Input
                    id="node-text"
                    name="text"
                    required
                    maxLength={500}
                    defaultValue={nodeDialog.text ?? ""}
                    placeholder={
                      nodeDialog.type === "aim"
                        ? "e.g., Achieve 98% etCO2 compliance"
                        : nodeDialog.type === "changeIdea"
                          ? "e.g., Add pre-transport checklist reminder"
                          : "Enter text..."
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="node-description">Description</Label>
                  <Textarea
                    id="node-description"
                    name="description"
                    rows={3}
                    maxLength={1000}
                    defaultValue={nodeDialog.description ?? ""}
                    placeholder="Optional description..."
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setNodeDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? nodeDialog.mode === "edit"
                      ? "Saving..."
                      : "Creating..."
                    : nodeDialog.mode === "edit"
                      ? "Save"
                      : "Create"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Node Confirmation */}
      <Dialog
        open={!!deleteNode}
        onOpenChange={(open) => { if (!open) setDeleteNode(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Node</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteNode?.text}</strong> and all its
            descendants?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNode(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteNode} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create PDSA Cycle Dialog */}
      <Dialog
        open={!!createCycleInfo}
        onOpenChange={(open) => { if (!open) setCreateCycleInfo(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create PDSA Cycle</DialogTitle>
          </DialogHeader>
          {createCycleInfo && (
            <form action={handleCreateCycle}>
              <div className="space-y-4">
                {createCycleInfo.changeIdeaText && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Change Idea:</span>{" "}
                    <span className="font-medium">{createCycleInfo.changeIdeaText}</span>
                  </div>
                )}
                <div>
                  <Label htmlFor="cycle-title">Title *</Label>
                  <Input
                    id="cycle-title"
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={createCycleInfo.changeIdeaText ?? ""}
                    placeholder="e.g., Test checklist reminder intervention"
                  />
                </div>
                <div>
                  <Label htmlFor="cycle-plan">Plan Description</Label>
                  <Textarea
                    id="cycle-plan"
                    name="planDescription"
                    rows={3}
                    maxLength={2000}
                    placeholder="What are we trying to accomplish? What changes can we make that will result in improvement?"
                  />
                </div>
                <div>
                  <Label htmlFor="cycle-prediction">Prediction</Label>
                  <Textarea
                    id="cycle-prediction"
                    name="planPrediction"
                    rows={2}
                    maxLength={2000}
                    placeholder="What do we predict will happen?"
                  />
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setCreateCycleInfo(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete PDSA Cycle Confirmation */}
      <Dialog
        open={!!deleteCycle}
        onOpenChange={(open) => { if (!open) setDeleteCycle(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PDSA Cycle</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteCycle?.title}</strong>? This will also
            remove any linked action items.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCycle(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteCycle} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Campaign Event Dialog */}
      <Dialog
        open={showCreateEvent || !!editEvent}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateEvent(false);
            setEditEvent(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editEvent ? "Edit Entry" : "Add Entry"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              if (editEvent) handleEditEvent(fd);
              else handleCreateEvent(fd);
            }}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  name="date"
                  type="date"
                  required
                  defaultValue={editEvent?.date ?? ""}
                />
              </div>
              <div>
                <Label htmlFor="event-label">Label</Label>
                <Input
                  id="event-label"
                  name="label"
                  required
                  maxLength={200}
                  defaultValue={editEvent?.label ?? ""}
                  placeholder="e.g., Grant funding approved"
                />
              </div>
              <div>
                <Label htmlFor="event-description">Description (shown on hover)</Label>
                <Textarea
                  id="event-description"
                  name="description"
                  rows={2}
                  maxLength={1000}
                  defaultValue={editEvent?.description ?? ""}
                  placeholder="Optional details about this entry"
                />
              </div>
              <div>
                <Label htmlFor="event-category">Category</Label>
                <Select name="category" defaultValue={editEvent?.category ?? "milestone"}>
                  <SelectTrigger id="event-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="milestone">🏁 Milestone — Key achievement or target date</SelectItem>
                    <SelectItem value="barrier">🚧 Barrier — Something that blocked or slowed progress</SelectItem>
                    <SelectItem value="event">📌 Event — Notable occurrence that affected the campaign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateEvent(false);
                  setEditEvent(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : editEvent ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Campaign Event Confirmation */}
      <Dialog
        open={!!deleteEventRow}
        onOpenChange={(open) => { if (!open) setDeleteEventRow(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteEventRow?.label}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEventRow(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteEvent} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
