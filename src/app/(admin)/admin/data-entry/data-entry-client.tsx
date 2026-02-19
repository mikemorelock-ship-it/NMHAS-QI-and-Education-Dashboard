"use client";

import React, { useState, useTransition, useMemo, useCallback, useEffect, useRef } from "react";
import {
  bulkCreateEntries,
  bulkDeleteEntries,
  updateEntry,
  deleteEntry,
  fetchEntriesForPeriod,
} from "@/actions/entries";
import type { PrefillEntry } from "@/actions/entries";
import type { TemplateLookupData } from "@/actions/upload";
import { UploadClient } from "@/app/(admin)/admin/upload/upload-client";
import { formatPeriod, formatMetricValue } from "@/lib/utils";
import { PaginationControls } from "@/components/PaginationControls";
import { PERIOD_TYPES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Pencil, Plus, X, Upload, CheckCircle, Filter, ListChecks, FileUp } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MetricOption {
  id: string;
  name: string;
  departmentId: string;
  unit: string;
  periodType: string;
  dataType: string;
  numeratorLabel: string | null;
  denominatorLabel: string | null;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}

interface DivisionOption {
  id: string;
  name: string;
}

interface RegionOption {
  id: string;
  name: string;
  divisionId: string;
  role: string | null;
}

interface EntryRow {
  id: string;
  metricDefinitionId: string;
  metricName: string;
  metricUnit: string;
  metricDataType: string;
  metricRateMultiplier?: number | null;
  metricRateSuffix?: string | null;
  departmentId: string;
  divisionId: string | null;
  divisionName: string | null;
  regionId: string | null;
  regionName: string | null;
  periodType: string;
  periodStart: string;
  value: number;
  numerator: number | null;
  denominator: number | null;
  notes: string | null;
}

interface AssociationsMap {
  [metricId: string]: { divisionIds: string[]; regionIds: string[] };
}

/** A row in the auto-populated single-entry table */
interface SingleEntryRow {
  key: string;
  divisionId: string | null;
  divisionName: string;
  regionId: string | null;
  regionName: string;
  value: string;
  numerator: string;
  denominator: string;
  notes: string;
  /** If this row already has a saved entry, this is its DB id */
  existingEntryId?: string;
}

interface BulkRow {
  key: number;
  metricDefinitionId: string;
  periodStart: string;
  value: string;
  notes: string;
}

let bulkRowKey = 0;

