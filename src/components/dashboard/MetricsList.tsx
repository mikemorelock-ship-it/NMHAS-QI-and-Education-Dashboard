"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatMetricValue, targetToRaw, cn } from "@/lib/utils";
import type { KpiData } from "@/types";

interface MetricsListProps {
  kpis: KpiData[];
  divisionSlug?: string;
}

export function MetricsList({ kpis, divisionSlug }: MetricsListProps) {
  if (kpis.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No KPI data available.</div>;
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left font-medium px-4 py-3">Metric</th>
            <th className="text-right font-medium px-4 py-3">Value</th>
            <th className="text-right font-medium px-4 py-3">Trend</th>
            <th className="text-right font-medium px-4 py-3 hidden sm:table-cell">Target</th>
            <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Category</th>
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi) => {
            const direction = kpi.trend > 0.5 ? "up" : kpi.trend < -0.5 ? "down" : "flat";
            const desired = kpi.desiredDirection ?? "up";
            const isFavorable = direction === "flat" ? null : direction === desired;
            const rawTarget =
              kpi.target !== null ? targetToRaw(kpi.target, kpi.unit, kpi.rateMultiplier) : null;
            const meetsTarget =
              rawTarget !== null &&
              (desired === "down" ? kpi.currentValue <= rawTarget : kpi.currentValue >= rawTarget);
            const effectiveSlug = kpi.divisionSlug || divisionSlug || "";
            const metricHref = kpi.metricSlug
              ? effectiveSlug && effectiveSlug !== "all"
                ? `/division/${effectiveSlug}/metric/${kpi.metricSlug}`
                : `/metric/${kpi.metricSlug}`
              : undefined;

            return (
              <tr
                key={kpi.metricId}
                className={cn(
                  "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                  metricHref && "cursor-pointer"
                )}
              >
                <td className="px-4 py-3 font-medium">
                  {metricHref ? (
                    <Link href={metricHref} className="hover:text-[#00b0ad] transition-colors">
                      {kpi.name}
                    </Link>
                  ) : (
                    kpi.name
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {formatMetricValue(
                    kpi.currentValue,
                    kpi.unit,
                    kpi.rateMultiplier,
                    kpi.rateSuffix
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-medium",
                      isFavorable === true && "text-[#00b0ad]",
                      isFavorable === false && "text-[#e04726]",
                      isFavorable === null && "text-muted-foreground"
                    )}
                  >
                    {direction === "up" && <TrendingUp className="size-3.5" />}
                    {direction === "down" && <TrendingDown className="size-3.5" />}
                    {direction === "flat" && <Minus className="size-3.5" />}
                    <span>
                      {direction === "flat"
                        ? "—"
                        : `${direction === "up" ? "+" : "-"}${Math.abs(kpi.trend).toFixed(1)}%`}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  {kpi.target !== null ? (
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        meetsTarget
                          ? "bg-[#00b0ad]/10 text-[#00b0ad]"
                          : "bg-[#e04726]/10 text-[#e04726]"
                      )}
                    >
                      {formatMetricValue(kpi.target, kpi.unit, null, kpi.rateSuffix)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">{kpi.category ?? "—"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
