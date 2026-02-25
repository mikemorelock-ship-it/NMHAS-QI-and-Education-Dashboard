"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { MetricChart } from "@/components/dashboard/MetricChart";
import { ViewToggle, type ViewMode } from "@/components/dashboard/ViewToggle";
import { MetricsList } from "@/components/dashboard/MetricsList";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART_COLORS } from "@/lib/constants";
import type { KpiData, MetricChartData, DivisionSummary } from "@/types";

interface DepartmentDashboardClientProps {
  departmentSlug: string;
  kpis: KpiData[];
  metrics: MetricChartData[];
  divisions: DivisionSummary[];
}

export function DepartmentDashboardClient({
  departmentSlug,
  kpis,
  metrics,
  divisions,
}: DepartmentDashboardClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Key Performance Indicators</h2>
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>
        {viewMode === "list" ? (
          <MetricsList kpis={kpis} divisionSlug="all" />
        ) : (
          <KpiGrid kpis={kpis} viewMode={viewMode === "charts" ? "charts" : "metrics"} />
        )}
      </section>

      {/* Metric charts */}
      {metrics.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Metric Trends</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.map((metric, idx) => (
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

      {/* Divisions */}
      {divisions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Divisions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {divisions.map((division) => (
              <Link
                key={division.id}
                href={`/department/${departmentSlug}/division/${division.slug}`}
              >
                <Card className="rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{division.name}</span>
                      <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="text-xs">
                      View Details
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
