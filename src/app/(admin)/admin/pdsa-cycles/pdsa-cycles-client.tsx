"use client";

import React, { useState, useTransition, useMemo } from "react";
import {
  createPdsaCycle,
  updatePdsaCycle,
  deletePdsaCycle,
  advancePdsaCycle,
  clonePdsaCycle,
} from "@/actions/pdsa-cycles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Plus,
  Pencil,
  Trash2,
  FastForward,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CycleRow {
  id: string;
  title: string;
  cycleNumber: number;
  status: string;
  outcome: string | null;
  driverDiagramId: string | null;
  driverDiagramName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  metricDefinitionId: string | null;
  metricName: string | null;
  changeIdeaNodeId: string | null;
  changeIdeaText: string | null;
  planDescription: string | null;
  planPrediction: string | null;
  planDataCollection: string | null;
  planStartDate: string | null;
  doObservations: string | null;
  doStartDate: string | null;
  doEndDate: string | null;
  studyResults: string | null;
  studyLearnings: string | null;
  studyDate: string | null;
  actDecision: string | null;
  actNextSteps: string | null;
  actDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LookupItem {
  id: string;
  name: string;
}

interface ChangeIdeaItem {
  id: string;
  text: string;
  driverDiagramId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const statusColors: Record<string, string> = {
  planning: "bg-[#00b0ad]/10 text-[#00b0ad]",
  doing: "bg-[#e04726]/10 text-[#e04726]",
  studying: "bg-[#fcb526]/10 text-[#fcb526]",
  acting: "bg-[#4b4f54]/10 text-[#4b4f54]",
  completed: "bg-[#00383d]/10 text-[#00383d]",
  abandoned: "bg-[#60151E]/10 text-[#60151E]",
};

const statusLabels: Record<string, string> = {
  planning: "Plan",
  doing: "Do",
  studying: "Study",
  acting: "Act",
  completed: "Completed",
  abandoned: "Abandoned",
};

const outcomeLabels: Record<string, string> = {
  adopt: "Adopt",
  adapt: "Adapt",
  abandon: "Abandon",
};

const outcomeColors: Record<string, string> = {
  adopt: "bg-green-100 text-green-800",
  adapt: "bg-amber-100 text-amber-800",
  abandon: "bg-red-100 text-red-800",
};

const KANBAN_STATUSES = [
  "planning",
  "doing",
  "studying",
  "acting",
  "completed",
  "abandoned",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdsaCyclesClient({
  cycles,
  diagrams,
  metrics,
  changeIdeas,
}: {
  cycles: CycleRow[];
  diagrams: LookupItem[];
  metrics: LookupItem[];
  changeIdeas: ChangeIdeaItem[];
}) {
  const [view, setView] = useState<string>("table");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CycleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CycleRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>("__all__");
  const [filterDiagram, setFilterDiagram] = useState<string>("__all__");

  // Form state for controlled selects
  const [formDiagramId, setFormDiagramId] = useState<string>("");

  // Filtered cycles
  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      if (filterStatus !== "__all__" && c.status !== filterStatus) return false;
      if (filterDiagram !== "__all__" && c.driverDiagramId !== filterDiagram) return false;
      return true;
    });
  }, [cycles, filterStatus, filterDiagram]);

  // Sibling cycles for iteration navigation (cycles sharing same changeIdea + diagram)
  const siblingCycles = useMemo(() => {
    if (!editTarget || !editTarget.changeIdeaNodeId) return [];
    return cycles
      .filter(
        (c) =>
          c.changeIdeaNodeId === editTarget.changeIdeaNodeId &&
          c.driverDiagramId === editTarget.driverDiagramId
      )
      .sort((a, b) => a.cycleNumber - b.cycleNumber);
  }, [editTarget, cycles]);

  // Group cycles by status for kanban
  const cyclesByStatus = useMemo(() => {
    const groups: Record<string, CycleRow[]> = {};
    for (const s of KANBAN_STATUSES) groups[s] = [];
    for (const c of filteredCycles) {
      if (groups[c.status]) {
        groups[c.status].push(c);
      }
    }
    return groups;
  }, [filteredCycles]);

  // Filtered change ideas based on selected diagram in form
  const filteredChangeIdeas = useMemo(() => {
    if (!formDiagramId) return changeIdeas;
    return changeIdeas.filter((ci) => ci.driverDiagramId === formDiagramId);
  }, [changeIdeas, formDiagramId]);

  // --- Form open/close ---
  function openAdd() {
    setFormDiagramId("");
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(cycle: CycleRow) {
    setFormDiagramId(cycle.driverDiagramId ?? "");
    setFormError(null);
    setEditTarget(cycle);
  }

  function handleAdvance(cycle: CycleRow) {
    startTransition(async () => {
      const result = await advancePdsaCycle(cycle.id);
      if (!result.success) {
        setFormError(result.error || "Failed to advance cycle.");
      }
    });
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">PDSA Cycles</h1>
          <p className="text-muted-foreground mt-1">Manage Plan-Do-Study-Act improvement cycles.</p>
        </div>
        <Button
          className="bg-nmh-teal hover:bg-nmh-teal/90 shrink-0 self-start sm:self-auto"
          onClick={openAdd}
        >
          <Plus className="h-4 w-4" />
          Add Cycle
        </Button>
      </div>

      {/* View Toggle and Filters */}
      <Tabs value={view} onValueChange={setView}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {KANBAN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterDiagram} onValueChange={setFilterDiagram}>
              <SelectTrigger className="w-[200px]">
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

            {(filterStatus !== "__all__" || filterDiagram !== "__all__") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus("__all__");
                  setFilterDiagram("__all__");
                }}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Table View */}
        <TabsContent value="table" className="mt-4">
          <div className="bg-card rounded-lg border">
            {filteredCycles.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                No PDSA cycles found. Create one to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-center">Cycle #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Driver Diagram</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCycles.map((cycle) => (
                    <TableRow key={cycle.id}>
                      <TableCell className="font-medium">{cycle.title}</TableCell>
                      <TableCell className="text-center">
                        {cycle.cycleNumber}
                        {cycle.changeIdeaNodeId &&
                          cycles.some(
                            (c) =>
                              c.changeIdeaNodeId === cycle.changeIdeaNodeId &&
                              c.driverDiagramId === cycle.driverDiagramId &&
                              c.id !== cycle.id
                          ) && (
                            <Badge variant="outline" className="ml-1 text-xs px-1.5 py-0">
                              series
                            </Badge>
                          )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={statusColors[cycle.status] ?? "bg-muted text-muted-foreground"}
                        >
                          {statusLabels[cycle.status] ?? cycle.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cycle.outcome ? (
                          <Badge
                            className={
                              outcomeColors[cycle.outcome] ?? "bg-muted text-muted-foreground"
                            }
                          >
                            {outcomeLabels[cycle.outcome] ?? cycle.outcome}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cycle.campaignName ? (
                          <span className="text-sm">{cycle.campaignName}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cycle.driverDiagramName ?? (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {cycle.metricName ?? (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cycle.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cycle.status !== "completed" && cycle.status !== "abandoned" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Advance to next phase"
                              disabled={isPending}
                              onClick={() => handleAdvance(cycle)}
                            >
                              <FastForward className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openEdit(cycle)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(cycle)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* Kanban Board View */}
        <TabsContent value="board" className="mt-4">
          <div className="grid grid-cols-6 gap-3">
            {KANBAN_STATUSES.map((status) => (
              <div key={status} className="space-y-2">
                {/* Column Header */}
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {statusLabels[status]}
                  </h3>
                  <Badge variant="outline" className="text-xs">
                    {cyclesByStatus[status].length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[200px] rounded-lg border border-dashed border-muted-foreground/20 p-2 bg-muted/30">
                  {cyclesByStatus[status].length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No cycles</p>
                  ) : (
                    cyclesByStatus[status].map((cycle) => (
                      <Card
                        key={cycle.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openEdit(cycle)}
                      >
                        <CardHeader className="p-3 pb-1">
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-sm font-medium leading-tight line-clamp-2">
                              {cycle.title}
                            </p>
                            <span className="text-sm text-muted-foreground shrink-0">
                              #{cycle.cycleNumber}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 space-y-1.5">
                          {cycle.driverDiagramName && (
                            <p className="text-sm text-muted-foreground truncate">
                              {cycle.driverDiagramName}
                            </p>
                          )}
                          {cycle.outcome && (
                            <Badge
                              className={`text-xs ${
                                outcomeColors[cycle.outcome] ?? "bg-muted text-muted-foreground"
                              }`}
                            >
                              {outcomeLabels[cycle.outcome] ?? cycle.outcome}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add PDSA Cycle</DialogTitle>
            <DialogDescription>Create a new Plan-Do-Study-Act cycle.</DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              setFormError(null);
              const result = await createPdsaCycle(formData);
              if (result.success) {
                setAddOpen(false);
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
            <CycleFormFields
              diagrams={diagrams}
              metrics={metrics}
              changeIdeas={filteredChangeIdeas}
              formDiagramId={formDiagramId}
              onDiagramChange={setFormDiagramId}
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddOpen(false);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                Create Cycle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit PDSA Cycle</DialogTitle>
            <DialogDescription>Update the cycle details.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div>
              {/* Iteration navigation */}
              {siblingCycles.length > 1 && (
                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={editTarget.cycleNumber <= siblingCycles[0].cycleNumber}
                    onClick={() => {
                      const prev = siblingCycles.find(
                        (c) => c.cycleNumber === editTarget.cycleNumber - 1
                      );
                      if (prev) {
                        setFormError(null);
                        setEditTarget(prev);
                      }
                    }}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Prev
                  </Button>
                  <span className="text-sm font-medium">
                    Cycle {editTarget.cycleNumber} of{" "}
                    {siblingCycles[siblingCycles.length - 1].cycleNumber}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      editTarget.cycleNumber >= siblingCycles[siblingCycles.length - 1].cycleNumber
                    }
                    onClick={() => {
                      const next = siblingCycles.find(
                        (c) => c.cycleNumber === editTarget.cycleNumber + 1
                      );
                      if (next) {
                        setFormError(null);
                        setEditTarget(next);
                      }
                    }}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Start Next Cycle button for completed/acting cycles */}
              {(editTarget.status === "completed" || editTarget.status === "acting") &&
                editTarget.changeIdeaNodeId && (
                  <div className="flex justify-end mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        startTransition(async () => {
                          const result = await clonePdsaCycle(editTarget.id);
                          if (result.success) {
                            setEditTarget(null);
                          } else {
                            setFormError(result.error ?? "Failed to create next iteration.");
                          }
                        });
                      }}
                      disabled={isPending}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Start Next Cycle
                    </Button>
                  </div>
                )}

              <form
                key={editTarget.id}
                action={async (formData) => {
                  setFormError(null);
                  const result = await updatePdsaCycle(editTarget.id, formData);
                  if (result.success) {
                    setEditTarget(null);
                  } else {
                    setFormError(result.error || "Failed to update cycle.");
                  }
                }}
              >
                {formError && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                    <p className="text-sm text-destructive">{formError}</p>
                  </div>
                )}
                <CycleFormFields
                  diagrams={diagrams}
                  metrics={metrics}
                  changeIdeas={filteredChangeIdeas}
                  formDiagramId={formDiagramId}
                  onDiagramChange={setFormDiagramId}
                  defaultValues={editTarget}
                />
                <DialogFooter className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditTarget(null);
                      setFormError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90">
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PDSA Cycle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot; (Cycle #
              {deleteTarget?.cycleNumber})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deletePdsaCycle(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Cycle
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form Fields
// ---------------------------------------------------------------------------

function CycleFormFields({
  diagrams,
  metrics,
  changeIdeas,
  formDiagramId,
  onDiagramChange,
  defaultValues,
}: {
  diagrams: LookupItem[];
  metrics: LookupItem[];
  changeIdeas: ChangeIdeaItem[];
  formDiagramId: string;
  onDiagramChange: (id: string) => void;
  defaultValues?: CycleRow;
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Top Section: always visible */}
      <div className="grid grid-cols-2 gap-4">
        {/* Title */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={defaultValues?.title ?? ""}
            placeholder="e.g., Reduce dispatch-to-scene time"
            required
          />
        </div>

        {/* Cycle # */}
        <div className="space-y-2">
          <Label htmlFor="cycleNumber">Cycle #</Label>
          <Input
            id="cycleNumber"
            name="cycleNumber"
            type="number"
            min={1}
            defaultValue={defaultValues?.cycleNumber ?? 1}
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaultValues?.status ?? "planning"}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Outcome */}
        <div className="space-y-2">
          <Label htmlFor="outcome">Outcome</Label>
          <Select name="outcome" defaultValue={defaultValues?.outcome ?? "__none__"}>
            <SelectTrigger>
              <SelectValue placeholder="Select outcome" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="adopt">Adopt</SelectItem>
              <SelectItem value="adapt">Adapt</SelectItem>
              <SelectItem value="abandon">Abandon</SelectItem>
            </SelectContent>
          </Select>
          {/* Hidden input to send empty string when __none__ is selected */}
          <input type="hidden" name="__outcome_sentinel" value="1" />
        </div>

        {/* Driver Diagram */}
        <div className="space-y-2">
          <Label htmlFor="driverDiagramId">Driver Diagram</Label>
          <Select
            name="driverDiagramId"
            defaultValue={defaultValues?.driverDiagramId ?? "__none__"}
            onValueChange={(val) => onDiagramChange(val === "__none__" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select diagram" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {diagrams.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Metric */}
        <div className="space-y-2">
          <Label htmlFor="metricDefinitionId">Metric</Label>
          <Select
            name="metricDefinitionId"
            defaultValue={defaultValues?.metricDefinitionId ?? "__none__"}
          >
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

        {/* Change Idea */}
        <div className="space-y-2 col-span-2">
          <Label htmlFor="changeIdeaNodeId">
            Change Idea
            {formDiagramId && (
              <span className="text-muted-foreground font-normal ml-1">
                (filtered by selected diagram)
              </span>
            )}
          </Label>
          <Select
            name="changeIdeaNodeId"
            defaultValue={defaultValues?.changeIdeaNodeId ?? "__none__"}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select change idea" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {changeIdeas.map((ci) => (
                <SelectItem key={ci.id} value={ci.id}>
                  {ci.text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Phase Sections */}
      <Tabs defaultValue="plan" className="mt-4">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="do">Do</TabsTrigger>
          <TabsTrigger value="study">Study</TabsTrigger>
          <TabsTrigger value="act">Act</TabsTrigger>
        </TabsList>

        {/* Plan Tab */}
        <TabsContent value="plan" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="planDescription">Description</Label>
            <Textarea
              id="planDescription"
              name="planDescription"
              defaultValue={defaultValues?.planDescription ?? ""}
              placeholder="What are you trying to accomplish?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planPrediction">Prediction</Label>
            <Textarea
              id="planPrediction"
              name="planPrediction"
              defaultValue={defaultValues?.planPrediction ?? ""}
              placeholder="What do you predict will happen?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planDataCollection">Data Collection Plan</Label>
            <Textarea
              id="planDataCollection"
              name="planDataCollection"
              defaultValue={defaultValues?.planDataCollection ?? ""}
              placeholder="How will you collect and measure data?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planStartDate">Plan Start Date</Label>
            <Input
              id="planStartDate"
              name="planStartDate"
              type="date"
              defaultValue={defaultValues?.planStartDate ?? ""}
            />
          </div>
        </TabsContent>

        {/* Do Tab */}
        <TabsContent value="do" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="doObservations">Observations</Label>
            <Textarea
              id="doObservations"
              name="doObservations"
              defaultValue={defaultValues?.doObservations ?? ""}
              placeholder="What did you observe during the test?"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="doStartDate">Start Date</Label>
              <Input
                id="doStartDate"
                name="doStartDate"
                type="date"
                defaultValue={defaultValues?.doStartDate ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doEndDate">End Date</Label>
              <Input
                id="doEndDate"
                name="doEndDate"
                type="date"
                defaultValue={defaultValues?.doEndDate ?? ""}
              />
            </div>
          </div>
        </TabsContent>

        {/* Study Tab */}
        <TabsContent value="study" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="studyResults">Results</Label>
            <Textarea
              id="studyResults"
              name="studyResults"
              defaultValue={defaultValues?.studyResults ?? ""}
              placeholder="What were the results?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="studyLearnings">Learnings</Label>
            <Textarea
              id="studyLearnings"
              name="studyLearnings"
              defaultValue={defaultValues?.studyLearnings ?? ""}
              placeholder="What did you learn?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="studyDate">Study Date</Label>
            <Input
              id="studyDate"
              name="studyDate"
              type="date"
              defaultValue={defaultValues?.studyDate ?? ""}
            />
          </div>
        </TabsContent>

        {/* Act Tab */}
        <TabsContent value="act" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="actDecision">Decision</Label>
            <Textarea
              id="actDecision"
              name="actDecision"
              defaultValue={defaultValues?.actDecision ?? ""}
              placeholder="What is the decision based on the study?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actNextSteps">Next Steps</Label>
            <Textarea
              id="actNextSteps"
              name="actNextSteps"
              defaultValue={defaultValues?.actNextSteps ?? ""}
              placeholder="What are the next steps?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actDate">Act Date</Label>
            <Input
              id="actDate"
              name="actDate"
              type="date"
              defaultValue={defaultValues?.actDate ?? ""}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
