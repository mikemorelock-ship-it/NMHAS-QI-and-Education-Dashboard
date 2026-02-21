"use client";

import { useState, useTransition, useMemo } from "react";
import {
  createScorecard,
  updateScorecard,
  deleteScorecard,
  toggleScorecardActive,
} from "@/actions/scorecards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ChevronsUpDown,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  Search,
  X,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScorecardRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  divisionIds: string[];
  divisionNames: string[];
  regionIds: string[];
  regionNames: string[];
  sortOrder: number;
  isActive: boolean;
  metricIds: string[];
  metricGroups: Record<string, string>;
  metricCount: number;
}

interface DivisionOption {
  id: string;
  name: string;
}

interface RegionOption {
  id: string;
  name: string;
  divisionId: string;
}

interface MetricOption {
  id: string;
  name: string;
  unit: string;
}

/** A metric in the "selected" panel, with its group assignment */
interface SelectedMetric {
  id: string;
  name: string;
  unit: string;
  groupName: string;
}

// ---------------------------------------------------------------------------
// Sortable Item Component
// ---------------------------------------------------------------------------

function SortableMetricItem({
  metric,
  existingGroups,
  onRemove,
  onGroupChange,
}: {
  metric: SelectedMetric;
  existingGroups: string[];
  onRemove: (id: string) => void;
  onGroupChange: (id: string, groupName: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: metric.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1.5 p-1.5 rounded-md border bg-card hover:bg-muted/50 group"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-medium">{metric.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <input
            type="text"
            value={metric.groupName}
            onChange={(e) => onGroupChange(metric.id, e.target.value)}
            placeholder="Group name..."
            className="text-xs px-1.5 py-0.5 rounded border bg-background text-muted-foreground w-[140px] focus:outline-none focus:ring-1 focus:ring-nmh-teal"
            list={`groups-${metric.id}`}
          />
          {existingGroups.length > 0 && (
            <datalist id={`groups-${metric.id}`}>
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(metric.id)}
        className="text-muted-foreground hover:text-destructive shrink-0 p-0.5"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScorecardsClient({
  scorecards,
  divisions,
  regions,
  allMetrics,
}: {
  scorecards: ScorecardRow[];
  divisions: DivisionOption[];
  regions: RegionOption[];
  allMetrics: MetricOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScorecardRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScorecardRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Multi-select state
  const [formDivisionIds, setFormDivisionIds] = useState<Set<string>>(new Set());
  const [formRegionIds, setFormRegionIds] = useState<Set<string>>(new Set());
  const [divPopoverOpen, setDivPopoverOpen] = useState(false);
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);

  // Transfer list state
  const [selectedMetrics, setSelectedMetrics] = useState<SelectedMetric[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Metrics lookup
  const metricsMap = useMemo(() => {
    const map = new Map<string, MetricOption>();
    for (const m of allMetrics) map.set(m.id, m);
    return map;
  }, [allMetrics]);

  // Selected metric IDs set for fast lookup
  const selectedMetricIdSet = useMemo(
    () => new Set(selectedMetrics.map((m) => m.id)),
    [selectedMetrics]
  );

  // Available metrics (not selected, filtered by search)
  const availableMetrics = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return allMetrics.filter(
      (m) =>
        !selectedMetricIdSet.has(m.id) && (query === "" || m.name.toLowerCase().includes(query))
    );
  }, [allMetrics, selectedMetricIdSet, searchQuery]);

  // Existing group names for autocomplete
  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const m of selectedMetrics) {
      if (m.groupName) groups.add(m.groupName);
    }
    return Array.from(groups).sort();
  }, [selectedMetrics]);

  // Filtered regions based on selected divisions
  const filteredRegions = useMemo(() => {
    if (formDivisionIds.size === 0) return regions;
    return regions.filter((r) => formDivisionIds.has(r.divisionId));
  }, [regions, formDivisionIds]);

  // --- Division/Region toggle helpers ---
  function toggleDivision(divId: string) {
    setFormDivisionIds((prev) => {
      const next = new Set(prev);
      if (next.has(divId)) {
        next.delete(divId);
        // Remove all regions under this division
        const regionIdsToRemove = regions.filter((r) => r.divisionId === divId).map((r) => r.id);
        setFormRegionIds((prevRegs) => {
          const nextRegs = new Set(prevRegs);
          for (const rid of regionIdsToRemove) nextRegs.delete(rid);
          return nextRegs;
        });
      } else {
        next.add(divId);
        // Auto-select all departments in this division
        const regionIdsToAdd = regions.filter((r) => r.divisionId === divId).map((r) => r.id);
        setFormRegionIds((prevRegs) => {
          const nextRegs = new Set(prevRegs);
          for (const rid of regionIdsToAdd) nextRegs.add(rid);
          return nextRegs;
        });
      }
      return next;
    });
  }

  function toggleRegion(regId: string) {
    setFormRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  }

  // --- Transfer list helpers ---
  function addMetric(metricId: string) {
    const metric = metricsMap.get(metricId);
    if (!metric || selectedMetricIdSet.has(metricId)) return;
    setSelectedMetrics((prev) => [
      ...prev,
      { id: metric.id, name: metric.name, unit: metric.unit, groupName: "" },
    ]);
  }

  function removeMetric(metricId: string) {
    setSelectedMetrics((prev) => prev.filter((m) => m.id !== metricId));
  }

  function updateGroupName(metricId: string, groupName: string) {
    setSelectedMetrics((prev) => prev.map((m) => (m.id === metricId ? { ...m, groupName } : m)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedMetrics((prev) => {
        const oldIndex = prev.findIndex((m) => m.id === active.id);
        const newIndex = prev.findIndex((m) => m.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }

  function addAllVisible() {
    const toAdd = availableMetrics.map((m) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      groupName: "",
    }));
    setSelectedMetrics((prev) => [...prev, ...toAdd]);
  }

  function removeAll() {
    setSelectedMetrics([]);
  }

  // --- Form open/close ---
  function openAdd() {
    setFormDivisionIds(new Set());
    setFormRegionIds(new Set());
    setSelectedMetrics([]);
    setSearchQuery("");
    setFormError(null);
    setAddOpen(true);
  }

  function openEdit(sc: ScorecardRow) {
    setFormDivisionIds(new Set(sc.divisionIds));
    setFormRegionIds(new Set(sc.regionIds));
    // Restore selected metrics in sort order with group names
    const restored: SelectedMetric[] = sc.metricIds
      .map((id) => {
        const metric = metricsMap.get(id);
        if (!metric) return null;
        return {
          id: metric.id,
          name: metric.name,
          unit: metric.unit,
          groupName: sc.metricGroups[id] ?? "",
        };
      })
      .filter(Boolean) as SelectedMetric[];
    setSelectedMetrics(restored);
    setSearchQuery("");
    setFormError(null);
    setEditTarget(sc);
  }

  function handleToggleActive(sc: ScorecardRow) {
    startTransition(async () => {
      await toggleScorecardActive(sc.id, !sc.isActive);
    });
  }

  // --- Build form data for submission ---
  function buildFormData(nativeFormData: FormData): FormData {
    nativeFormData.set("divisionIds", Array.from(formDivisionIds).join(","));
    nativeFormData.set("regionIds", Array.from(formRegionIds).join(","));
    nativeFormData.set("metricIds", selectedMetrics.map((m) => m.id).join(","));
    // Build metric groups JSON
    const groups: Record<string, string> = {};
    for (const m of selectedMetrics) {
      if (m.groupName.trim()) {
        groups[m.id] = m.groupName.trim();
      }
    }
    nativeFormData.set("metricGroups", JSON.stringify(groups));
    return nativeFormData;
  }

  // Popover trigger text helpers
  const divTriggerText = useMemo(() => {
    if (formDivisionIds.size === 0) return "All Divisions";
    if (formDivisionIds.size === 1) {
      const div = divisions.find((d) => formDivisionIds.has(d.id));
      return div?.name ?? "1 division";
    }
    return `${formDivisionIds.size} divisions`;
  }, [formDivisionIds, divisions]);

  const deptTriggerText = useMemo(() => {
    if (formRegionIds.size === 0) return "All Departments";
    if (formRegionIds.size === 1) {
      const reg = filteredRegions.find((r) => formRegionIds.has(r.id));
      return reg?.name ?? "1 department";
    }
    return `${formRegionIds.size} departments`;
  }, [formRegionIds, filteredRegions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Scorecards</h1>
          <p className="text-muted-foreground mt-1">
            Create quick-filter presets for the public scorecards page.
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-nmh-teal hover:bg-nmh-teal/90" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Scorecard
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Scorecard</DialogTitle>
              <DialogDescription>
                Create a new scorecard with filter scope and metric selection.
              </DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                setFormError(null);
                const enriched = buildFormData(formData);
                const result = await createScorecard(enriched);
                if (result.success) {
                  setAddOpen(false);
                } else {
                  setFormError(result.error || "Failed to create scorecard.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              <ScorecardFormFields
                divisions={divisions}
                regions={filteredRegions}
                formDivisionIds={formDivisionIds}
                formRegionIds={formRegionIds}
                onToggleDivision={toggleDivision}
                onToggleRegion={toggleRegion}
                divPopoverOpen={divPopoverOpen}
                setDivPopoverOpen={setDivPopoverOpen}
                deptPopoverOpen={deptPopoverOpen}
                setDeptPopoverOpen={setDeptPopoverOpen}
                divTriggerText={divTriggerText}
                deptTriggerText={deptTriggerText}
                availableMetrics={availableMetrics}
                selectedMetrics={selectedMetrics}
                existingGroups={existingGroups}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAddMetric={addMetric}
                onRemoveMetric={removeMetric}
                onUpdateGroupName={updateGroupName}
                onDragEnd={handleDragEnd}
                onAddAll={addAllVisible}
                onRemoveAll={removeAll}
                sensors={sensors}
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
                  Create Scorecard
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border">
        {scorecards.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No scorecards yet. Create one to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-center">Metrics</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scorecards.map((sc) => (
                <TableRow key={sc.id} className={!sc.isActive ? "opacity-60" : undefined}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{sc.name}</span>
                      {sc.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {sc.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sc.divisionNames.length === 0 ? (
                      <span className="text-muted-foreground">All</span>
                    ) : sc.divisionNames.length <= 2 ? (
                      sc.divisionNames.join(", ")
                    ) : (
                      <span title={sc.divisionNames.join(", ")}>
                        {sc.divisionNames.length} divisions
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sc.regionNames.length === 0 ? (
                      <span className="text-muted-foreground">All</span>
                    ) : sc.regionNames.length <= 2 ? (
                      sc.regionNames.join(", ")
                    ) : (
                      <span title={sc.regionNames.join(", ")}>{sc.regionNames.length} depts</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {sc.metricCount > 0 ? (
                      <Badge variant="outline">{sc.metricCount}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">All</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title={sc.isActive ? "Deactivate" : "Activate"}
                        onClick={() => handleToggleActive(sc)}
                        disabled={isPending}
                      >
                        {sc.isActive ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(sc)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(sc)}
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scorecard</DialogTitle>
            <DialogDescription>Update the scorecard details.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form
              key={editTarget.id}
              action={async (formData) => {
                setFormError(null);
                const enriched = buildFormData(formData);
                const result = await updateScorecard(editTarget.id, enriched);
                if (result.success) {
                  setEditTarget(null);
                } else {
                  setFormError(result.error || "Failed to update scorecard.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              <ScorecardFormFields
                divisions={divisions}
                regions={filteredRegions}
                formDivisionIds={formDivisionIds}
                formRegionIds={formRegionIds}
                onToggleDivision={toggleDivision}
                onToggleRegion={toggleRegion}
                divPopoverOpen={divPopoverOpen}
                setDivPopoverOpen={setDivPopoverOpen}
                deptPopoverOpen={deptPopoverOpen}
                setDeptPopoverOpen={setDeptPopoverOpen}
                divTriggerText={divTriggerText}
                deptTriggerText={deptTriggerText}
                availableMetrics={availableMetrics}
                selectedMetrics={selectedMetrics}
                existingGroups={existingGroups}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onAddMetric={addMetric}
                onRemoveMetric={removeMetric}
                onUpdateGroupName={updateGroupName}
                onDragEnd={handleDragEnd}
                onAddAll={addAllVisible}
                onRemoveAll={removeAll}
                sensors={sensors}
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
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scorecard</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will remove the
              scorecard and its {deleteTarget?.metricCount ?? 0} metric associations. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteScorecard(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Scorecard
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

function ScorecardFormFields({
  divisions,
  regions,
  formDivisionIds,
  formRegionIds,
  onToggleDivision,
  onToggleRegion,
  divPopoverOpen,
  setDivPopoverOpen,
  deptPopoverOpen,
  setDeptPopoverOpen,
  divTriggerText,
  deptTriggerText,
  availableMetrics,
  selectedMetrics,
  existingGroups,
  searchQuery,
  setSearchQuery,
  onAddMetric,
  onRemoveMetric,
  onUpdateGroupName,
  onDragEnd,
  onAddAll,
  onRemoveAll,
  sensors,
  defaultValues,
}: {
  divisions: DivisionOption[];
  regions: RegionOption[];
  formDivisionIds: Set<string>;
  formRegionIds: Set<string>;
  onToggleDivision: (id: string) => void;
  onToggleRegion: (id: string) => void;
  divPopoverOpen: boolean;
  setDivPopoverOpen: (open: boolean) => void;
  deptPopoverOpen: boolean;
  setDeptPopoverOpen: (open: boolean) => void;
  divTriggerText: string;
  deptTriggerText: string;
  availableMetrics: MetricOption[];
  selectedMetrics: SelectedMetric[];
  existingGroups: string[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onAddMetric: (id: string) => void;
  onRemoveMetric: (id: string) => void;
  onUpdateGroupName: (id: string, groupName: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onAddAll: () => void;
  onRemoveAll: () => void;
  sensors: ReturnType<typeof useSensors>;
  defaultValues?: ScorecardRow;
}) {
  return (
    <div className="space-y-4 py-2">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          placeholder="e.g., Air Care Overview"
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Optional description"
          rows={2}
        />
      </div>

      {/* Division & Department — side by side multi-select */}
      <div className="grid grid-cols-2 gap-4">
        {/* Multi-select Division */}
        <div className="space-y-2">
          <Label>
            Division <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Popover open={divPopoverOpen} onOpenChange={setDivPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
              >
                <span className="truncate">{divTriggerText}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[280px] p-2"
              align="start"
              onWheel={(e) => e.stopPropagation()}
            >
              <div
                className="space-y-1 max-h-[300px] overflow-y-auto"
                onWheel={(e) => e.stopPropagation()}
              >
                {divisions.map((div) => (
                  <label
                    key={div.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={formDivisionIds.has(div.id)}
                      onCheckedChange={() => onToggleDivision(div.id)}
                    />
                    <span className="text-sm">{div.name}</span>
                  </label>
                ))}
                {divisions.length === 0 && (
                  <p className="text-sm text-muted-foreground px-2 py-2">No divisions available.</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Multi-select Department (Region in DB) */}
        <div className="space-y-2">
          <Label>
            Department <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
              >
                <span className="truncate">{deptTriggerText}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[280px] p-2"
              align="start"
              onWheel={(e) => e.stopPropagation()}
            >
              <div
                className="space-y-1 max-h-[300px] overflow-y-auto"
                onWheel={(e) => e.stopPropagation()}
              >
                {regions.map((reg) => (
                  <label
                    key={reg.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={formRegionIds.has(reg.id)}
                      onCheckedChange={() => onToggleRegion(reg.id)}
                    />
                    <span className="text-sm">{reg.name}</span>
                  </label>
                ))}
                {regions.length === 0 && (
                  <p className="text-sm text-muted-foreground px-2 py-2">
                    {formDivisionIds.size === 0
                      ? "Select a division first, or leave blank for all."
                      : "No departments in selected divisions."}
                  </p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Sort Order */}
      <div className="space-y-2">
        <Label htmlFor="sortOrder">Sort Order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={defaultValues?.sortOrder ?? 0}
        />
      </div>

      {/* Two-Panel Transfer List */}
      <div className="space-y-2">
        <Label>
          Metrics{" "}
          <span className="text-muted-foreground font-normal">
            (optional — blank = all metrics)
          </span>
        </Label>
        <div className="grid grid-cols-2 gap-3 border rounded-lg p-3">
          {/* Left Panel: Available */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Available ({availableMetrics.length})
              </p>
              {availableMetrics.length > 0 && (
                <button
                  type="button"
                  onClick={onAddAll}
                  className="text-xs text-nmh-teal hover:underline"
                >
                  Add all
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search metrics..."
                className="w-full text-sm pl-7 pr-7 py-1.5 rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-nmh-teal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-0.5">
              {availableMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {searchQuery ? "No matching metrics." : "All metrics selected."}
                </p>
              ) : (
                availableMetrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => onAddMetric(metric.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-left group"
                  >
                    <span className="text-sm truncate flex-1">
                      {metric.name}
                      <span className="text-muted-foreground ml-1 capitalize">({metric.unit})</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Panel: Selected (sortable) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Selected ({selectedMetrics.length})
              </p>
              {selectedMetrics.length > 0 && (
                <button
                  type="button"
                  onClick={onRemoveAll}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove all
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Drag to reorder. Type a group name to create sections.
            </p>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {selectedMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No metrics selected. All metrics will display.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <SortableContext
                    items={selectedMetrics.map((m) => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {selectedMetrics.map((metric) => (
                      <SortableMetricItem
                        key={metric.id}
                        metric={metric}
                        existingGroups={existingGroups}
                        onRemove={onRemoveMetric}
                        onGroupChange={onUpdateGroupName}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
