"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import { cn } from "@/lib/utils";
import type { KpiData } from "@/types";

interface KpiGridProps {
  kpis: KpiData[];
  divisionSlug?: string;
  viewMode?: "metrics" | "charts";
}

export function KpiGrid({ kpis, divisionSlug, viewMode = "metrics" }: KpiGridProps) {
  if (kpis.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No KPI data available.</div>;
  }

  return (
    <div
      className={cn(
        "grid auto-rows-[1fr] gap-4",
        viewMode === "charts"
          ? "grid-cols-1 md:grid-cols-2"
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      )}
    >
      {kpis.map((kpi) => {
        const effectiveSlug = kpi.divisionSlug || divisionSlug || "";
        const metricHref = kpi.metricSlug
          ? effectiveSlug && effectiveSlug !== "all"
            ? `/division/${effectiveSlug}/metric/${kpi.metricSlug}`
            : `/metric/${kpi.metricSlug}`
          : undefined;

        return (
          <KpiCard
            key={kpi.metricId}
            name={kpi.name}
            value={kpi.currentValue}
            unit={kpi.unit}
            trend={kpi.trend}
            target={kpi.target}
            sparkline={kpi.sparkline}
            href={metricHref}
            desiredDirection={kpi.desiredDirection}
            rateMultiplier={kpi.rateMultiplier}
            rateSuffix={kpi.rateSuffix}
            viewMode={viewMode}
            spcData={kpi.spcData}
          />
        );
      })}
    </div>
  );
}
