"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { DivisionSelector } from "@/components/dashboard/DivisionSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricsList } from "@/components/dashboard/MetricsList";
import { ViewToggle, type ViewMode } from "@/components/dashboard/ViewToggle";
import { MetricChart } from "@/components/dashboard/MetricChart";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { CHART_COLORS } from "@/lib/constants";
import type { DivisionOverview, DivisionDetail, KpiData, MetricChartData } from "@/types";

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[1fr] gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="min-h-[140px] rounded-xl border bg-card p-4 animate-pulse">
          <div className="h-3 w-24 bg-muted rounded mb-3" />
          <div className="h-8 w-20 bg-muted rounded mb-4" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function PublicDashboardPage() {
  const [overviewData, setOverviewData] = useState<DivisionOverview[] | null>(null);
  const [detailData, setDetailData] = useState<DivisionDetail | null>(null);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [dateRange, setDateRange] = useState<string>("ytd");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [allDivisionsKpis, setAllDivisionsKpis] = useState<KpiData[]>([]);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard?range=${encodeURIComponent(dateRange)}`);
      if (!res.ok) throw new Error("Failed to fetch overview");
      const data = await res.json();
      setOverviewData(data.divisions);
      setAllDivisionsKpis(data.allDivisionsKpis ?? []);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchDetail = useCallback(
    async (slug: string) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/dashboard/${slug}?range=${encodeURIComponent(dateRange)}`);
        if (!res.ok) throw new Error("Failed to fetch division detail");
        const data: DivisionDetail = await res.json();
        setDetailData(data);
      } catch (err) {
        console.error("Failed to fetch division detail:", err);
        setDetailData(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [dateRange]
  );

  // Initial load + auto-refresh every 60 seconds
  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 60_000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  // Fetch detail when division or date range changes
  useEffect(() => {
    if (activeSlug) {
      fetchDetail(activeSlug);
    } else {
      setDetailData(null);
    }
  }, [activeSlug, dateRange, fetchDetail]);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------

  const divisions = overviewData ?? [];

  // "All Divisions" synthetic entry + real divisions
  const selectorDivisions = [
    { id: "all", name: "All Divisions", slug: "" },
    ...divisions.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
    })),
  ];

  // KPIs: server-computed "All Divisions" aggregate, or from the selected division.
  // The server aggregates directly from all department-level entries (avoiding
  // the "average of averages" problem when divisions have different dept counts).
  const displayKpis: KpiData[] = useMemo(() => {
    if (activeSlug) return detailData?.kpis ?? [];
    return allDivisionsKpis;
  }, [activeSlug, detailData, allDivisionsKpis]);

  // Charts: only available in single-division view
  const displayMetrics: MetricChartData[] = detailData?.metrics ?? [];

  // Departments (regions in DB) for drill-down info
  const deptList = detailData?.departments ?? [];

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleDivisionChange(slug: string) {
    setActiveSlug(slug);
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">EMS Operations Dashboard</h1>
        <div className="flex items-center gap-3">
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* Division tabs */}
      {divisions.length > 0 && (
        <DivisionSelector
          divisions={selectorDivisions}
          activeSlug={activeSlug}
          onChange={handleDivisionChange}
        />
      )}

      {/* Loading spinner overlay for detail fetches */}
      {detailLoading && (
        <div className="flex items-center justify-center py-4 text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Loading division data...</span>
        </div>
      )}

      {/* KPI Grid / List */}
      {loading ? (
        <KpiGridSkeleton />
      ) : displayKpis.length > 0 ? (
        viewMode === "cards" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[1fr] gap-4">
            {displayKpis.map((kpi) => (
              <KpiCard
                key={kpi.metricId}
                name={kpi.name}
                value={kpi.currentValue}
                unit={kpi.unit}
                trend={kpi.trend}
                target={kpi.target}
                sparkline={kpi.sparkline}
                desiredDirection={kpi.desiredDirection}
                rateMultiplier={kpi.rateMultiplier}
                rateSuffix={kpi.rateSuffix}
                href={
                  kpi.metricSlug
                    ? kpi.divisionSlug
                      ? `/division/${kpi.divisionSlug}/metric/${kpi.metricSlug}`
                      : `/metric/${kpi.metricSlug}`
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <MetricsList kpis={displayKpis} divisionSlug={activeSlug || "all"} />
        )
      ) : (
        !loading && (
          <div className="text-center py-12 text-muted-foreground">No KPI data available.</div>
        )
      )}

      {/* Charts section (only when a specific division is selected) */}
      {activeSlug && !detailLoading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Metric Trends</h2>
          {displayMetrics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayMetrics.map((metric, idx) => (
                <MetricChart
                  key={metric.id}
                  name={metric.name}
                  unit={metric.unit}
                  chartType={metric.chartType as "line" | "bar" | "area"}
                  data={metric.data}
                  target={metric.target ?? undefined}
                  color={CHART_COLORS[idx % CHART_COLORS.length]}
                  href={activeSlug ? `/division/${activeSlug}/metric/${metric.slug}` : undefined}
                  rateMultiplier={metric.rateMultiplier}
                  rateSuffix={metric.rateSuffix}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No metric data available for this period.
            </div>
          )}
        </div>
      )}

      {/* Department drill-down (only when a specific division is selected) */}
      {activeSlug && deptList.length > 0 && !detailLoading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Departments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deptList.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between min-h-14 px-5 py-3 rounded-xl border bg-card text-left shadow-sm"
              >
                <span className="font-medium text-sm">{dept.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