interface PrefillData {
  metricId?: string;
  periodType?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataEntryClient({
  metrics,
  divisions,
  regions,
  recentEntries,
  associationsMap,
  prefill,
  totalEntryCount,
  pagination,
  uploadLookup,
}: {
  metrics: MetricOption[];
  divisions: DivisionOption[];
  regions: RegionOption[];
  recentEntries: EntryRow[];
  associationsMap: AssociationsMap;
  prefill?: PrefillData;
  totalEntryCount: number;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  uploadLookup?: TemplateLookupData | null;
}) {
  // -----------------------------------------------------------------------
  // Single Entry state
  // -----------------------------------------------------------------------
  const [selectedMetric, setSelectedMetric] = useState<string>(prefill?.metricId ?? "");
  const [periodType, setPeriodType] = useState<string>(prefill?.periodType ?? "monthly");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [filterDivision, setFilterDivision] = useState<string>("");
  const [filterRegion, setFilterRegion] = useState<string>("");
  const [singleRows, setSingleRows] = useState<SingleEntryRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Recent entries filter state
  // -----------------------------------------------------------------------
  const [filterMetric, setFilterMetric] = useState<string>("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [deleteTarget, setDeleteTarget] = useState<EntryRow | null>(null);
  const [editTarget, setEditTarget] = useState<EntryRow | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);

  // -----------------------------------------------------------------------
  // Bulk entry state
  // -----------------------------------------------------------------------
  const [bulkDivision, setBulkDivision] = useState<string>("");
  const [bulkRegion, setBulkRegion] = useState<string>("");
  const [bulkPeriodType, setBulkPeriodType] = useState<string>("monthly");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    { key: ++bulkRowKey, metricDefinitionId: "", periodStart: "", value: "", notes: "" },
  ]);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------
  const divisionMap = useMemo(() => new Map(divisions.map((d) => [d.id, d.name])), [divisions]);
  const regionMap = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);

  const getMetricDepartmentId = (metricId: string): string =>
    metrics.find((m) => m.id === metricId)?.departmentId ?? "";

  const needsFullDate = (pt: string) => ["daily", "weekly", "bi-weekly"].includes(pt);

  // Build the auto-populated rows when a metric is selected
  const buildSingleRows = useCallback(
    (metricId: string): SingleEntryRow[] => {
      const assoc = associationsMap[metricId];
      if (!assoc) return [];

      const rows: SingleEntryRow[] = [];

      // If the metric has region-level associations, create a row per region
      if (assoc.regionIds.length > 0) {
        for (const regionId of assoc.regionIds) {
          const region = regionMap.get(regionId);
          if (!region) continue;
          const divName = divisionMap.get(region.divisionId) ?? "";
          rows.push({
            key: `r-${regionId}`,
            divisionId: region.divisionId,
            divisionName: divName,
            regionId,
            regionName: region.name,
            value: "",
            numerator: "",
            denominator: "",
            notes: "",
          });
        }
      }

      // Also add division-level rows for divisions that have associations
      // but only if there are NO region-level associations for that division
      // (to avoid double-counting)
      if (assoc.divisionIds.length > 0) {
        const divisionsWithRegions = new Set(
          assoc.regionIds.map((rid) => regionMap.get(rid)?.divisionId).filter(Boolean)
        );
        for (const divisionId of assoc.divisionIds) {
          // If this division already has region rows, skip the division-level row
          if (divisionsWithRegions.has(divisionId)) continue;
          const divName = divisionMap.get(divisionId) ?? "";
          rows.push({
            key: `d-${divisionId}`,
            divisionId,
            divisionName: divName,
            regionId: null,
            regionName: "",
            value: "",
            numerator: "",
            denominator: "",
            notes: "",
          });
        }
      }

      // Sort: by division name, then region name
      rows.sort((a, b) => {
        const divCmp = a.divisionName.localeCompare(b.divisionName);
        if (divCmp !== 0) return divCmp;
        return a.regionName.localeCompare(b.regionName);
      });

      return rows;
    },
    [associationsMap, divisionMap, regionMap]
  );

  // Filtered rows based on division/region filter
  const filteredSingleRows = useMemo(() => {
    let rows = singleRows;
    if (filterDivision && filterDivision !== "all") {
      rows = rows.filter((r) => r.divisionId === filterDivision);
    }
    if (filterRegion && filterRegion !== "all") {
      rows = rows.filter((r) => r.regionId === filterRegion);
    }
    return rows;
  }, [singleRows, filterDivision, filterRegion]);

  // Regions available for filtering (cascaded from selected division)
  const filterableRegions = useMemo(() => {
    if (!filterDivision || filterDivision === "all") {
      // Show all regions that appear in the rows
      const regionIds = new Set(singleRows.map((r) => r.regionId).filter(Boolean));
      return regions.filter((r) => regionIds.has(r.id));
    }
    return regions.filter((r) => r.divisionId === filterDivision);
  }, [filterDivision, singleRows, regions]);

  // Divisions that appear in the current rows (for the filter dropdown)
  const filterableDivisions = useMemo(() => {
    const divIds = new Set(singleRows.map((r) => r.divisionId).filter(Boolean));
    return divisions.filter((d) => divIds.has(d.id));
  }, [singleRows, divisions]);

  // Regions available for bulk entry (cascaded from selected bulk division)
  const bulkRegions = useMemo(() => {
    if (!bulkDivision || bulkDivision === "none") return [];
    return regions.filter((r) => r.divisionId === bulkDivision);
  }, [bulkDivision, regions]);

  // -----------------------------------------------------------------------
  // Prefill existing entries when metric + period are both selected
  // -----------------------------------------------------------------------
  const [prefillLoading, setPrefillLoading] = useState(false);
  const prefillAbortRef = useRef(0);

  useEffect(() => {
    if (!selectedMetric || !periodStart) return;

    const requestId = ++prefillAbortRef.current;
    setPrefillLoading(true);

    // Clear existing data from rows while we fetch fresh data for the new period
    setSingleRows((prev) =>
      prev.map((row) => ({
        ...row,
        value: "",
        numerator: "",
        denominator: "",
        notes: "",
        existingEntryId: undefined,
      }))
    );

    fetchEntriesForPeriod(selectedMetric, periodType, periodStart)
      .then((entries: PrefillEntry[]) => {
        // Abort if a newer request was started
        if (requestId !== prefillAbortRef.current) return;
        setPrefillLoading(false);

        if (entries.length === 0) return;

        const metric = metrics.find((m) => m.id === selectedMetric);

        setSingleRows((prev) =>
          prev.map((row) => {
            // Match by regionId (for region-level rows) or divisionId (for division-level rows)
            const match = entries.find((e) => {
              if (row.regionId) {
                return e.regionId === row.regionId;
              }
              // Division-level row: match on divisionId with no regionId
              return e.divisionId === row.divisionId && e.regionId === null;
            });

            if (!match) return row;

            // Apply rate multiplier to display value for rate metrics
            let displayValue = match.value;
            if (metric?.dataType === "rate" && metric.rateMultiplier) {
              displayValue = Math.round(match.value * metric.rateMultiplier * 10000) / 10000;
            }

            return {
              ...row,
              value: String(displayValue),
              numerator: match.numerator != null ? String(match.numerator) : "",
              denominator: match.denominator != null ? String(match.denominator) : "",
              notes: match.notes ?? "",
              existingEntryId: match.id,
            };
          })
        );
      })
      .catch(() => {
        if (requestId === prefillAbortRef.current) {
          setPrefillLoading(false);
        }
      });
  }, [selectedMetric, periodStart, periodType, metrics]);

  // Recent entries filtering
  const entryMetricOptions = Array.from(
    new Map(
      recentEntries.map((e) => [
        e.metricDefinitionId,
        { id: e.metricDefinitionId, name: e.metricName },
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const entryPeriodOptions = Array.from(
    new Set(recentEntries.map((e) => e.periodStart.slice(0, 7)))
  )
    .sort()
    .reverse();

  const filteredEntries = recentEntries.filter((e) => {
    if (filterMetric && e.metricDefinitionId !== filterMetric) return false;
    if (filterPeriod && !e.periodStart.startsWith(filterPeriod)) return false;
    return true;
  });

  const displayedEntries = filteredEntries.slice(0, displayLimit);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleMetricChange(value: string) {
    setSelectedMetric(value);
    setFilterDivision("");
    setFilterRegion("");
    const metric = metrics.find((m) => m.id === value);
    if (metric) {
      setPeriodType(metric.periodType);
    }
    setSingleRows(buildSingleRows(value));
  }

  function updateSingleRow(
    key: string,
    field: "value" | "numerator" | "denominator" | "notes",
    val: string
  ) {
    setSingleRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: val };
        // Auto-compute value from numerator/denominator for proportion metrics
        if (field === "numerator" || field === "denominator") {
          const metric = metrics.find((m) => m.id === selectedMetric);
          const num = parseFloat(field === "numerator" ? val : updated.numerator);
          const den = parseFloat(field === "denominator" ? val : updated.denominator);
          if (!isNaN(num) && !isNaN(den) && den > 0 && metric) {
            if (metric.dataType === "proportion") {
              updated.value = String(Math.round((num / den) * 10000) / 100); // percentage
            } else if (metric.dataType === "rate") {
              const rawRate = num / den;
              const multiplier = metric.rateMultiplier ?? 1;
              const displayValue = rawRate * multiplier;
              updated.value = String(Math.round(displayValue * 10000) / 10000);
            }
          } else {
            updated.value = "";
          }
        }
        return updated;
      })
    );
  }

  function clearMessages() {
    setSuccessMessage(null);
    setErrorMessage(null);
  }

  async function handleSingleSubmit() {
    clearMessages();

    if (!selectedMetric) {
      setErrorMessage("Please select a metric.");
      return;
    }
    if (!periodStart) {
      setErrorMessage("Please select a period start date.");
      return;
    }

    // Only submit rows with a value entered
    const rowsToSubmit = filteredSingleRows.filter((r) => r.value.trim() !== "");
    if (rowsToSubmit.length === 0) {
      setErrorMessage("Please enter a value for at least one row.");
      return;
    }

    const metric = metrics.find((m) => m.id === selectedMetric);
    const entries = rowsToSubmit.map((r) => {
      // For rate metrics, row.value is the multiplied display value — divide back to raw
      let value = parseFloat(r.value);
      if (metric?.dataType === "rate" && metric.rateMultiplier) {
        value = value / metric.rateMultiplier;
      }
      return {
        metricDefinitionId: selectedMetric,
        departmentId: getMetricDepartmentId(selectedMetric),
        divisionId: r.divisionId ?? undefined,
        regionId: r.regionId ?? undefined,
        periodType,
        periodStart,
        value,
        numerator: r.numerator ? parseFloat(r.numerator) : undefined,
        denominator: r.denominator ? parseFloat(r.denominator) : undefined,
        notes: r.notes || undefined,
        existingEntryId: r.existingEntryId,
      };
    });

    startTransition(async () => {
      try {
        const result = await bulkCreateEntries(entries);
        if (result.success) {
          setSuccessMessage(`Successfully saved ${result.count} entries.`);
          // Clear values but keep rows for another period
          setSingleRows((prev) =>
            prev.map((r) => ({
              ...r,
              value: "",
              numerator: "",
              denominator: "",
              notes: "",
              existingEntryId: undefined,
            }))
          );
          setPeriodStart("");
        } else {
          setErrorMessage(result.error || "Failed to save entries.");
        }
      } catch {
        setErrorMessage("Failed to save entries.");
      }
    });
  }

  // Bulk entry handlers
  function addBulkRow() {
    setBulkRows((prev) => [
      ...prev,
      { key: ++bulkRowKey, metricDefinitionId: "", periodStart: "", value: "", notes: "" },
    ]);
  }

  function removeBulkRow(key: number) {
    setBulkRows((prev) => prev.filter((r) => r.key !== key));
  }

  function updateBulkRow(key: number, field: keyof BulkRow, value: string) {
    setBulkRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  async function handleBulkSubmit() {
    setBulkPending(true);
    setBulkResult(null);

    const entries = bulkRows
      .filter((r) => r.metricDefinitionId && r.periodStart && r.value)
      .map((r) => ({
        metricDefinitionId: r.metricDefinitionId,
        departmentId: getMetricDepartmentId(r.metricDefinitionId),
        divisionId: bulkDivision && bulkDivision !== "none" ? bulkDivision : undefined,
        regionId: bulkRegion && bulkRegion !== "none" ? bulkRegion : undefined,
        periodType: bulkPeriodType,
        periodStart: r.periodStart,
        value: parseFloat(r.value),
        notes: r.notes || undefined,
      }));

    if (entries.length === 0) {
      setBulkResult("No valid entries to submit. Fill in metric, period, and value for each row.");
      setBulkPending(false);
      return;
    }

    try {
      const result = await bulkCreateEntries(entries);
      if (result.success) {
        setBulkResult(`Successfully created ${result.count} entries.`);
        setBulkRows([
          { key: ++bulkRowKey, metricDefinitionId: "", periodStart: "", value: "", notes: "" },
        ]);
      } else {
        setBulkResult(`Error: ${result.error}`);
      }
    } catch {
      setBulkResult("An unexpected error occurred.");
    }

    setBulkPending(false);
  }

  // Count how many single-entry rows have values
  const filledRowCount = filteredSingleRows.filter((r) => r.value.trim() !== "").length;
  // Count how many rows were prefilled with existing data
  const prefillCount = singleRows.filter((r) => r.existingEntryId).length;

  // Determine if the selected metric uses numerator/denominator entry
  const selectedMetricObj = metrics.find((m) => m.id === selectedMetric);
  const isNDMetric =
    selectedMetricObj?.dataType === "proportion" || selectedMetricObj?.dataType === "rate";
  const isRateMetric = selectedMetricObj?.dataType === "rate";
  const ndLabel = useMemo(() => {
    if (!selectedMetricObj) {
      return { num: "Numerator", den: "Denominator", rate: "Rate" };
    }
    const defaults =
      selectedMetricObj.dataType === "proportion"
        ? { num: "Compliant", den: "Total", rate: "Rate (%)" }
        : { num: "Events", den: "Exposure", rate: "Rate" };
    const rateLabel =
      selectedMetricObj.dataType === "rate" && selectedMetricObj.rateSuffix
        ? `Rate (${selectedMetricObj.rateSuffix})`
        : defaults.rate;
    return {
      num: selectedMetricObj.numeratorLabel || defaults.num,
      den: selectedMetricObj.denominatorLabel || defaults.den,
      rate: rateLabel,
    };
  }, [selectedMetricObj]);

  // Bulk delete helpers
  const allFilteredSelected =
    displayedEntries.length > 0 && displayedEntries.every((e) => selectedEntryIds.has(e.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(displayedEntries.map((e) => e.id)));
    }
  }

  function toggleSelectEntry(id: string) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkDeletePending(true);
    clearMessages();
    try {
      const result = await bulkDeleteEntries(Array.from(selectedEntryIds));
      if (result.success) {
        setSuccessMessage(
          `Successfully deleted ${result.count} ${result.count === 1 ? "entry" : "entries"}.`
        );
        setSelectedEntryIds(new Set());
      } else {
        setErrorMessage(result.error || "Failed to delete entries.");
      }
    } catch {
      setErrorMessage("Failed to delete entries.");
    }
    setBulkDeletePending(false);
    setShowBulkDeleteDialog(false);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">Data Entry</h1>
        <p className="text-muted-foreground mt-1">
          Record metric values across associated departments and time periods.
        </p>
      </div>

      <Tabs defaultValue="single" className="space-y-6">
        <TabsList>
          <TabsTrigger value="single">
            <ListChecks className="h-4 w-4 mr-1.5" />
            Entry by Metric
          </TabsTrigger>
          <TabsTrigger value="bulk">
            <Upload className="h-4 w-4 mr-1.5" />
            Freeform Bulk
          </TabsTrigger>
          {uploadLookup && (
            <TabsTrigger value="upload">
              <FileUp className="h-4 w-4 mr-1.5" />
              Upload CSV
            </TabsTrigger>
          )}
        </TabsList>

        {/* ================================================================ */}
        {/* Single Entry Tab — auto-populates rows from associations         */}
        {/* ================================================================ */}
        <TabsContent value="single" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-nmh-gray">Entry by Metric</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {successMessage && (
                <div className="mb-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {successMessage}
                  <button onClick={() => setSuccessMessage(null)} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              {errorMessage && (
                <div className="mb-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  {errorMessage}
                  <button onClick={() => setErrorMessage(null)} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Top controls: Metric, Period Type, Period Start */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>Metric</Label>
                  <Select value={selectedMetric} onValueChange={handleMetricChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      {metrics.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                          <span className="text-muted-foreground ml-1">
                            ({m.unit.charAt(0).toUpperCase() + m.unit.slice(1)})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Period Type</Label>
                  <Select value={periodType} onValueChange={setPeriodType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt}>
                          {pt.charAt(0).toUpperCase() + pt.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Period Start
                    {needsFullDate(periodType) && (
                      <span className="text-muted-foreground font-normal ml-1">(exact date)</span>
                    )}
                  </Label>
                  <Input
                    key={needsFullDate(periodType) ? "date" : "month"}
                    type={needsFullDate(periodType) ? "date" : "month"}
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
              </div>

              {/* Auto-populated rows */}
              {selectedMetric && singleRows.length > 0 && (
                <>
                  {/* Filter controls */}
                  <div className="flex flex-wrap items-end gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground mt-1.5" />
                    {filterableDivisions.length > 1 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Division</Label>
                        <Select
                          value={filterDivision || "all"}
                          onValueChange={(v) => {
                            setFilterDivision(v === "all" ? "" : v);
                            setFilterRegion("");
                          }}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Divisions</SelectItem>
                            {filterableDivisions.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {filterableRegions.length > 1 && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Department</Label>
                        <Select
                          value={filterRegion || "all"}
                          onValueChange={(v) => setFilterRegion(v === "all" ? "" : v)}
                        >
                          <SelectTrigger className="w-[200px] h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Departments</SelectItem>
                            {filterableRegions.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {(filterDivision || filterRegion) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setFilterDivision("");
                          setFilterRegion("");
                        }}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {filteredSingleRows.length} {filteredSingleRows.length === 1 ? "row" : "rows"}
                    </span>
                  </div>

                  {/* Prefill status banner */}
                  {periodStart && prefillLoading && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Loading existing data…
                    </div>
                  )}
                  {periodStart && !prefillLoading && prefillCount > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      {prefillCount} {prefillCount === 1 ? "row" : "rows"} auto-filled with existing
                      data. Editing and re-saving will update the existing{" "}
                      {prefillCount === 1 ? "entry" : "entries"}.
                    </div>
                  )}

                  {/* Entry rows table */}
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[180px]">Division</TableHead>
                          <TableHead className="w-[180px]">Department</TableHead>
                          {isNDMetric ? (
                            <>
                              <TableHead className="w-[110px]">{ndLabel.num}</TableHead>
                              <TableHead className="w-[110px]">{ndLabel.den}</TableHead>
                              {isRateMetric && selectedMetricObj?.rateMultiplier && (
                                <TableHead className="w-[70px] text-center text-muted-foreground">
                                  × {selectedMetricObj.rateMultiplier.toLocaleString()}
                                </TableHead>
                              )}
                              <TableHead className="w-[100px]">{ndLabel.rate}</TableHead>
                            </>
                          ) : (
                            <TableHead className="w-[140px]">Value</TableHead>
                          )}
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSingleRows.map((row) => (
                          <TableRow
                            key={row.key}
                            className={row.existingEntryId ? "bg-blue-50/50" : ""}
                          >
                            <TableCell className="font-medium text-sm py-2">
                              <div className="flex items-center gap-1.5">
                                {row.divisionName || (
                                  <span className="text-muted-foreground">—</span>
                                )}
                                {row.existingEntryId && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] px-1 py-0 text-blue-600 border-blue-300 bg-blue-50"
                                  >
                                    saved
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm py-2">
                              {row.regionName || (
                                <span className="text-muted-foreground italic">Division-level</span>
                              )}
                            </TableCell>
                            {isNDMetric ? (
                              <>
                                <TableCell className="py-2">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder={ndLabel.num}
                                    className="h-8"
                                    value={row.numerator}
                                    onChange={(e) =>
                                      updateSingleRow(row.key, "numerator", e.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder={ndLabel.den}
                                    className="h-8"
                                    value={row.denominator}
                                    onChange={(e) =>
                                      updateSingleRow(row.key, "denominator", e.target.value)
                                    }
                                  />
                                </TableCell>
                                {isRateMetric && selectedMetricObj?.rateMultiplier && (
                                  <TableCell className="py-2 text-center text-muted-foreground font-mono text-sm">
                                    × {selectedMetricObj.rateMultiplier.toLocaleString()}
                                  </TableCell>
                                )}
                                <TableCell className="py-2">
                                  <Input
                                    type="number"
                                    step="any"
                                    className="h-8 bg-muted/50 font-mono"
                                    value={row.value}
                                    readOnly
                                    tabIndex={-1}
                                    placeholder="--"
                                  />
                                </TableCell>
                              </>
                            ) : (
                              <TableCell className="py-2">
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="Value"
                                  className="h-8"
                                  value={row.value}
                                  onChange={(e) =>
                                    updateSingleRow(row.key, "value", e.target.value)
                                  }
                                />
                              </TableCell>
                            )}
                            <TableCell className="py-2">
                              <Input
                                placeholder="Optional notes"
                                className="h-8"
                                value={row.notes}
                                onChange={(e) => updateSingleRow(row.key, "notes", e.target.value)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals row for N/D metrics */}
                        {isNDMetric &&
                          filteredSingleRows.length > 0 &&
                          (() => {
                            const nums = filteredSingleRows
                              .map((r) => parseFloat(r.numerator))
                              .filter((n) => !isNaN(n));
                            const dens = filteredSingleRows
                              .map((r) => parseFloat(r.denominator))
                              .filter((n) => !isNaN(n));
                            const totalNum =
                              nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null;
                            const totalDen =
                              dens.length > 0 ? dens.reduce((a, b) => a + b, 0) : null;
                            let totalRate: string | null = null;
                            if (totalNum != null && totalDen != null && totalDen > 0) {
                              if (selectedMetricObj?.dataType === "proportion") {
                                totalRate = String(Math.round((totalNum / totalDen) * 10000) / 100);
                              } else if (
                                selectedMetricObj?.dataType === "rate" &&
                                selectedMetricObj.rateMultiplier
                              ) {
                                totalRate = String(
                                  Math.round(
                                    (totalNum / totalDen) * selectedMetricObj.rateMultiplier * 10000
                                  ) / 10000
                                );
                              } else {
                                totalRate = String(
                                  Math.round((totalNum / totalDen) * 10000) / 10000
                                );
                              }
                            }
                            return (
                              <TableRow className="bg-muted/30 border-t-2 font-semibold">
                                <TableCell className="py-2 text-sm" colSpan={2}>
                                  Totals
                                </TableCell>
                                <TableCell className="py-2 text-sm font-mono">
                                  {totalNum != null ? totalNum.toLocaleString() : "–"}
                                </TableCell>
                                <TableCell className="py-2 text-sm font-mono">
                                  {totalDen != null ? totalDen.toLocaleString() : "–"}
                                </TableCell>
                                {isRateMetric && selectedMetricObj?.rateMultiplier && (
                                  <TableCell className="py-2 text-center text-muted-foreground font-mono text-sm">
                                    ×
                                  </TableCell>
                                )}
                                <TableCell className="py-2 text-sm font-mono">
                                  {totalRate ?? "–"}
                                </TableCell>
                                <TableCell className="py-2" />
                              </TableRow>
                            );
                          })()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Submit */}
                  <div className="flex items-center gap-3">
                    <Button
                      className="bg-nmh-teal hover:bg-nmh-teal/90"
                      onClick={handleSingleSubmit}
                      disabled={isPending || filledRowCount === 0 || !periodStart}
                    >
                      {isPending
                        ? "Saving..."
                        : `Save ${filledRowCount} ${filledRowCount === 1 ? "Entry" : "Entries"}`}
                    </Button>
                    {prefillCount > 0 && filledRowCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Existing entries will be updated
                      </span>
                    )}
                    {!periodStart && filledRowCount > 0 && (
                      <span className="text-sm text-amber-600">
                        Select a period start date to save
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* No associations message */}
              {selectedMetric && singleRows.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>This metric has no division or department associations.</p>
                  <p className="text-sm mt-1">
                    Use the <strong>Freeform Bulk</strong> tab to enter data manually, or add
                    associations in the Metrics admin page.
                  </p>
                </div>
              )}

              {/* No metric selected */}
              {!selectedMetric && (
                <div className="text-center py-8 text-muted-foreground">
                  Select a metric above to auto-populate entry rows for all associated departments.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* Bulk Entry Tab — freeform manual rows                            */}
        {/* ================================================================ */}
        <TabsContent value="bulk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-nmh-gray flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Freeform Bulk Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bulkResult && (
                <div
                  className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                    bulkResult.startsWith("Error") || bulkResult.startsWith("No valid")
                      ? "bg-red-50 border border-red-200 text-red-700"
                      : "bg-green-50 border border-green-200 text-green-700"
                  }`}
                >
                  <CheckCircle className="h-4 w-4" />
                  {bulkResult}
                  <button onClick={() => setBulkResult(null)} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Shared fields for all bulk rows */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <Label>
                    Division <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={bulkDivision}
                    onValueChange={(v) => {
                      setBulkDivision(v);
                      setBulkRegion("");
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No division" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No division</SelectItem>
                      {divisions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    Department <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Select
                    value={bulkRegion || "none"}
                    onValueChange={(v) => setBulkRegion(v === "none" ? "" : v)}
                    disabled={!bulkDivision || bulkDivision === "none"}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {bulkRegions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period Type</Label>
                  <Select
                    value={bulkPeriodType}
                    onValueChange={(v) => {
                      if (needsFullDate(v) !== needsFullDate(bulkPeriodType)) {
                        setBulkRows((prev) => prev.map((r) => ({ ...r, periodStart: "" })));
                      }
                      setBulkPeriodType(v);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIOD_TYPES.map((pt) => (
                        <SelectItem key={pt} value={pt}>
                          {pt.charAt(0).toUpperCase() + pt.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Bulk rows */}
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_140px_120px_1fr_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Metric</span>
                  <span>Period</span>
                  <span>Value</span>
                  <span>Notes</span>
                  <span></span>
                </div>

                {bulkRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_140px_120px_1fr_40px] gap-2 items-center"
                  >
                    <Select
                      value={row.metricDefinitionId}
                      onValueChange={(v) => updateBulkRow(row.key, "metricDefinitionId", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select metric" />
                      </SelectTrigger>
                      <SelectContent>
                        {metrics.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      type={needsFullDate(bulkPeriodType) ? "date" : "month"}
                      value={row.periodStart}
                      onChange={(e) => updateBulkRow(row.key, "periodStart", e.target.value)}
                    />

                    <Input
                      type="number"
                      step="any"
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => updateBulkRow(row.key, "value", e.target.value)}
                    />

                    <Input
                      placeholder="Notes (optional)"
                      value={row.notes}
                      onChange={(e) => updateBulkRow(row.key, "notes", e.target.value)}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBulkRow(row.key)}
                      disabled={bulkRows.length <= 1}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={addBulkRow}>
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>
                <Button
                  type="button"
                  className="bg-nmh-teal hover:bg-nmh-teal/90"
                  onClick={handleBulkSubmit}
                  disabled={bulkPending}
                >
                  {bulkPending
                    ? "Saving..."
                    : `Save ${bulkRows.filter((r) => r.metricDefinitionId && r.value).length} Entries`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* Upload CSV Tab                                                   */}
        {/* ================================================================ */}
        {uploadLookup && (
          <TabsContent value="upload" className="space-y-6">
            <UploadClient lookup={uploadLookup} />
          </TabsContent>
        )}
      </Tabs>

      {/* ================================================================ */}
      {/* Recent Entries Table                                              */}
      {/* ================================================================ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-nmh-gray">Recent Entries</CardTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Showing {displayedEntries.length}
                {displayedEntries.length < filteredEntries.length
                  ? ` of ${filteredEntries.length}`
                  : ""}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span>Total: {totalEntryCount.toLocaleString()}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
            <Filter className="h-4 w-4 text-muted-foreground mt-1.5 hidden sm:block" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Metric</Label>
              <Select
                value={filterMetric || "all"}
                onValueChange={(v) => setFilterMetric(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-[220px] h-8 text-sm">
                  <SelectValue placeholder="All metrics" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All metrics</SelectItem>
                  {entryMetricOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Period</Label>
              <Select
                value={filterPeriod || "all"}
                onValueChange={(v) => setFilterPeriod(v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-[160px] h-8 text-sm">
                  <SelectValue placeholder="All periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All periods</SelectItem>
                  {entryPeriodOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {formatPeriod(p + "-01T12:00:00.000Z")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Show</Label>
              <Select
                value={String(displayLimit)}
                onValueChange={(v) => setDisplayLimit(Number(v))}
              >
                <SelectTrigger className="w-[100px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(filterMetric || filterPeriod) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setFilterMetric("");
                  setFilterPeriod("");
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>

          {/* Floating bulk action bar */}
          {selectedEntryIds.size > 0 && (
            <div className="mb-4 p-3 bg-nmh-teal/10 border border-nmh-teal/30 rounded-lg flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedEntryIds.size} {selectedEntryIds.size === 1 ? "entry" : "entries"} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedEntryIds(new Set())}>
                  Clear Selection
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteDialog(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {displayedEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No entries found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all entries"
                    />
                  </TableHead>
                  <TableHead>Metric</TableHead>
                  <TableHead>Division</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedEntries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    data-state={selectedEntryIds.has(entry.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedEntryIds.has(entry.id)}
                        onCheckedChange={() => toggleSelectEntry(entry.id)}
                        aria-label={`Select entry for ${entry.metricName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{entry.metricName}</TableCell>
                    <TableCell>
                      {entry.divisionName ?? <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell>
                      {entry.regionName ?? <span className="text-muted-foreground">--</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {formatPeriod(entry.periodStart, entry.periodType)}
                        <Badge variant="outline" className="text-[10px] px-1">
                          {entry.periodType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMetricValue(
                        entry.value,
                        entry.metricUnit,
                        entry.metricRateMultiplier,
                        entry.metricRateSuffix
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => setEditTarget(entry)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(entry)}
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

          {/* Server-side pagination controls */}
          {pagination && (
            <PaginationControls
              pagination={pagination}
              basePath="/admin/data-entry"
              searchParams={{}}
            />
          )}
        </CardContent>
      </Card>

      {/* ================================================================ */}
      {/* Edit Entry Dialog                                                 */}
      {/* ================================================================ */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
            <DialogDescription>
              Update the entry for &quot;{editTarget?.metricName}&quot;
              {editTarget?.divisionName ? ` (${editTarget.divisionName})` : ""}
              {editTarget?.regionName ? ` / ${editTarget.regionName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <EditEntryForm
              editTarget={editTarget}
              metrics={metrics}
              isPending={isPending}
              needsFullDate={needsFullDate}
              onSuccess={() => {
                setSuccessMessage("Entry updated successfully.");
                setEditTarget(null);
              }}
              onError={(msg) => setErrorMessage(msg)}
              onCancel={() => setEditTarget(null)}
              clearMessages={clearMessages}
              startTransition={startTransition}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Delete Confirmation                                               */}
      {/* ================================================================ */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this entry for &quot;
              {deleteTarget?.metricName}&quot; (
              {deleteTarget
                ? formatMetricValue(
                    deleteTarget.value,
                    deleteTarget.metricUnit,
                    deleteTarget.metricRateMultiplier,
                    deleteTarget.metricRateSuffix
                  )
                : ""}
              )? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <form
              action={async () => {
                if (deleteTarget) {
                  await deleteEntry(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              <Button type="submit" variant="destructive">
                Delete Entry
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Bulk Delete Confirmation                                         */}
      {/* ================================================================ */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedEntryIds.size} {selectedEntryIds.size === 1 ? "Entry" : "Entries"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedEntryIds.size}{" "}
              {selectedEntryIds.size === 1 ? "entry" : "entries"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={bulkDeletePending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeletePending}>
              {bulkDeletePending
                ? "Deleting..."
                : `Delete ${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? "Entry" : "Entries"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Entry Form — supports numerator/denominator for proportion/rate metrics
// ---------------------------------------------------------------------------

function EditEntryForm({
  editTarget,
  metrics,
  isPending,
  needsFullDate,
  onSuccess,
  onError,
  onCancel,
  clearMessages,
  startTransition,
}: {
  editTarget: EntryRow;
  metrics: MetricOption[];
  isPending: boolean;
  needsFullDate: (pt: string) => boolean;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
  clearMessages: () => void;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const metricDef = metrics.find((m) => m.id === editTarget.metricDefinitionId);
  const isND = metricDef?.dataType === "proportion" || metricDef?.dataType === "rate";

  const isRateType = metricDef?.dataType === "rate";

  // Resolve custom labels with fallbacks
  const labels = useMemo(() => {
    if (!metricDef) return { num: "Numerator", den: "Denominator", rate: "Value" };
    const defaults =
      metricDef.dataType === "proportion"
        ? { num: "Compliant", den: "Total", rate: "Rate (%)" }
        : { num: "Events", den: "Exposure", rate: "Rate" };
    const rateLabel =
      metricDef.dataType === "rate" && metricDef.rateSuffix
        ? `Rate (${metricDef.rateSuffix})`
        : defaults.rate;
    return {
      num: metricDef.numeratorLabel || defaults.num,
      den: metricDef.denominatorLabel || defaults.den,
      rate: rateLabel,
    };
  }, [metricDef]);

  const [editNum, setEditNum] = useState(
    editTarget.numerator != null ? String(editTarget.numerator) : ""
  );
  const [editDen, setEditDen] = useState(
    editTarget.denominator != null ? String(editTarget.denominator) : ""
  );
  // For rate metrics, display the multiplied value; raw value goes to server
  const initialDisplayValue =
    isRateType && metricDef?.rateMultiplier
      ? editTarget.value * metricDef.rateMultiplier
      : editTarget.value;
  const [editValue, setEditValue] = useState(String(initialDisplayValue));
  const [rawEditValue, setRawEditValue] = useState(String(editTarget.value));

  // Auto-compute value from numerator/denominator
  function handleNDChange(field: "num" | "den", val: string) {
    const newNum = field === "num" ? val : editNum;
    const newDen = field === "den" ? val : editDen;
    if (field === "num") setEditNum(val);
    else setEditDen(val);

    const num = parseFloat(newNum);
    const den = parseFloat(newDen);
    if (!isNaN(num) && !isNaN(den) && den > 0 && metricDef) {
      if (metricDef.dataType === "proportion") {
        const computed = String(Math.round((num / den) * 10000) / 100);
        setEditValue(computed);
        setRawEditValue(computed);
      } else if (metricDef.dataType === "rate") {
        const rawRate = num / den;
        const multiplier = metricDef.rateMultiplier ?? 1;
        const displayValue = Math.round(rawRate * multiplier * 10000) / 10000;
        setEditValue(String(displayValue));
        setRawEditValue(String(Math.round(rawRate * 10000) / 10000));
      }
    } else {
      setEditValue("");
      setRawEditValue("");
    }
  }

  return (
    <form
      action={async (formData) => {
        clearMessages();
        startTransition(async () => {
          try {
            const result = await updateEntry(editTarget.id, formData);
            if (result.success) {
              onSuccess();
            } else {
              onError(result.error || "Failed to update entry.");
            }
          } catch {
            onError("Failed to update entry.");
          }
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="metricDefinitionId" value={editTarget.metricDefinitionId} />
      <input type="hidden" name="departmentId" value={editTarget.departmentId} />
      <input type="hidden" name="divisionId" value={editTarget.divisionId ?? ""} />
      <input type="hidden" name="regionId" value={editTarget.regionId ?? ""} />
      <input type="hidden" name="periodType" value={editTarget.periodType} />

      <div className="space-y-2">
        <Label htmlFor="edit-periodStart">Period Start</Label>
        <Input
          id="edit-periodStart"
          name="periodStart"
          type={needsFullDate(editTarget.periodType) ? "date" : "month"}
          defaultValue={
            needsFullDate(editTarget.periodType)
              ? editTarget.periodStart.slice(0, 10)
              : editTarget.periodStart.slice(0, 7)
          }
          required
        />
      </div>

      {isND ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-numerator">{labels.num}</Label>
              <Input
                id="edit-numerator"
                name="numerator"
                type="number"
                step="1"
                min="0"
                placeholder={labels.num}
                value={editNum}
                onChange={(e) => handleNDChange("num", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-denominator">{labels.den}</Label>
              <Input
                id="edit-denominator"
                name="denominator"
                type="number"
                step="1"
                min="0"
                placeholder={labels.den}
                value={editDen}
                onChange={(e) => handleNDChange("den", e.target.value)}
              />
            </div>
          </div>
          {isRateType && metricDef?.rateMultiplier && (
            <div className="flex items-center justify-center text-muted-foreground font-mono text-sm py-1">
              × {metricDef.rateMultiplier.toLocaleString()}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-value">
              {labels.rate}{" "}
              <span className="text-muted-foreground font-normal">(auto-computed)</span>
            </Label>
            <input type="hidden" name="value" value={rawEditValue} />
            <Input
              id="edit-value"
              type="number"
              step="any"
              className="bg-muted/50 font-mono"
              value={editValue}
              readOnly
              tabIndex={-1}
            />
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="edit-value">Value</Label>
          <Input
            id="edit-value"
            name="value"
            type="number"
            step="any"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="edit-notes">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="edit-notes"
          name="notes"
          defaultValue={editTarget.notes ?? ""}
          placeholder="Optional notes"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-nmh-teal hover:bg-nmh-teal/90" disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
