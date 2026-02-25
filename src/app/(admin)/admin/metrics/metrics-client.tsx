"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createMetricDefinition,
  updateMetricDefinition,
  deleteMetricDefinition,
  toggleMetricActive,
  updateMetricSortOrders,
} from "@/actions/metrics";
import { setMetricAssociations } from "@/actions/metric-associations";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Settings2,
  ClipboardEdit,
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  GripVertical,
  Save,
  Check,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  METRIC_UNITS,
  CHART_TYPES,
  PERIOD_TYPES,
  AGGREGATION_TYPES,
  AGGREGATION_TYPE_LABELS,
  DATA_TYPES,
  DATA_TYPE_LABELS,
  SPC_SIGMA_LEVELS,
  SPC_SIGMA_LABELS,
  defaultDataType,
  DESIRED_DIRECTIONS,
  DESIRED_DIRECTION_LABELS,
  defaultDesiredDirection,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricRow {
  id: string;
  name: string;
  slug: string;
  departmentId: string;
  departmentName: string;
  parentId: string | null;
  parentName: string | null;
  unit: string;
  chartType: string;
  periodType: string;
  category: string | null;
  isKpi: boolean;
  target: number | null;
  aggregationType: string;
  dataType: string;
  spcSigmaLevel: number;
  baselineStart: string | null;
  baselineEnd: string | null;
  numeratorLabel: string | null;
  denominatorLabel: string | null;
  rateMultiplier: number | null;
  rateSuffix: string | null;
  desiredDirection: string;
  sortOrder: number;
  description: string | null;
  dataDefinition: string | null;
  methodology: string | null;
  isActive: boolean;
  entriesCount: number;
  childrenCount: number;
}

interface DepartmentOption {
  id: string;
  name: string;
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

type AssociationsMap = Record<string, { divisionIds: string[]; regionIds: string[] }>;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MetricsClient({
  metrics,
  departments,
  divisions,
  regions,
  associationsMap,
}: {
  metrics: MetricRow[];
  departments: DepartmentOption[];
  divisions: DivisionOption[];
  regions: RegionOption[];
  associationsMap: AssociationsMap;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MetricRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MetricRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"active" | "archived">("active");
  const [filterKpi, setFilterKpi] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDivision, setFilterDivision] = useState<string>("all");
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // DnD state — sync from server props when they change (e.g. after create/archive/delete)
  const [localMetrics, setLocalMetrics] = useState<MetricRow[]>(metrics);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [orderSaved, setOrderSaved] = useState(false);

  // Keep localMetrics in sync with server-provided metrics prop
  // (router.refresh() delivers new props but useState ignores them after mount)
  const [prevMetrics, setPrevMetrics] = useState(metrics);
  if (metrics !== prevMetrics) {
    setPrevMetrics(metrics);
    if (!hasOrderChanges) {
      setLocalMetrics(metrics);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Association state for the currently open form
  const [formAssociations, setFormAssociations] = useState<{
    divisionIds: Set<string>;
    regionIds: Set<string>;
  }>({ divisionIds: new Set(), regionIds: new Set() });

  // Derive unique categories from metrics
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const m of localMetrics) {
      if (m.category) cats.add(m.category);
    }
    return Array.from(cats).sort();
  }, [localMetrics]);

