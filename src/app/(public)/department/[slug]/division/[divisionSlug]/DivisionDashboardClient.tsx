"use client";

import { useState } from "react";
import { MetricChart } from "@/components/dashboard/MetricChart";
import { UnitFilter } from "@/components/dashboard/UnitFilter";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { MetricsList } from "@/components/dashboard/MetricsList";
import { ViewToggle, type ViewMode } from "@/components/dashboard/ViewToggle";
import { CHART_COLORS } from "@/lib/constants";
import type { MetricChartData, KpiData } from "@/types";

interface IndividualUnit {
  id: string;
  name: string;
  role: string | null;
  metrics: MetricChartData[];
  kpis: KpiData[];
}

interface DivisionDashboardClientProps {
  departmentSlug: string;
  /** Division-level metric charts (aggregated) */
  metrics: MetricChartData[];
  /** Division-level KPIs */
  kpis: KpiData[];
  /** Individual sub-units (e.g., Air Care 1-7 or Ground bases) with per-unit data */
  individuals: IndividualUnit[];
}

export function DivisionDashboardClient({
  departmentSlug,
  metrics,
  kpis,
  individuals,
}: DivisionDashboardClientProps) {
  const [activeUnitId, setActiveUnitId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const hasUnits = individuals.length > 0;

  // Determine which data to show based on filter
  const activeUnit = individuals.find((u) => u.id === activeUnitId);
  const displayMetrics = activeUnit ? activeUnit.metrics : metrics;
  const displayKpis = activeUnit ? activeUnit.kpis : kpis;

  return (
    <div className="space-y-6">
      {/* Unit filter bar (only if there are sub-units) */}
      {hasUnits && (
        <UnitFilter
          units={individuals.map((u) => ({ id: u.id, name: u.name }))}
          activeId={activeUnitId}
          onChange={setActiveUnitId}
          label="Filter by region"
        />
      )}

      {/* View toggle + KPI section */}
      {displayKpis.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {activeUnit ? `${activeUnit.name} — Key Metrics` : "Key Metrics"}
            </h2>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </div>
          {viewMode === "cards" ? (
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
                  href={`/department/${departmentSlug}/metric/${kpi.metricSlug}`}
                  rateMultiplier={kpi.rateMultiplier}
                  rateSuffix={kpi.rateSuffix}
                />
              ))}
            </div>
          ) : (
            <MetricsList kpis={displayKpis} divisionSlug={departmentSlug} />
          )}
        </section>
      )}

      {/* Metric trend charts */}
      {displayMetrics.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">
            {activeUnit ? `${activeUnit.name} — Metric Trends` : "Metric Trends"}
          </h2>
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
                href={`/department/${departmentSlug}/metric/${metric.slug}`}
                rateMultiplier={metric.rateMultiplier}
                rateSuffix={metric.rateSuffix}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {displayMetrics.length === 0 && displayKpis.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p>No data available{activeUnit ? ` for ${activeUnit.name}` : ""} yet.</p>
        </div>
      )}
    </div>
  );
}
