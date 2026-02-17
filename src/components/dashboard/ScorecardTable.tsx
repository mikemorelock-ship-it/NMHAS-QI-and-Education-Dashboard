"use client";

import { Fragment, useMemo } from "react";
import { formatMetricValue } from "@/lib/utils";
import type { ScorecardData, ScorecardMetricRow } from "@/types";

interface ScorecardTableProps {
  scorecard: ScorecardData;
}

interface MetricGroup {
  name: string | null;
  metrics: ScorecardMetricRow[];
}

export function ScorecardTable({ scorecard }: ScorecardTableProps) {
  const { metrics, months } = scorecard;

  // Build groups while preserving order
  const groups = useMemo<MetricGroup[]>(() => {
    const hasAnyGroup = metrics.some((m) => m.groupName);
    if (!hasAnyGroup) {
      // No groups — single flat group
      return [{ name: null, metrics }];
    }

    const result: MetricGroup[] = [];
    let currentGroupName: string | null | undefined = undefined;

    for (const metric of metrics) {
      const gn = metric.groupName ?? null;
      if (gn !== currentGroupName) {
        currentGroupName = gn;
        result.push({ name: currentGroupName, metrics: [] });
      }
      result[result.length - 1].metrics.push(metric);
    }
    return result;
  }, [metrics]);

  if (metrics.length === 0) return null;

  // Total column count: Metric + Target + YTD + months
  const totalCols = 3 + months.length;

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-nmh-gray text-white">
              <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap sticky left-0 bg-nmh-gray z-10">
                Metric
              </th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap">
                Target
              </th>
              <th className="text-right font-semibold px-3 py-2.5 whitespace-nowrap border-r border-white/20">
                YTD
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  className="text-right font-semibold px-3 py-2.5 whitespace-nowrap min-w-[70px]"
                >
                  {month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groups.map((group, groupIdx) => (
              <Fragment key={`group-${groupIdx}`}>
                {/* Group header row */}
                {group.name && (
                  <tr>
                    <td
                      colSpan={totalCols}
                      className="bg-nmh-teal/10 px-4 py-2 font-semibold text-nmh-teal text-sm border-b border-nmh-teal/20"
                    >
                      {group.name}
                    </td>
                  </tr>
                )}
                {/* Metric rows in this group */}
                {group.metrics.map((metric) => {
                  const monthIndex = (m: string) =>
                    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(m);

                  return (
                    <tr
                      key={metric.metricId}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {/* Metric name */}
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                        {metric.metricName}
                      </td>

                      {/* Target */}
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground whitespace-nowrap">
                        {metric.target !== null
                          ? formatMetricValue(metric.target, metric.unit, metric.rateMultiplier, metric.rateSuffix)
                          : "--"}
                      </td>

                      {/* YTD */}
                      <td
                        className={
                          "px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap border-r border-border " +
                          getTargetColorClass(metric.actualYtd, metric.target)
                        }
                      >
                        {metric.actualYtd !== null
                          ? formatMetricValue(metric.actualYtd, metric.unit, metric.rateMultiplier, metric.rateSuffix)
                          : "--"}
                      </td>

                      {/* Monthly values */}
                      {months.map((month) => {
                        const idx = monthIndex(month);
                        const mv = metric.monthlyValues[idx];
                        const value = mv?.value ?? null;

                        return (
                          <td
                            key={month}
                            className={
                              "px-3 py-2.5 text-right font-mono whitespace-nowrap " +
                              getTargetColorClass(value, metric.target)
                            }
                          >
                            {value !== null
                              ? formatMetricValue(value, metric.unit, metric.rateMultiplier, metric.rateSuffix)
                              : (
                                <span className="text-muted-foreground/40">--</span>
                              )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getTargetColorClass(
  value: number | null,
  target: number | null
): string {
  if (value === null || target === null) return "";
  if (value >= target) return "text-green-700 bg-green-50";
  return "text-red-700 bg-red-50";
}
