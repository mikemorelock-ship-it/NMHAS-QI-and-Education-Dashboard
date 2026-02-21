"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Filter, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScorecardTable } from "@/components/dashboard/ScorecardTable";
import type { ScorecardData, FilterOptions, ScorecardPresetData } from "@/types";

function ScorecardSkeleton() {
  return (
    <div className="rounded-xl border overflow-hidden animate-pulse">
      <div className="bg-nmh-gray/50 px-5 py-3">
        <div className="h-5 w-48 bg-white/30 rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

export default function ScorecardsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState<Set<string>>(new Set());
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(new Set());
  const [kpiOnly, setKpiOnly] = useState(false);
  const [selectedMetricIds, setSelectedMetricIds] = useState<Set<string>>(new Set());

  // Track active scorecard ID for per-scorecard sort order + groupName
  const [activeScorecardId, setActiveScorecardId] = useState<string | null>(null);

  // Popover open state
  const [divPopoverOpen, setDivPopoverOpen] = useState(false);
  const [deptPopoverOpen, setDeptPopoverOpen] = useState(false);

  // Fetch filter options on mount
  useEffect(() => {
    async function loadFilters() {
      try {
        const res = await fetch("/api/dashboard/filters");
        if (res.ok) {
          const data = await res.json();
          setFilters(data);
        }
      } catch (err) {
        console.error("Failed to load filters:", err);
      }
    }
    loadFilters();
  }, []);

  // Filtered department (region) options based on selected divisions
  const filteredRegions = filters
    ? selectedDivisionIds.size > 0
      ? filters.regions.filter((r) => selectedDivisionIds.has(r.divisionId))
      : filters.regions
    : [];

  const fetchScorecards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year) });
      if (selectedDivisionIds.size > 0) {
        params.set("divisionIds", Array.from(selectedDivisionIds).join(","));
      }
      if (selectedRegionIds.size > 0) {
        params.set("regionIds", Array.from(selectedRegionIds).join(","));
      }
      if (kpiOnly) params.set("kpiOnly", "true");
      if (selectedMetricIds.size > 0) {
        params.set("metricIds", Array.from(selectedMetricIds).join(","));
      }
      if (activeScorecardId) {
        params.set("scorecardId", activeScorecardId);
      }

      const res = await fetch(`/api/dashboard/scorecards?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch scorecards");
      const data = await res.json();
      setScorecard(data.scorecard);
    } catch (err) {
      console.error("Failed to fetch scorecards:", err);
      setScorecard({ metrics: [], months: [], year, presets: [] });
    } finally {
      setLoading(false);
    }
  }, [year, selectedDivisionIds, selectedRegionIds, kpiOnly, selectedMetricIds, activeScorecardId]);

  useEffect(() => {
    fetchScorecards();
  }, [fetchScorecards]);

  // Year options: current year down to 2024
  const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => currentYear - i);

  function toggleDivision(divId: string) {
    setActiveScorecardId(null); // Manual filter change clears preset sort/group
    setSelectedDivisionIds((prev) => {
      const next = new Set(prev);
      if (next.has(divId)) {
        next.delete(divId);
        // Also remove any regions under this division
        if (filters) {
          const regionIdsToRemove = filters.regions
            .filter((r) => r.divisionId === divId)
            .map((r) => r.id);
          setSelectedRegionIds((prevRegs) => {
            const nextRegs = new Set(prevRegs);
            for (const rid of regionIdsToRemove) {
              nextRegs.delete(rid);
            }
            return nextRegs;
          });
        }
      } else {
        next.add(divId);
        // Auto-select all departments (regions) in this division
        if (filters) {
          const regionIdsToAdd = filters.regions
            .filter((r) => r.divisionId === divId)
            .map((r) => r.id);
          setSelectedRegionIds((prevRegs) => {
            const nextRegs = new Set(prevRegs);
            for (const rid of regionIdsToAdd) {
              nextRegs.add(rid);
            }
            return nextRegs;
          });
        }
      }
      return next;
    });
  }

  function toggleRegion(regId: string) {
    setActiveScorecardId(null); // Manual filter change clears preset sort/group
    setSelectedRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) {
        next.delete(regId);
      } else {
        next.add(regId);
      }
      return next;
    });
  }

  function clearFilters() {
    setSelectedDivisionIds(new Set());
    setSelectedRegionIds(new Set());
    setKpiOnly(false);
    setSelectedMetricIds(new Set());
    setActiveScorecardId(null);
  }

  const hasFilters =
    selectedDivisionIds.size > 0 ||
    selectedRegionIds.size > 0 ||
    kpiOnly ||
    selectedMetricIds.size > 0;

  // Get display names for selected items
  function getSelectedDivisionNames(): string[] {
    if (!filters) return [];
    return filters.divisions.filter((d) => selectedDivisionIds.has(d.id)).map((d) => d.name);
  }

  function getSelectedRegionNames(): string[] {
    if (!filters) return [];
    return filters.regions.filter((r) => selectedRegionIds.has(r.id)).map((r) => r.name);
  }

  const selectedDivNames = getSelectedDivisionNames();
  const selectedRegNames = getSelectedRegionNames();

  // Presets
  const allPresets: ScorecardPresetData[] = scorecard?.presets ?? [];

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scorecards</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monthly performance scorecards for EMS operations.
          </p>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        {/* Year */}
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Multi-select Division */}
        <Popover open={divPopoverOpen} onOpenChange={setDivPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-between font-normal">
              <span className="truncate">
                {selectedDivisionIds.size === 0
                  ? "All Divisions"
                  : selectedDivisionIds.size === 1
                    ? selectedDivNames[0]
                    : `${selectedDivisionIds.size} divisions`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[240px] p-2"
            align="start"
            onWheel={(e) => e.stopPropagation()}
          >
            <div
              className="space-y-1 max-h-[300px] overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {(filters?.divisions ?? []).map((div) => (
                <label
                  key={div.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedDivisionIds.has(div.id)}
                    onCheckedChange={() => toggleDivision(div.id)}
                  />
                  <span className="text-sm">{div.name}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Multi-select Department (Region in DB) */}
        <Popover open={deptPopoverOpen} onOpenChange={setDeptPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[200px] justify-between font-normal"
              disabled={filteredRegions.length === 0}
            >
              <span className="truncate">
                {selectedRegionIds.size === 0
                  ? "All Departments"
                  : selectedRegionIds.size === 1
                    ? selectedRegNames[0]
                    : `${selectedRegionIds.size} departments`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[240px] p-2"
            align="start"
            onWheel={(e) => e.stopPropagation()}
          >
            <div
              className="space-y-1 max-h-[300px] overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              {filteredRegions.map((reg) => (
                <label
                  key={reg.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={selectedRegionIds.has(reg.id)}
                    onCheckedChange={() => toggleRegion(reg.id)}
                  />
                  <span className="text-sm">{reg.name}</span>
                </label>
              ))}
              {filteredRegions.length === 0 && (
                <p className="text-sm text-muted-foreground px-2 py-2">Select a division first.</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* KPI Toggle */}
        <Button
          variant={kpiOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setKpiOnly(!kpiOnly)}
          className={kpiOnly ? "bg-nmh-teal hover:bg-nmh-teal/90 text-white" : ""}
        >
          KPIs Only
        </Button>

        {/* Clear button */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {(selectedDivNames.length > 0 || selectedRegNames.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedDivNames.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="bg-nmh-teal/10 text-nmh-teal border-nmh-teal/20"
            >
              {name}
            </Badge>
          ))}
          {selectedRegNames.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="bg-nmh-orange/10 text-nmh-orange border-nmh-orange/20"
            >
              {name}
            </Badge>
          ))}
        </div>
      )}

      {/* Preset Chips */}
      {allPresets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Quick Filters:</span>
          {allPresets.map((preset) => (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                // Apply preset filters — overrule current filtering
                // Set the active scorecard ID for per-scorecard sort + grouping
                setActiveScorecardId(preset.id);

                // Apply multi-select divisions
                if (preset.divisionIds.length > 0) {
                  setSelectedDivisionIds(new Set(preset.divisionIds));
                  // Auto-select all departments in those divisions
                  if (filters) {
                    const regionIdsToAdd = filters.regions
                      .filter((r) => preset.divisionIds.includes(r.divisionId))
                      .map((r) => r.id);
                    setSelectedRegionIds(new Set(regionIdsToAdd));
                  } else {
                    setSelectedRegionIds(new Set());
                  }
                } else {
                  setSelectedDivisionIds(new Set());
                }

                // Apply multi-select regions (overrides division auto-select if specified)
                if (preset.regionIds.length > 0) {
                  setSelectedRegionIds(new Set(preset.regionIds));
                } else if (preset.divisionIds.length === 0) {
                  setSelectedRegionIds(new Set());
                }

                // Apply metric selection from preset
                if (preset.metricIds && preset.metricIds.length > 0) {
                  setSelectedMetricIds(new Set(preset.metricIds));
                } else {
                  setSelectedMetricIds(new Set());
                }
                setKpiOnly(false);
              }}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <ScorecardSkeleton />
      ) : scorecard && scorecard.metrics.length > 0 ? (
        <ScorecardTable scorecard={scorecard} />
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">
            {hasFilters
              ? "No metrics found for the selected filters."
              : `No metric data available for ${year}.`}
          </p>
          <p className="text-sm mt-1">
            {hasFilters
              ? "Try adjusting your filters or clearing them. Metrics must have division/department associations to appear when filtering."
              : "Data can be entered through the admin portal."}
          </p>
        </div>
      )}
    </div>
  );
}
