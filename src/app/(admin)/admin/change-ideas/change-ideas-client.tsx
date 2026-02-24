"use client";

import React, { useState, useTransition, useMemo, useCallback } from "react";
import { createPdsaCycle, updatePdsaCycleField, clonePdsaCycle } from "@/actions/pdsa-cycles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Lightbulb,
  BarChart3,
  Building2,
  GitBranchPlus,
  Target,
  Plus,
  RefreshCcw,
  CopyPlus,
  Loader2,
  Search,
} from "lucide-react";
import { PDSA_STATUS_LABELS, PDSA_STATUS_COLORS, PDSA_OUTCOME_LABELS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PdsaCycleInfo {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
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
  updatedAt: string;
}

interface ChangeIdeaData {
  id: string;
  text: string;
  description: string | null;
  driverDiagramId: string;
  driverDiagramName: string;
  metricName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  divisionNames: string[];
  departmentNames: string[];
  pdsaCycles: PdsaCycleInfo[];
}

interface LookupItem {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Inline editable components (mirrors campaign report pattern)
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
    return (
      <span>
        {value
          ? new Date(value + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "\u2014"}
      </span>
    );
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
// PDSA Cycle sub-components
// ---------------------------------------------------------------------------

function PdsaCycleCompactHeader({ cycle }: { cycle: PdsaCycleInfo }) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";

  return (
    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
      <span className="font-semibold text-sm">{cycle.title}</span>
      <span className="text-xs text-muted-foreground">#{cycle.cycleNumber}</span>
      <Badge
        variant="secondary"
        className="text-[10px]"
        style={{
          backgroundColor: `${statusColor}15`,
          color: statusColor,
        }}
      >
        {PDSA_STATUS_LABELS[cycle.status] ?? cycle.status}
      </Badge>
      {cycle.outcome && (
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
      )}
    </div>
  );
}

function PdsaCycleExpandedContent({
  cycle,
  editing,
  onFieldSave,
  onStartNextCycle,
  isCloning,
}: {
  cycle: PdsaCycleInfo;
  editing: boolean;
  onFieldSave: (cycleId: string, field: string, value: string | null) => void;
  onStartNextCycle?: (cycleId: string) => void;
  isCloning?: boolean;
}) {
  const statusColor = PDSA_STATUS_COLORS[cycle.status] ?? "#4b4f54";
  const canStartNext = cycle.status === "acting" || cycle.status === "completed";

  return (
    <div className="text-sm space-y-2">
      {/* Status + outcome controls (in edit mode) */}
      {editing && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Status:</span>
          <EditableSelect
            value={cycle.status}
            options={PDSA_STATUS_LABELS}
            editing={editing}
            onSave={(val) => onFieldSave(cycle.id, "status", val)}
            renderValue={(val) => (
              <Badge
                variant="secondary"
                className="text-[10px]"
                style={{
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                }}
              >
                {PDSA_STATUS_LABELS[val] ?? val}
              </Badge>
            )}
          />
          <span className="text-xs text-muted-foreground ml-2">Outcome:</span>
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

      {/* Start Next Cycle button */}
      {canStartNext && onStartNextCycle && (
        <div className="pt-2 border-t mt-2">
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChangeIdeasClient({
  changeIdeas,
  diagrams,
  metrics,
}: {
  changeIdeas: ChangeIdeaData[];
  diagrams: LookupItem[];
  metrics: LookupItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Filter state
  const [filterDiagram, setFilterDiagram] = useState<string>("__all__");
  const [searchQuery, setSearchQuery] = useState("");

  // Create cycle dialog state
  const [addCycleTarget, setAddCycleTarget] = useState<ChangeIdeaData | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Collapsible PDSA cycle state — all collapsed by default
  const [expandedCycleIds, setExpandedCycleIds] = useState<string[]>([]);
  const [cloningCycleId, setCloningCycleId] = useState<string | null>(null);

  // --- Filtering ---
  const filteredChangeIdeas = useMemo(() => {
    return changeIdeas.filter((ci) => {
      if (filterDiagram !== "__all__" && ci.driverDiagramId !== filterDiagram) {
        return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesText = ci.text.toLowerCase().includes(q);
        const matchesMetric = ci.metricName?.toLowerCase().includes(q);
        const matchesCampaign = ci.campaignName?.toLowerCase().includes(q);
        const matchesDivision = ci.divisionNames.some((d) => d.toLowerCase().includes(q));
        const matchesDept = ci.departmentNames.some((d) => d.toLowerCase().includes(q));
        if (
          !matchesText &&
          !matchesMetric &&
          !matchesCampaign &&
          !matchesDivision &&
          !matchesDept
        ) {
          return false;
        }
      }
      return true;
    });
  }, [changeIdeas, filterDiagram, searchQuery]);

  // Group by driver diagram
  const groupedByDiagram = useMemo(() => {
    const groups = new Map<string, { diagramName: string; items: ChangeIdeaData[] }>();
    for (const ci of filteredChangeIdeas) {
      if (!groups.has(ci.driverDiagramId)) {
        groups.set(ci.driverDiagramId, {
          diagramName: ci.driverDiagramName,
          items: [],
        });
      }
      groups.get(ci.driverDiagramId)!.items.push(ci);
    }
    return groups;
  }, [filteredChangeIdeas]);

  // Stats
  const totalChangeIdeas = filteredChangeIdeas.length;
  const totalCycles = filteredChangeIdeas.reduce((sum, ci) => sum + ci.pdsaCycles.length, 0);
  const ideasWithCycles = filteredChangeIdeas.filter((ci) => ci.pdsaCycles.length > 0).length;

  // --- Save helpers ---

  function flashSave(msg?: string) {
    setSaveNotice(msg ?? "Saved");
    setTimeout(() => setSaveNotice(null), 1500);
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
        setExpandedCycleIds((prev) => [...prev, res.data!.id]);
        flashSave("New cycle created");
      }
    });
  }

  function handleAccordionChange(groupCycleIds: string[], newExpandedIds: string[]) {
    setExpandedCycleIds((prev) => {
      const withoutGroup = prev.filter((id) => !groupCycleIds.includes(id));
      return [...withoutGroup, ...newExpandedIds];
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-nmh-teal" />
            Change Ideas
          </h1>
          <p className="text-muted-foreground mt-1">
            All change ideas across driver diagrams, with their PDSA cycle iterations.
          </p>
        </div>
        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          onClick={() => setEditMode(!editMode)}
          className="gap-1.5 shrink-0 self-start sm:self-auto"
        >
          {editMode ? "Exit Edit Mode" : "Edit Mode"}
        </Button>
      </div>

      {/* Notices */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-3 text-sm text-destructive flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {saveNotice && <div className="text-xs text-green-600 animate-in fade-in">{saveNotice}</div>}

      {editMode && (
        <div className="rounded-lg border border-nmh-teal/30 bg-nmh-teal/5 p-3 text-sm text-nmh-teal flex items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0" />
          <span>
            <strong>Edit Mode is active.</strong> Expand a PDSA cycle to edit its fields inline.
            Changes save automatically.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-nmh-teal">{totalChangeIdeas}</div>
          <p className="text-xs text-muted-foreground mt-0.5">Change Ideas</p>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-nmh-orange">{totalCycles}</div>
          <p className="text-xs text-muted-foreground mt-0.5">PDSA Cycles</p>
        </div>
        <div className="border rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-nmh-gray">{ideasWithCycles}</div>
          <p className="text-xs text-muted-foreground mt-0.5">Ideas Being Tested</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search change ideas, metrics, divisions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={filterDiagram} onValueChange={setFilterDiagram}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Diagrams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Diagrams</SelectItem>
            {diagrams.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterDiagram !== "__all__" || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterDiagram("__all__");
              setSearchQuery("");
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Change Ideas grouped by Driver Diagram */}
      {groupedByDiagram.size === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No change ideas found.</p>
          <p className="text-xs mt-1">Change ideas are created from driver diagrams.</p>
        </div>
      ) : (
        Array.from(groupedByDiagram.entries()).map(([diagramId, { diagramName, items }]) => (
          <section key={diagramId} className="space-y-3">
            {/* Diagram header */}
            <div className="flex items-center gap-2">
              <GitBranchPlus className="h-4 w-4 text-nmh-teal" />
              <h2 className="text-sm font-semibold text-nmh-gray">{diagramName}</h2>
              <span className="text-xs text-muted-foreground">
                ({items.length} change idea{items.length !== 1 ? "s" : ""})
              </span>
            </div>

            {/* Change idea cards */}
            <div className="space-y-3">
              {items.map((ci) => {
                const cycleIds = ci.pdsaCycles.map((c) => c.id);
                const expandedIds = expandedCycleIds.filter((id) => cycleIds.includes(id));

                return (
                  <div key={ci.id} className="border rounded-lg p-4 space-y-3">
                    {/* Change idea header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Lightbulb className="h-4 w-4 text-nmh-orange shrink-0" />
                          <span className="font-semibold text-sm text-nmh-gray">{ci.text}</span>
                        </div>
                        {ci.description && (
                          <p className="text-xs text-muted-foreground pl-6">{ci.description}</p>
                        )}

                        {/* Tags */}
                        <div className="flex items-center gap-1.5 flex-wrap pl-6">
                          {ci.metricName && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-nmh-teal/5 text-nmh-teal border-nmh-teal/20 gap-1"
                            >
                              <BarChart3 className="h-2.5 w-2.5" />
                              {ci.metricName}
                            </Badge>
                          )}
                          {ci.campaignName && (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-nmh-orange/5 text-nmh-orange border-nmh-orange/20 gap-1"
                            >
                              <Target className="h-2.5 w-2.5" />
                              {ci.campaignName}
                            </Badge>
                          )}
                          {ci.divisionNames.map((name) => (
                            <Badge
                              key={name}
                              variant="outline"
                              className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 gap-1"
                            >
                              <Building2 className="h-2.5 w-2.5" />
                              {name}
                            </Badge>
                          ))}
                          {ci.departmentNames.map((name) => (
                            <Badge
                              key={name}
                              variant="outline"
                              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1"
                            >
                              <Building2 className="h-2.5 w-2.5" />
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Add cycle button */}
                      {editMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-xs gap-1"
                          onClick={() => {
                            setFormError(null);
                            setAddCycleTarget(ci);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Cycle
                        </Button>
                      )}
                    </div>

                    {/* Cycle progression chain */}
                    {ci.pdsaCycles.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap text-xs pl-6">
                        {ci.pdsaCycles.map((c, idx) => (
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

                    {/* Collapsible PDSA cycles */}
                    {ci.pdsaCycles.length > 0 ? (
                      <Accordion
                        type="multiple"
                        value={expandedIds}
                        onValueChange={(val: string[]) => handleAccordionChange(cycleIds, val)}
                        className="space-y-1"
                      >
                        {ci.pdsaCycles.map((cycle) => (
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
                                onFieldSave={savePdsaField}
                                onStartNextCycle={handleStartNextCycle}
                                isCloning={cloningCycleId === cycle.id}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pl-6">
                        No PDSA cycles yet.
                        {editMode && " Use the Add Cycle button to start testing this idea."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {/* Add PDSA Cycle Dialog */}
      <Dialog
        open={addCycleTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddCycleTarget(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add PDSA Cycle</DialogTitle>
            <DialogDescription>
              Create a new PDSA cycle for &quot;{addCycleTarget?.text}&quot;
            </DialogDescription>
          </DialogHeader>
          {addCycleTarget && (
            <form
              action={async (formData) => {
                setFormError(null);
                // Pre-populate the change idea and diagram association
                formData.set("changeIdeaNodeId", addCycleTarget.id);
                formData.set("driverDiagramId", addCycleTarget.driverDiagramId);
                const result = await createPdsaCycle(formData);
                if (result.success) {
                  setAddCycleTarget(null);
                } else {
                  setFormError(result.error || "Failed to create cycle.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="e.g., Test new protocol implementation"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="metricDefinitionId">Metric</Label>
                  <Select name="metricDefinitionId" defaultValue="__none__">
                    <SelectTrigger>
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planDescription">Plan Description</Label>
                  <Textarea
                    id="planDescription"
                    name="planDescription"
                    placeholder="What are you trying to accomplish?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="planPrediction">Prediction</Label>
                  <Textarea
                    id="planPrediction"
                    name="planPrediction"
                    placeholder="What do you predict will happen?"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAddCycleTarget(null);
                    setFormError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-nmh-teal hover:bg-nmh-teal/90"
                  disabled={isPending}
                >
                  {isPending ? "Creating..." : "Create Cycle"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
