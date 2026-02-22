"use client";

import { KpiCard } from "@/components/dashboard/KpiCard";
import type { KpiData } from "@/types";

interface KpiGridProps {
  kpis: KpiData[];
  divisionSlug?: string;
}

export function KpiGrid({ kpis, divisionSlug }: KpiGridProps) {
  if (kpis.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No KPI data available.</div>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[1fr] gap-4">
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
            rateMultiplier={kpi.rateMultiplier}
            rateSuffix={kpi.rateSuffix}
          />
        );
      })}
    </div>
  );
}
