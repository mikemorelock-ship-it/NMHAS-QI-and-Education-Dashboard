"use client";

import { useState, useMemo, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  toggleCampaignActive,
} from "@/actions/campaigns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCcw,
  LayoutList,
  LayoutGrid,
  GanttChartSquare,
  GitBranchPlus,
  ListChecks,
  Calendar,
  User,
  Building2,
  Loader2,
} from "lucide-react";
import { CampaignGanttChart } from "@/components/qi/CampaignGanttChart";
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  goals: string | null;
  keyFindings: string | null;
  status: string;
  isActive: boolean;
  sortOrder: number;
  ownerId: string | null;
  ownerName: string | null;
  metricDefinitionId: string | null;
  metricName: string | null;
  divisionIds: string[];
  divisionNames: string[];
  regionIds: string[];
  regionNames: string[];
  startDate: string | null;
  endDate: string | null;
  diagramCount: number;
  actionItemCount: number;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface MetricOption {
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

interface Props {
  campaigns: CampaignRow[];
  users: UserOption[];
  metrics: MetricOption[];
  divisions: DivisionOption[];
  regions: RegionOption[];
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const color = CAMPAIGN_STATUS_COLORS[status] ?? "#4b4f54";
  return (
    <Badge variant="secondary" style={{ backgroundColor: `${color}20`, color }}>
      {CAMPAIGN_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Scope label helper
// ---------------------------------------------------------------------------

function scopeLabel(c: CampaignRow): string | null {
  if (c.regionNames.length > 0) return c.regionNames.join(", ");
  if (c.divisionNames.length > 0) return c.divisionNames.join(", ");
  return null;
}

// ---------------------------------------------------------------------------
// Form fields (with metric + multi-select division/department)
// ---------------------------------------------------------------------------

function CampaignFormFields({
  users,
  metrics,
  divisions,
  regions,
  defaults,
}: {
  users: UserOption[];
  metrics: MetricOption[];
  divisions: DivisionOption[];
  regions: RegionOption[];
  defaults?: Partial<CampaignRow>;
}) {
  const [selectedMetricId, setSelectedMetricId] = useState(
    defaults?.metricDefinitionId ?? "__none__"
  );
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<Set<string>>(
    new Set(defaults?.divisionIds ?? [])
  );
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(
    new Set(defaults?.regionIds ?? [])
  );
  const [scopeMode, setScopeMode] = useState<"default" | "custom">(
    defaults?.metricDefinitionId && (defaults?.divisionIds?.length || defaults?.regionIds?.length)
      ? "custom"
      : "default"
  );
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  const [metricDefaults, setMetricDefaults] = useState<{
    divisionIds: string[];
    regionIds: string[];
  } | null>(null);

  // Fetch metric associations when metric changes
  const fetchAssociations = useCallback(async (metricId: string) => {
    if (!metricId || metricId === "__none__") {
      setMetricDefaults(null);
      setScopeMode("custom");
      return;
    }
    setLoadingAssociations(true);
    try {
      const res = await fetch(`/api/metrics/${metricId}/associations`);
      if (res.ok) {
        const data = await res.json();
        setMetricDefaults({
          divisionIds: data.divisionIds ?? [],
          regionIds: data.regionIds ?? [],
        });
        // Default to accepting the metric's scope
        setScopeMode("default");
        setSelectedDivisionIds(new Set(data.divisionIds ?? []));
        setSelectedRegionIds(new Set(data.regionIds ?? []));
      }
    } catch {
      // silently fail — user can still select manually
    } finally {
      setLoadingAssociations(false);
    }
  }, []);

  function handleMetricChange(value: string) {
    setSelectedMetricId(value);
    if (value !== "__none__") {
      fetchAssociations(value);
    } else {
      setMetricDefaults(null);
      setScopeMode("custom");
      setSelectedDivisionIds(new Set());
      setSelectedRegionIds(new Set());
    }
  }

  function handleAcceptDefaults() {
    if (metricDefaults) {
      setSelectedDivisionIds(new Set(metricDefaults.divisionIds));
      setSelectedRegionIds(new Set(metricDefaults.regionIds));
      setScopeMode("default");
    }
  }

  function handleCustomize() {
    setScopeMode("custom");
  }

  function toggleDivision(divisionId: string) {
    setSelectedDivisionIds((prev) => {
      const next = new Set(prev);
      if (next.has(divisionId)) {
        next.delete(divisionId);
      } else {
        next.add(divisionId);
      }
      return next;
    });
    setScopeMode("custom");
  }

  function toggleRegion(regionId: string) {
    setSelectedRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
    setScopeMode("custom");
  }

  // Group regions by division for display
  const regionsByDivision = useMemo(() => {
    const map = new Map<string, RegionOption[]>();
    for (const r of regions) {
      const list = map.get(r.divisionId) ?? [];
      list.push(r);
      map.set(r.divisionId, list);
    }
    return map;
  }, [regions]);

  // On initial load for editing, if the campaign already has a metric, load defaults for comparison
  useEffect(() => {
    if (defaults?.metricDefinitionId) {
      // Load metric defaults so we can show the accept/customize toggle
      fetch(`/api/metrics/${defaults.metricDefinitionId}/associations`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setMetricDefaults({
              divisionIds: data.divisionIds ?? [],
              regionIds: data.regionIds ?? [],
            });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" defaultValue={defaults?.name ?? ""} required maxLength={150} />
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
      <div>
        <Label htmlFor="goals">Goals / Objectives</Label>
        <Textarea
          id="goals"
          name="goals"
          defaultValue={defaults?.goals ?? ""}
          rows={3}
          maxLength={2000}
          placeholder="One goal per line, e.g.:&#10;- Reduce response time to under 8 min&#10;- Deploy in all divisions"
        />
      </div>
      <div>
        <Label htmlFor="keyFindings">Key Findings / Summary of Learning</Label>
        <Textarea
          id="keyFindings"
          name="keyFindings"
          defaultValue={defaults?.keyFindings ?? ""}
          rows={4}
          maxLength={5000}
          placeholder="Summarize key findings, lessons learned, and interpretations of the data..."
        />
      </div>

      {/* Metric Selection */}
      <div>
        <Label htmlFor="metricDefinitionId">Associated Metric</Label>
        <Select
          name="metricDefinitionId"
          value={selectedMetricId}
          onValueChange={handleMetricChange}
        >
          <SelectTrigger id="metricDefinitionId">
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

      {/* Metric scope prompt — shown when a metric is selected and has defaults */}
      {selectedMetricId !== "__none__" && loadingAssociations && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading metric scope...
        </div>
      )}

      {selectedMetricId !== "__none__" && !loadingAssociations && metricDefaults && (
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium">Campaign Scope</p>
          <p className="text-xs text-muted-foreground">
            This metric is associated with{" "}
            {metricDefaults.divisionIds.length > 0 &&
              `${metricDefaults.divisionIds.length} division${metricDefaults.divisionIds.length !== 1 ? "s" : ""}`}
            {metricDefaults.divisionIds.length > 0 &&
              metricDefaults.regionIds.length > 0 &&
              " and "}
            {metricDefaults.regionIds.length > 0 &&
              `${metricDefaults.regionIds.length} department${metricDefaults.regionIds.length !== 1 ? "s" : ""}`}
            {metricDefaults.divisionIds.length === 0 &&
              metricDefaults.regionIds.length === 0 &&
              "no divisions or departments"}
            .
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={scopeMode === "default" ? "default" : "outline"}
              size="sm"
              onClick={handleAcceptDefaults}
            >
              Accept defaults
            </Button>
            <Button
              type="button"
              variant={scopeMode === "custom" ? "default" : "outline"}
              size="sm"
              onClick={handleCustomize}
            >
              Customize
            </Button>
          </div>
        </div>
      )}

      {/* Division multi-select */}
      {(selectedMetricId === "__none__" || scopeMode === "custom" || scopeMode === "default") && (
        <div className="space-y-2">
          <Label>Divisions</Label>
          <div className="rounded-md border p-3 max-h-40 overflow-y-auto space-y-2">
            {divisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No divisions available</p>
            ) : (
              divisions.map((d) => (
                <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedDivisionIds.has(d.id)}
                    onCheckedChange={() => toggleDivision(d.id)}
                    disabled={scopeMode === "default"}
                  />
                  <span className="text-sm">{d.name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}

      {/* Department (Region) multi-select — grouped by division */}
      {(selectedMetricId === "__none__" || scopeMode === "custom" || scopeMode === "default") && (
        <div className="space-y-2">
          <Label>Departments</Label>
          <div className="rounded-md border p-3 max-h-48 overflow-y-auto space-y-3">
            {divisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No departments available</p>
            ) : (
              divisions.map((d) => {
                const divRegions = regionsByDivision.get(d.id) ?? [];
                if (divRegions.length === 0) return null;
                return (
                  <div key={d.id}>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{d.name}</p>
                    <div className="space-y-1 pl-2">
                      {divRegions.map((r) => (
                        <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selectedRegionIds.has(r.id)}
                            onCheckedChange={() => toggleRegion(r.id)}
                            disabled={scopeMode === "default"}
                          />
                          <span className="text-sm">{r.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Hidden inputs to submit multi-select values */}
      {Array.from(selectedDivisionIds).map((id) => (
        <input key={`div-${id}`} type="hidden" name="divisionIds[]" value={id} />
      ))}
      {Array.from(selectedRegionIds).map((id) => (
        <input key={`reg-${id}`} type="hidden" name="regionIds[]" value={id} />
      ))}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={defaults?.status ?? "planning"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CAMPAIGN_STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ownerId">Owner</Label>
          <Select name="ownerId" defaultValue={defaults?.ownerId ?? "__none__"}>
            <SelectTrigger id="ownerId">
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={defaults?.startDate ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={defaults?.endDate ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="sortOrder">Sort Order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={defaults?.sortOrder ?? 0}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CampaignsClient({ campaigns, users, metrics, divisions, regions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<CampaignRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CampaignRow | null>(null);

  // View & filter state
  const [view, setView] = useState<string>("gantt");
  const [filterStatus, setFilterStatus] = useState("__all__");
  const [filterOwner, setFilterOwner] = useState("__all__");

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (filterStatus !== "__all__" && c.status !== filterStatus) return false;
      if (filterOwner !== "__all__") {
        if (filterOwner === "__none__" && c.ownerId !== null) return false;
        if (filterOwner !== "__none__" && c.ownerId !== filterOwner) return false;
      }
      return true;
    });
  }, [campaigns, filterStatus, filterOwner]);

  const hasFilters = filterStatus !== "__all__" || filterOwner !== "__all__";

  // Unique owners for filter
  const ownerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of campaigns) {
      if (c.ownerId && c.ownerName) seen.set(c.ownerId, c.ownerName);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [campaigns]);

  function stripNone(fd: FormData) {
    for (const [key, val] of Array.from(fd.entries())) {
      if (val === "__none__" && !key.endsWith("[]")) fd.set(key, "");
    }
  }

  function handleCreate(fd: FormData) {
    stripNone(fd);
    startTransition(async () => {
      const res = await createCampaign(fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setShowCreate(false);
    });
  }

  function handleEdit(fd: FormData) {
    if (!editTarget) return;
    stripNone(fd);
    startTransition(async () => {
      const res = await updateCampaign(editTarget.id, fd);
      if (!res.success) setError(res.error ?? "Failed");
      else setEditTarget(null);
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteCampaign(deleteTarget.id);
      if (!res.success) setError(res.error ?? "Failed");
      else setDeleteTarget(null);
    });
  }

  function handleToggle(c: CampaignRow) {
    startTransition(async () => {
      const res = await toggleCampaignActive(c.id, !c.isActive);
      if (!res.success) setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray">QI Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage quality improvement campaigns and initiatives
          </p>
        </div>
        <Button
          className="shrink-0 self-start sm:self-auto"
          onClick={() => {
            setError(null);
            setShowCreate(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Tabs value={view} onValueChange={setView}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="table" className="gap-1.5">
              <LayoutList className="h-4 w-4" /> Table
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-1.5">
              <LayoutGrid className="h-4 w-4" /> Cards
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-1.5">
              <GanttChartSquare className="h-4 w-4" /> Gantt
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {Object.entries(CAMPAIGN_STATUS_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Owners</SelectItem>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {ownerOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus("__all__");
                  setFilterOwner("__all__");
                }}
              >
                <RefreshCcw className="h-3 w-3 mr-1" /> Reset
              </Button>
            )}
          </div>
        </div>

        {/* Table View */}
        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-center">Diagrams</TableHead>
                    <TableHead className="text-center">Action Items</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        {hasFilters
                          ? "No campaigns match the current filters."
                          : "No campaigns yet. Create one to get started."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCampaigns.map((c) => (
                      <TableRow key={c.id} className={c.isActive ? "" : "opacity-50"}>
                        <TableCell>
                          <Link
                            href={`/admin/campaigns/${c.id}`}
                            className="font-medium hover:text-nmh-teal flex items-center gap-1"
                          >
                            {c.name}
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {scopeLabel(c) ?? "Org-wide"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.ownerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.startDate ?? "—"} → {c.endDate ?? "—"}
                        </TableCell>
                        <TableCell className="text-center">{c.diagramCount}</TableCell>
                        <TableCell className="text-center">{c.actionItemCount}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggle(c)}
                              title={c.isActive ? "Deactivate" : "Activate"}
                            >
                              {c.isActive ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setError(null);
                                setEditTarget(c);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cards View */}
        <TabsContent value="cards" className="mt-4">
          {filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {hasFilters
                  ? "No campaigns match the current filters."
                  : "No campaigns yet. Create one to get started."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCampaigns.map((c) => (
                <Card
                  key={c.id}
                  className={`transition-shadow hover:shadow-md ${!c.isActive ? "opacity-50" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/campaigns/${c.id}`}
                        className="font-semibold hover:text-nmh-teal flex items-center gap-1 min-w-0"
                      >
                        <span className="truncate">{c.name}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                      </Link>
                      <span className="shrink-0">
                        <StatusBadge status={c.status} />
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {c.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {c.ownerName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {c.ownerName}
                        </span>
                      )}
                      {scopeLabel(c) && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {scopeLabel(c)}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <GitBranchPlus className="h-3 w-3" /> {c.diagramCount} diagram
                        {c.diagramCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <ListChecks className="h-3 w-3" /> {c.actionItemCount} action
                        {c.actionItemCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {(c.startDate || c.endDate) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {c.startDate ?? "—"} → {c.endDate ?? "—"}
                      </div>
                    )}

                    <div className="flex items-center gap-1 pt-1 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(c)}
                        title={c.isActive ? "Deactivate" : "Activate"}
                      >
                        {c.isActive ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setError(null);
                          setEditTarget(c);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Gantt View */}
        <TabsContent value="gantt" className="mt-4">
          <CampaignGanttChart
            campaigns={filteredCampaigns.map((c) => ({
              id: c.id,
              name: c.name,
              linkId: c.id,
              status: c.status,
              ownerName: c.ownerName,
              startDate: c.startDate,
              endDate: c.endDate,
            }))}
            linkPrefix="/admin/campaigns"
          />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
          </DialogHeader>
          <form action={handleCreate}>
            <CampaignFormFields
              users={users}
              metrics={metrics}
              divisions={divisions}
              regions={regions}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form action={handleEdit}>
              <CampaignFormFields
                users={users}
                metrics={metrics}
                divisions={divisions}
                regions={regions}
                defaults={editTarget}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
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

      {/* Delete Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? Associated driver
            diagrams will be unlinked (not deleted).
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