  // Derive division associations for filtering
  const metricDivisionMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const [metricId, assoc] of Object.entries(associationsMap)) {
      const divIds = new Set(assoc.divisionIds);
      // Also add divisions from region associations
      for (const regId of assoc.regionIds) {
        const region = regions.find((r) => r.id === regId);
        if (region) divIds.add(region.divisionId);
      }
      map.set(metricId, divIds);
    }
    return map;
  }, [associationsMap, regions]);

  const archivedCount = localMetrics.filter((m) => !m.isActive).length;

  let filtered = localMetrics.filter((m) => (filterStatus === "active" ? m.isActive : !m.isActive));
  if (filterKpi === "kpi") {
    filtered = filtered.filter((m) => m.isKpi);
  } else if (filterKpi === "non-kpi") {
    filtered = filtered.filter((m) => !m.isKpi);
  }
  if (filterCategory !== "all") {
    filtered = filtered.filter((m) => m.category === filterCategory);
  }
  if (filterDivision !== "all") {
    filtered = filtered.filter((m) => {
      const divs = metricDivisionMap.get(m.id);
      return divs?.has(filterDivision) ?? false;
    });
  }

  // Build hierarchical list
  const topLevelMetrics = filtered.filter((m) => m.parentId === null);
  const childrenByParent = new Map<string, MetricRow[]>();
  for (const m of filtered) {
    if (m.parentId) {
      const siblings = childrenByParent.get(m.parentId) ?? [];
      siblings.push(m);
      childrenByParent.set(m.parentId, siblings);
    }
  }

  const orderedRows: { metric: MetricRow; isChild: boolean }[] = [];
  for (const parent of topLevelMetrics) {
    orderedRows.push({ metric: parent, isChild: false });
    const children = childrenByParent.get(parent.id);
    if (children && !collapsedParents.has(parent.id)) {
      for (const child of children) {
        orderedRows.push({ metric: child, isChild: true });
      }
    }
  }
  for (const m of filtered) {
    if (m.parentId && !topLevelMetrics.some((p) => p.id === m.parentId)) {
      orderedRows.push({ metric: m, isChild: false });
    }
  }

  // Apply column sorting when active (overrides hierarchy/drag order)
  if (sortKey) {
    orderedRows.sort((a, b) => {
      const ma = a.metric;
      const mb = b.metric;
      let cmp = 0;

      switch (sortKey) {
        case "name":
          cmp = ma.name.localeCompare(mb.name);
          break;
        case "unit":
          cmp = ma.unit.localeCompare(mb.unit);
          break;
        case "kpi":
          cmp = (ma.isKpi ? 1 : 0) - (mb.isKpi ? 1 : 0);
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const sortableIds = orderedRows.map((r) => r.metric.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedRows.findIndex((r) => r.metric.id === active.id);
    const newIndex = orderedRows.findIndex((r) => r.metric.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the top-level metric list based on the new visual order
    const reorderedRows = arrayMove(orderedRows, oldIndex, newIndex);

    // Rebuild localMetrics with new sortOrder values
    const newLocal = [...localMetrics];
    const idToNewOrder = new Map<string, number>();
    reorderedRows.forEach((row, idx) => {
      idToNewOrder.set(row.metric.id, idx);
    });

    for (const m of newLocal) {
      const newOrder = idToNewOrder.get(m.id);
      if (newOrder !== undefined) {
        m.sortOrder = newOrder;
      }
    }

    newLocal.sort((a, b) => a.sortOrder - b.sortOrder);
    setLocalMetrics(newLocal);
    setHasOrderChanges(true);
    setOrderSaved(false);
  }

  function handleSaveOrder() {
    startTransition(async () => {
      const updates = localMetrics.map((m, idx) => ({
        id: m.id,
        sortOrder: idx,
      }));
      const result = await updateMetricSortOrders(updates);
      if (result.success) {
        setHasOrderChanges(false);
        setOrderSaved(true);
      }
    });
  }

  function toggleCollapsed(parentId: string) {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }

  function handleToggleActive(metric: MetricRow) {
    startTransition(async () => {
      await toggleMetricActive(metric.id, !metric.isActive);
    });
  }

  function openEditDialog(metric: MetricRow) {
    setFormError(null);
    const assoc = associationsMap[metric.id];
    setFormAssociations({
      divisionIds: new Set(assoc?.divisionIds ?? []),
      regionIds: new Set(assoc?.regionIds ?? []),
    });
    setEditTarget(metric);
  }

  function openAddDialog() {
    setFormError(null);
    setFormAssociations({
      divisionIds: new Set(),
      regionIds: new Set(),
    });
    setAddOpen(true);
  }

  // Helper to get association summary text for a metric
  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // Third click resets to default order
        setSortKey(null);
        setSortDir("asc");
      }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const isCustomSorted = sortKey !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">Metric Definitions</h1>
          <p className="text-muted-foreground mt-1">
            Define what metrics are tracked and their division/department associations.
          </p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-nmh-teal hover:bg-nmh-teal/90" onClick={openAddDialog}>
              <Plus className="h-4 w-4" />
              Add Metric
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Metric Definition</DialogTitle>
              <DialogDescription>Define a new metric to track in the dashboard.</DialogDescription>
            </DialogHeader>
            <form
              action={async (formData) => {
                setFormError(null);
                const result = await createMetricDefinition(formData);
                if (result.success) {
                  // Save associations (divisions/departments)
                  if (result.data?.id) {
                    const associations: {
                      divisionId?: string | null;
                      regionId?: string | null;
                    }[] = [];
                    for (const divId of formAssociations.divisionIds) {
                      associations.push({ divisionId: divId, regionId: null });
                    }
                    for (const regId of formAssociations.regionIds) {
                      associations.push({ divisionId: null, regionId: regId });
                    }
                    if (associations.length > 0) {
                      await setMetricAssociations(result.data.id, associations);
                    }
                  }
                  setAddOpen(false);
                  router.refresh();
                } else {
                  setFormError(result.error || "Failed to create metric.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              <MetricFormFields
                departments={departments}
                allMetrics={metrics}
                divisions={divisions}
                regions={regions}
                formAssociations={formAssociations}
                onAssociationsChange={setFormAssociations}
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
                  Create Metric
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Tabs + Filters + Save Order */}
      <div className="flex items-center gap-1 mb-2">
        <Button
          variant={filterStatus === "active" ? "default" : "ghost"}
          size="sm"
          className={filterStatus === "active" ? "bg-nmh-teal hover:bg-nmh-teal/90" : ""}
          onClick={() => setFilterStatus("active")}
        >
          Active
        </Button>
        <Button
          variant={filterStatus === "archived" ? "default" : "ghost"}
          size="sm"
          className={
            filterStatus === "archived"
              ? "bg-muted-foreground hover:bg-muted-foreground/90 text-white"
              : ""
          }
          onClick={() => setFilterStatus("archived")}
        >
          Archived
          {archivedCount > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
              {archivedCount}
            </Badge>
          )}
        </Button>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Type:</Label>
          <Select value={filterKpi} onValueChange={setFilterKpi}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Metrics</SelectItem>
              <SelectItem value="kpi">KPIs Only</SelectItem>
              <SelectItem value="non-kpi">Non-KPI Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Category:</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Division:</Label>
          <Select value={filterDivision} onValueChange={setFilterDivision}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map((div) => (
                <SelectItem key={div.id} value={div.id}>
                  {div.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {hasOrderChanges && (
            <Button
              size="sm"
              className="bg-nmh-teal hover:bg-nmh-teal/90"
              onClick={handleSaveOrder}
              disabled={isPending}
            >
              {isPending ? (
                "Saving..."
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Order
                </>
              )}
            </Button>
          )}
          {orderSaved && !hasOrderChanges && (
            <span className="text-sm text-nmh-teal flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              Order saved
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground w-full">
          {filtered.length} of {localMetrics.length} metrics
          {childrenByParent.size > 0 && <> ({topLevelMetrics.length} top-level)</>}
          {hasOrderChanges && (
            <span className="text-amber-600 ml-2">
              — drag rows to reorder, then click Save Order
            </span>
          )}
        </span>
      </div>

      {/* Table with DnD */}
      <div className="bg-card rounded-lg border">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No metrics found. Create one to get started.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <SortableTableHead
                    sortKey="name"
                    activeSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  >
                    Name
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="unit"
                    activeSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  >
                    Unit
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="kpi"
                    activeSortKey={sortKey}
                    sortDir={sortDir}
                    onSort={handleSort}
                  >
                    KPI
                  </SortableTableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {orderedRows.map(({ metric, isChild }) => (
                    <SortableMetricRow
                      key={metric.id}
                      metric={metric}
                      isChild={isChild}
                      childrenByParent={childrenByParent}
                      collapsedParents={collapsedParents}
                      toggleCollapsed={toggleCollapsed}
                      handleToggleActive={handleToggleActive}
                      openEditDialog={openEditDialog}
                      setDeleteTarget={setDeleteTarget}
                      isPending={isPending}
                      hideDragHandle={isCustomSorted}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Metric Definition</DialogTitle>
            <DialogDescription>
              Update the metric definition and its associations.
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <form
              key={editTarget.id}
              action={async (formData) => {
                setFormError(null);
                const result = await updateMetricDefinition(editTarget.id, formData);
                if (result.success) {
                  // Save associations
                  const associations: {
                    divisionId?: string | null;
                    regionId?: string | null;
                  }[] = [];
                  for (const divId of formAssociations.divisionIds) {
                    associations.push({ divisionId: divId, regionId: null });
                  }
                  for (const regId of formAssociations.regionIds) {
                    associations.push({ divisionId: null, regionId: regId });
                  }
                  await setMetricAssociations(editTarget.id, associations);
                  setEditTarget(null);
                  router.refresh();
                } else {
                  setFormError(result.error || "Failed to update metric.");
                }
              }}
            >
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 mb-3">
                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}
              <MetricFormFields
                departments={departments}
                allMetrics={metrics}
                defaultValues={editTarget}
                divisions={divisions}
                regions={regions}
                formAssociations={formAssociations}
                onAssociationsChange={setFormAssociations}
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
            <DialogTitle>Delete Metric</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This will also
              delete {deleteTarget?.entriesCount ?? 0} associated data entries. This action cannot
              be undone.
              {(deleteTarget?.childrenCount ?? 0) > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  This metric has {deleteTarget?.childrenCount} sub-metric(s) that will become
                  standalone metrics.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteMetricDefinition(deleteTarget.id);
                  setDeleteTarget(null);
                  router.refresh();
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Metric
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SortableTableHead — clickable column header with sort indicator
// ---------------------------------------------------------------------------

function SortableTableHead({
  sortKey: key,
  activeSortKey,
  sortDir,
  onSort,
  className,
  children,
}: {
  sortKey: string;
  activeSortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const isActive = activeSortKey === key;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded"
      >
        {children}
        {isActive ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-nmh-teal" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-nmh-teal" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </button>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// SortableMetricRow — drag-and-drop wrapper for table rows
// ---------------------------------------------------------------------------

function SortableMetricRow({
  metric,
  isChild,
  childrenByParent,
  collapsedParents,
  toggleCollapsed,
  handleToggleActive,
  openEditDialog,
  setDeleteTarget,
  isPending,
  hideDragHandle,
}: {
  metric: MetricRow;
  isChild: boolean;
  childrenByParent: Map<string, MetricRow[]>;
  collapsedParents: Set<string>;
  toggleCollapsed: (id: string) => void;
  handleToggleActive: (m: MetricRow) => void;
  openEditDialog: (m: MetricRow) => void;
  setDeleteTarget: (m: MetricRow) => void;
  isPending: boolean;
  hideDragHandle?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: metric.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = childrenByParent.has(metric.id);
  const isCollapsed = collapsedParents.has(metric.id);
  const childCount = childrenByParent.get(metric.id)?.length ?? 0;
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={
        (!metric.isActive ? "opacity-60 " : "") +
        (isChild ? "bg-muted/30 " : "") +
        (isDragging ? "bg-muted/50 " : "")
      }
    >
      <TableCell className="w-8 px-1">
        {!hideDragHandle && (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
      </TableCell>
      <TableCell>
        <div className={isChild ? "pl-7" : ""}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <button
                type="button"
                onClick={() => toggleCollapsed(metric.id)}
                className="flex items-center justify-center size-5 rounded hover:bg-muted transition-colors -ml-0.5"
                title={
                  isCollapsed
                    ? `Expand ${childCount} sub-metrics`
                    : `Collapse ${childCount} sub-metrics`
                }
              >
                {isCollapsed ? (
                  <ChevronRight className="size-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                )}
              </button>
            )}
            {isChild && (
              <CornerDownRight className="size-3.5 text-muted-foreground/60 -ml-1 shrink-0" />
            )}
            <span className={isChild ? "font-normal text-sm" : "font-medium"}>{metric.name}</span>
            {!metric.isActive && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-muted-foreground/40 text-muted-foreground"
              >
                Archived
              </Badge>
            )}
            {hasChildren && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {childCount} sub
              </Badge>
            )}
          </div>
          {metric.category && (
            <p
              className={
                "text-xs text-muted-foreground mt-0.5" + (isChild ? "" : hasChildren ? " ml-7" : "")
              }
            >
              {metric.category}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="capitalize">
            {metric.unit}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
            {metric.aggregationType === "sum"
              ? "Σ"
              : metric.aggregationType === "average"
                ? "x̄"
                : metric.aggregationType}
          </Badge>
        </div>
      </TableCell>
      <TableCell>{metric.isKpi && <Badge className="bg-nmh-teal text-white">KPI</Badge>}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            title={metric.isActive ? "Archive metric" : "Unarchive metric"}
            onClick={() => handleToggleActive(metric)}
            disabled={isPending}
            className={!metric.isActive ? "text-nmh-teal" : ""}
          >
            {metric.isActive ? (
              <Archive className="h-3.5 w-3.5" />
            ) : (
              <ArchiveRestore className="h-3.5 w-3.5" />
            )}
            <span className="text-xs ml-0.5">{metric.isActive ? "Archive" : "Unarchive"}</span>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/metrics/${metric.id}`}>
              <Settings2 className="h-3.5 w-3.5" />
              Manage
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/data-entry?metricId=${metric.id}&periodType=${metric.periodType}`}>
              <ClipboardEdit className="h-3.5 w-3.5" />
              Data
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => openEditDialog(metric)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(metric)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// MetricFormFields with Associations Picker
// ---------------------------------------------------------------------------

function MetricFormFields({
  departments,
  allMetrics,
  defaultValues,
  divisions,
  regions,
  formAssociations,
  onAssociationsChange,
}: {
  departments: DepartmentOption[];
  allMetrics: MetricRow[];
  defaultValues?: MetricRow;
  divisions: DivisionOption[];
  regions: RegionOption[];
  formAssociations: { divisionIds: Set<string>; regionIds: Set<string> };
  onAssociationsChange: (value: { divisionIds: Set<string>; regionIds: Set<string> }) => void;
}) {
  const parentCandidates = allMetrics.filter(
    (m) => m.parentId === null && m.id !== defaultValues?.id
  );

  const toggleDivision = useCallback(
    (divId: string, checked: boolean) => {
      const newDivisions = new Set(formAssociations.divisionIds);
      const newRegions = new Set(formAssociations.regionIds);

      if (checked) {
        newDivisions.add(divId);
      } else {
        newDivisions.delete(divId);
        // Also uncheck all departments under this division
        for (const reg of regions) {
          if (reg.divisionId === divId) {
            newRegions.delete(reg.id);
          }
        }
      }
      onAssociationsChange({
        divisionIds: newDivisions,
        regionIds: newRegions,
      });
    },
    [formAssociations, onAssociationsChange, regions]
  );

  const toggleRegion = useCallback(
    (regId: string, checked: boolean) => {
      const newRegions = new Set(formAssociations.regionIds);
      if (checked) {
        newRegions.add(regId);
      } else {
        newRegions.delete(regId);
      }
      onAssociationsChange({
        divisionIds: formAssociations.divisionIds,
        regionIds: newRegions,
      });
    },
    [formAssociations, onAssociationsChange]
  );

  // Track current unit + dataType + desiredDirection to conditionally show fields
  const [formUnit, setFormUnit] = useState(defaultValues?.unit ?? "count");
  const [formDataType, setFormDataType] = useState(
    defaultValues?.dataType ?? defaultDataType(defaultValues?.unit ?? "count")
  );
  const [formDesiredDirection, setFormDesiredDirection] = useState(
    defaultValues?.desiredDirection ?? defaultDesiredDirection(defaultValues?.unit ?? "count")
  );
  const isNDDataType = formDataType === "proportion" || formDataType === "rate";

  // Group regions by division
  const regionsByDivision = new Map<string, RegionOption[]>();
  for (const reg of regions) {
    const list = regionsByDivision.get(reg.divisionId) ?? [];
    list.push(reg);
    regionsByDivision.set(reg.divisionId, list);
  }

  return (
    <div className="space-y-4 py-2">
      {/* Hidden departmentId — auto-assigned, no longer user-facing */}
      <input
        type="hidden"
        name="departmentId"
        value={defaultValues?.departmentId ?? departments[0]?.id ?? ""}
      />
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues?.name ?? ""}
          placeholder="Metric name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="parentId">Parent Metric</Label>
        <Select name="parentId" defaultValue={defaultValues?.parentId ?? "none"}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="None (standalone metric)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (standalone metric)</SelectItem>
            {parentCandidates.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Set a parent to make this a sub-metric. Only single-level nesting is allowed.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Select
            name="unit"
            value={formUnit}
            onValueChange={(val) => {
              setFormUnit(val);
              setFormDataType(defaultDataType(val));
              setFormDesiredDirection(defaultDesiredDirection(val));
            }}
            required
          >
            <SelectTrigger className="w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_UNITS.map((u) => (
                <SelectItem key={u} value={u} className="capitalize">
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="chartType">Chart Type</Label>
          <Select name="chartType" defaultValue={defaultValues?.chartType ?? "line"}>
            <SelectTrigger className="w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHART_TYPES.map((ct) => (
                <SelectItem key={ct} value={ct} className="capitalize">
                  {ct}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodType">Reporting Frequency</Label>
          <Select name="periodType" defaultValue={defaultValues?.periodType ?? "monthly"}>
            <SelectTrigger className="w-full capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_TYPES.map((pt) => (
                <SelectItem key={pt} value={pt} className="capitalize">
                  {pt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="aggregationType">Aggregation</Label>
          <Select name="aggregationType" defaultValue={defaultValues?.aggregationType ?? "average"}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATION_TYPES.map((at) => (
                <SelectItem key={at} value={at}>
                  {AGGREGATION_TYPE_LABELS[at] || at}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            How department values roll up to the division level.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desiredDirection">Desired Direction</Label>
          <Select
            name="desiredDirection"
            value={formDesiredDirection}
            onValueChange={setFormDesiredDirection}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DESIRED_DIRECTIONS.map((dd) => (
                <SelectItem key={dd} value={dd}>
                  {DESIRED_DIRECTION_LABELS[dd]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controls trend arrow colors. Auto-set from unit type.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={defaultValues?.sortOrder ?? 0}
            min={0}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dataType">Data Type (SPC)</Label>
          <Select name="dataType" value={formDataType} onValueChange={setFormDataType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((dt) => (
                <SelectItem key={dt} value={dt}>
                  {DATA_TYPE_LABELS[dt] || dt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Determines control chart type. Auto-defaults from unit.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="spcSigmaLevel">Control Limit (σ)</Label>
          <Select name="spcSigmaLevel" defaultValue={String(defaultValues?.spcSigmaLevel ?? 3)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPC_SIGMA_LEVELS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {SPC_SIGMA_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Width of control limits on SPC charts.</p>
        </div>
      </div>
      {/* SPC Baseline Freeze */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">SPC Baseline Period (Optional)</Label>
        <p className="text-xs text-muted-foreground">
          Freeze the baseline period for control limit calculations. Leave blank for auto-calculated
          limits using all data.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="baselineStart" className="text-xs text-muted-foreground">
              Baseline Start
            </Label>
            <Input
              id="baselineStart"
              name="baselineStart"
              type="date"
              defaultValue={defaultValues?.baselineStart ?? ""}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="baselineEnd" className="text-xs text-muted-foreground">
              Baseline End
            </Label>
            <Input
              id="baselineEnd"
              name="baselineEnd"
              type="date"
              defaultValue={defaultValues?.baselineEnd ?? ""}
            />
          </div>
        </div>
      </div>
      {/* Custom Numerator/Denominator Labels — shown only for proportion or rate metrics */}
      {isNDDataType && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Custom Column Labels (Optional)</Label>
          <p className="text-xs text-muted-foreground">
            Override the default column labels used in data entry.
            {formDataType === "proportion"
              ? ' Defaults: "Compliant" / "Total".'
              : ' Defaults: "Events" / "Exposure".'}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="numeratorLabel" className="text-xs text-muted-foreground">
                Numerator Label
              </Label>
              <Input
                id="numeratorLabel"
                name="numeratorLabel"
                defaultValue={defaultValues?.numeratorLabel ?? ""}
                placeholder={formDataType === "proportion" ? "Compliant" : "Events"}
                maxLength={50}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="denominatorLabel" className="text-xs text-muted-foreground">
                Denominator Label
              </Label>
              <Input
                id="denominatorLabel"
                name="denominatorLabel"
                defaultValue={defaultValues?.denominatorLabel ?? ""}
                placeholder={formDataType === "proportion" ? "Total" : "Exposure"}
                maxLength={50}
              />
            </div>
          </div>
        </div>
      )}
      {/* Rate Display Settings — shown only when unit is "rate" */}
      {formUnit === "rate" && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Rate Display Settings</Label>
          <p className="text-xs text-muted-foreground">
            The raw rate (numerator ÷ denominator) will be multiplied by this factor for display.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="rateMultiplier" className="text-xs text-muted-foreground">
                Multiplier
              </Label>
              <Input
                id="rateMultiplier"
                name="rateMultiplier"
                type="number"
                defaultValue={defaultValues?.rateMultiplier ?? ""}
                placeholder="e.g. 1000"
                min={1}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rateSuffix" className="text-xs text-muted-foreground">
                Display Suffix
              </Label>
              <Input
                id="rateSuffix"
                name="rateSuffix"
                defaultValue={defaultValues?.rateSuffix ?? ""}
                placeholder='e.g. "per 1,000 transports"'
                maxLength={100}
              />
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? ""}
            placeholder="Optional category"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target">Target</Label>
          <Input
            id="target"
            name="target"
            type="text"
            inputMode="decimal"
            defaultValue={defaultValues?.target ?? ""}
            placeholder="Optional target"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isKpi"
          name="isKpi"
          defaultChecked={defaultValues?.isKpi ?? false}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor="isKpi" className="font-normal">
          Mark as Key Performance Indicator (KPI)
        </Label>
      </div>

      {/* Associations Picker */}
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <div>
          <Label className="text-sm font-semibold">Division & Department Associations</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select which divisions and/or departments this metric applies to.
          </p>
        </div>
        {divisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No divisions available. Create divisions first.
          </p>
        ) : (
          <div className="space-y-3">
            {divisions.map((div) => {
              const divRegions = regionsByDivision.get(div.id) ?? [];
              const isDivChecked = formAssociations.divisionIds.has(div.id);

              return (
                <div key={div.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`div-${div.id}`}
                      checked={isDivChecked}
                      onCheckedChange={(checked) => toggleDivision(div.id, !!checked)}
                    />
                    <label htmlFor={`div-${div.id}`} className="text-sm font-medium cursor-pointer">
                      {div.name}
                    </label>
                    {divRegions.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({divRegions.length} depts)
                      </span>
                    )}
                  </div>
                  {/* Show departments under this division */}
                  {divRegions.length > 0 && (
                    <div className="ml-6 grid grid-cols-2 gap-1">
                      {divRegions.map((reg) => (
                        <div key={reg.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`reg-${reg.id}`}
                            checked={formAssociations.regionIds.has(reg.id)}
                            onCheckedChange={(checked) => toggleRegion(reg.id, !!checked)}
                          />
                          <label htmlFor={`reg-${reg.id}`} className="text-xs cursor-pointer">
                            {reg.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
      <div className="space-y-2">
        <Label htmlFor="dataDefinition">Data Definition</Label>
        <Textarea
          id="dataDefinition"
          name="dataDefinition"
          defaultValue={defaultValues?.dataDefinition ?? ""}
          placeholder="Detailed explanation of what this metric measures"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="methodology">Methodology</Label>
        <Textarea
          id="methodology"
          name="methodology"
          defaultValue={defaultValues?.methodology ?? ""}
          placeholder="How the data is calculated or collected"
          rows={3}
        />
      </div>
    </div>
  );
}
