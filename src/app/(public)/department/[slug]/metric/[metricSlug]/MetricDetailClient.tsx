"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ExternalLink,
  FileText,
  LinkIcon,
  BookOpen,
  ClipboardList,
  User,
  Mail,
  Info,
  Activity,
  BarChart3,
  Calendar,
  Hash,
  ArrowRight,
  Layers,
  GitFork,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { MetricHierarchy } from "@/components/dashboard/MetricHierarchy";
import { OrgHierarchy } from "@/components/dashboard/OrgHierarchy";
import { ControlChart } from "@/components/dashboard/ControlChart";
import { formatMetricValue, targetToRaw, toUTCDate, cn } from "@/lib/utils";
import { NMH_COLORS, CHART_COLORS } from "@/lib/constants";
import type { MetricDetailData, ChartDataPoint, QIAnnotation, ChildMetricSummary } from "@/types";
import { QICoachPanel } from "@/components/qi-coach/QICoachPanel";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetricDetailClientProps {
  departmentSlug: string;
  metricSlug: string;
  initialData: MetricDetailData;
  /** Override the API base path for fetching data on range change.
   *  Defaults to `/api/dashboard/metric/${departmentSlug}/${metricSlug}`.
   *  Used by the division-scoped and global metric detail pages. */
  apiBasePath?: string;
  /** The viewing context — determines breadcrumb display and breakdown labels */
  viewContext?: "global" | "division" | "department";
  /** Display name for the context (e.g., "Air Care Clinical" or "All Divisions") */
  contextLabel?: string;
  /** Optional second-level label (e.g., department name within a division) */
  contextSublabel?: string;
}

// ---------------------------------------------------------------------------
// Annotation type styling
// ---------------------------------------------------------------------------

const ANNOTATION_STYLES: Record<
  string,
  { color: string; bg: string; border: string; label: string; dotColor: string }
> = {
  intervention: {
    color: "text-[#00b0ad]",
    bg: "bg-[#00b0ad]/10",
    border: "border-[#00b0ad]/20",
    label: "Intervention",
    dotColor: "bg-[#00b0ad]",
  },
  milestone: {
    color: "text-[#e04726]",
    bg: "bg-[#e04726]/10",
    border: "border-[#e04726]/20",
    label: "Milestone",
    dotColor: "bg-[#e04726]",
  },
  event: {
    color: "text-[#4b4f54]",
    bg: "bg-[#4b4f54]/10",
    border: "border-[#4b4f54]/20",
    label: "Event",
    dotColor: "bg-[#4b4f54]",
  },
  pdsa: {
    color: "text-violet-600",
    bg: "bg-violet-100",
    border: "border-violet-200",
    label: "PDSA Cycle",
    dotColor: "bg-violet-600",
  },
};

// ---------------------------------------------------------------------------
// Resource type icons
// ---------------------------------------------------------------------------

const RESOURCE_ICONS: Record<string, typeof FileText> = {
  document: FileText,
  link: LinkIcon,
  reference: BookOpen,
  protocol: ClipboardList,
};

// ---------------------------------------------------------------------------
// Custom chart tooltip
// ---------------------------------------------------------------------------

function DetailTooltip({
  active,
  payload,
  label,
  unit,
  rateMultiplier,
  rateSuffix,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-semibold">
        {formatMetricValue(payload[0].value, unit, rateMultiplier, rateSuffix)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini sparkline for division breakdown
// ---------------------------------------------------------------------------

function MiniSparkline({ data, color }: { data: ChartDataPoint[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MetricDetailClient({
  departmentSlug,
  metricSlug,
  initialData,
  apiBasePath,
  viewContext = "department",
  contextLabel,
  contextSublabel,
}: MetricDetailClientProps) {
  const [data, setData] = useState<MetricDetailData>(initialData);
  const [range, setRange] = useState("ytd");
  const [loading, setLoading] = useState(false);
  const [chartMode, setChartMode] = useState<"trend" | "control">("trend");
  const [showAnnotations, setShowAnnotations] = useState(true);

  const resolvedApiPath = apiBasePath ?? `/api/dashboard/metric/${departmentSlug}/${metricSlug}`;

  // -----------------------------------------------------------------------
  // Date range change -> re-fetch from API
  // -----------------------------------------------------------------------

  const handleRangeChange = useCallback(
    async (newRange: string) => {
      setRange(newRange);
      setLoading(true);
      try {
        const res = await fetch(`${resolvedApiPath}?range=${encodeURIComponent(newRange)}`);
        if (res.ok) {
          const json: MetricDetailData = await res.json();
          setData(json);
        }
      } catch {
        // keep existing data on error
      } finally {
        setLoading(false);
      }
    },
    [resolvedApiPath]
  );

  // -----------------------------------------------------------------------
  // Derived values
  // -----------------------------------------------------------------------

  const trendDirection = useMemo(() => {
    if (data.stats.trend > 0.5) return "up";
    if (data.stats.trend < -0.5) return "down";
    return "flat";
  }, [data.stats.trend]);

  const rateMultiplier = data.rateMultiplier;
  const rateSuffix = data.rateSuffix;

  // Target is stored in display units; convert to raw for comparison with data values
  const rawTarget =
    data.target !== null ? targetToRaw(data.target, data.unit, rateMultiplier) : null;
  const atOrAboveTarget = rawTarget !== null && data.stats.current >= rawTarget;

  // Unified QI annotations for chart overlays (includes manual annotations + PDSA cycles)
  const qiAnnotations: QIAnnotation[] = useMemo(() => {
    return data.qiAnnotations ?? [];
  }, [data.qiAnnotations]);

  const hasQIAnnotations = qiAnnotations.length > 0;

  // -----------------------------------------------------------------------
  // Chart rendering
  // -----------------------------------------------------------------------

  const formatYAxis = (value: number) => {
    if (data.unit === "rate" && rateMultiplier) return (value * rateMultiplier).toFixed(1);
    if (data.unit === "percentage") return `${value}%`;
    if (data.unit === "currency") {
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value}`;
    }
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return `${value}`;
  };

  const chartType = (data.chartType as "line" | "bar" | "area") || "line";
  const mainColor = NMH_COLORS.teal;

  const commonAxisElements = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
      <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis
        tick={{ fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatYAxis}
        width={55}
      />
      <Tooltip
        content={
          <DetailTooltip unit={data.unit} rateMultiplier={rateMultiplier} rateSuffix={rateSuffix} />
        }
        cursor={{ strokeDasharray: "3 3" }}
      />
      {/* Target reference line */}
      {data.target !== null && (
        <ReferenceLine
          y={targetToRaw(data.target, data.unit, rateMultiplier)}
          stroke={NMH_COLORS.orange}
          strokeDasharray="6 4"
          strokeWidth={2}
          label={{
            value: `Target: ${formatMetricValue(data.target, data.unit, null, rateSuffix)}`,
            position: "insideTopRight",
            fill: NMH_COLORS.orange,
            fontSize: 11,
          }}
        />
      )}
      {/* QI Annotation markers (vertical lines at annotation dates + PDSA cycles) */}
      {showAnnotations &&
        qiAnnotations.map((ann) => (
          <ReferenceLine
            key={ann.id}
            x={ann.period}
            stroke={ann.type === "pdsa" ? "#7c3aed" : NMH_COLORS.teal}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: ann.label,
              position: "insideTopLeft",
              fill: ann.type === "pdsa" ? "#7c3aed" : NMH_COLORS.teal,
              fontSize: 10,
              angle: -90,
              offset: 10,
            }}
          />
        ))}
    </>
  );

  const commonChartProps = {
    data: data.chartData,
    margin: { top: 20, right: 15, left: 15, bottom: 5 },
  };

  const renderMainChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonChartProps}>
            {commonAxisElements}
            <Bar dataKey="value" fill={mainColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        );
      case "area":
        return (
          <AreaChart {...commonChartProps}>
            {commonAxisElements}
            <defs>
              <linearGradient id="detail-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mainColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={mainColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={mainColor}
              strokeWidth={2}
              fill="url(#detail-gradient)"
            />
          </AreaChart>
        );
      case "line":
      default:
        return (
          <LineChart {...commonChartProps}>
            {commonAxisElements}
            <Line
              type="monotone"
              dataKey="value"
              stroke={mainColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: mainColor }}
              activeDot={{ r: 5, fill: mainColor }}
            />
          </LineChart>
        );
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={cn("space-y-8", loading && "opacity-70 transition-opacity")}>
      {/* ================================================================= */}
      {/* HEADER SECTION                                                    */}
      {/* ================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            {data.parentMetric && (
              <Link
                href={
                  viewContext === "global"
                    ? `/metric/${data.parentMetric.slug}`
                    : viewContext === "division" && data.division?.slug
                      ? `/division/${data.division.slug}/metric/${data.parentMetric.slug}`
                      : `/department/${departmentSlug}/metric/${data.parentMetric.slug}`
                }
                className="inline-flex items-center gap-1.5 text-xs text-[#00b0ad] hover:text-[#00b0ad]/80 transition-colors"
              >
                <Layers className="size-3" />
                Part of: {data.parentMetric.name}
              </Link>
            )}
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{data.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {contextLabel && (
                <Badge variant="secondary" className="text-xs">
                  {contextLabel}
                </Badge>
              )}
              {contextSublabel && (
                <>
                  <span className="text-xs text-muted-foreground">&gt;</span>
                  <Badge variant="secondary" className="text-xs">
                    {contextSublabel}
                  </Badge>
                </>
              )}
              {data.category && (
                <Badge variant="outline" className="text-xs capitalize">
                  {data.category}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs capitalize">
                {data.unit}
              </Badge>
            </div>
            {data.description && (
              <p className="text-muted-foreground max-w-2xl">{data.description}</p>
            )}
          </div>

          {/* Hero current value */}
          <div className="flex-shrink-0 text-right sm:text-left">
            <p className="text-sm text-muted-foreground mb-1">Current Value</p>
            <p className="text-4xl md:text-5xl font-bold tracking-tight">
              {formatMetricValue(data.stats.current, data.unit, rateMultiplier, rateSuffix)}
            </p>
            <div className="flex items-center gap-2 mt-2 justify-end sm:justify-start">
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-sm font-medium",
                  trendDirection === "up" && "text-[#00b0ad]",
                  trendDirection === "down" && "text-[#e04726]",
                  trendDirection === "flat" && "text-muted-foreground"
                )}
              >
                {trendDirection === "up" && <TrendingUp className="size-4" />}
                {trendDirection === "down" && <TrendingDown className="size-4" />}
                {trendDirection === "flat" && <Minus className="size-4" />}
                <span>
                  {trendDirection === "flat"
                    ? "No change"
                    : `${trendDirection === "up" ? "+" : ""}${data.stats.trend.toFixed(1)}%`}
                </span>
              </div>
              {data.target !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                    atOrAboveTarget
                      ? "bg-[#00b0ad]/10 text-[#00b0ad]"
                      : "bg-[#e04726]/10 text-[#e04726]"
                  )}
                >
                  <Target className="size-3" />
                  {atOrAboveTarget ? "On target" : "Below target"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* METRIC HIERARCHY                                                  */}
      {/* ================================================================= */}
      {(data.parentMetric || data.childMetrics.length > 0) && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitFork className="size-4 text-muted-foreground" />
                Metric Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricHierarchy
                departmentSlug={departmentSlug}
                currentMetricId={data.id}
                currentMetricName={data.name}
                currentMetricSlug={data.slug}
                parentMetric={data.parentMetric}
                siblingMetrics={data.siblingMetrics ?? []}
                childMetrics={data.childMetrics}
                linkBasePath={
                  viewContext === "global"
                    ? "/metric"
                    : viewContext === "division" && data.division?.slug
                      ? `/division/${data.division.slug}/metric`
                      : undefined
                }
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* ORGANIZATIONAL HIERARCHY                                          */}
      {/* ================================================================= */}
      {data.hierarchy && data.hierarchy.length > 0 && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                Organizational Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrgHierarchy
                metricSlug={data.slug}
                divisions={data.hierarchy}
                activeContext={viewContext ?? "department"}
                activeDivisionSlug={data.division?.slug}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* DATE RANGE FILTER                                                 */}
      {/* ================================================================= */}
      <section>
        <DateRangeFilter value={range} onChange={handleRangeChange} />
      </section>

      {/* ================================================================= */}
      {/* MAIN CHART                                                        */}
      {/* ================================================================= */}
      <section>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">
              {chartMode === "control" ? "Control Chart" : "Trend Over Time"}
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Show/Hide QI Events toggle */}
              {hasQIAnnotations && (
                <button
                  type="button"
                  onClick={() => setShowAnnotations(!showAnnotations)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all",
                    showAnnotations
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-gray-200 bg-muted/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="size-3" />
                  QI Events
                </button>
              )}
              {/* Trend / Control Chart toggle — only shown when SPC data exists */}
              {data.spcData && (
                <div className="inline-flex items-center rounded-lg border bg-muted/50 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setChartMode("trend")}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-all",
                      chartMode === "trend"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Trend
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("control")}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-all",
                      chartMode === "control"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Control Chart
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {data.chartData.length > 0 ? (
              chartMode === "control" && data.spcData ? (
                <ControlChart
                  spcData={data.spcData}
                  unit={data.unit}
                  target={data.target}
                  rateMultiplier={rateMultiplier}
                  rateSuffix={rateSuffix}
                  annotations={showAnnotations ? qiAnnotations : undefined}
                />
              ) : (
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {renderMainChart()}
                  </ResponsiveContainer>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No data available for the selected period.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ================================================================= */}
      {/* STATISTICS ROW                                                    */}
      {/* ================================================================= */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Current"
            value={formatMetricValue(data.stats.current, data.unit, rateMultiplier, rateSuffix)}
            icon={<Activity className="size-4" />}
          />
          <StatCard
            label="Previous"
            value={formatMetricValue(data.stats.previous, data.unit, rateMultiplier, rateSuffix)}
            icon={<BarChart3 className="size-4" />}
          />
          <StatCard
            label="Trend"
            value={`${data.stats.trend >= 0 ? "+" : ""}${data.stats.trend.toFixed(1)}%`}
            icon={
              trendDirection === "up" ? (
                <TrendingUp className="size-4" />
              ) : trendDirection === "down" ? (
                <TrendingDown className="size-4" />
              ) : (
                <Minus className="size-4" />
              )
            }
            valueColor={
              trendDirection === "up"
                ? "text-[#00b0ad]"
                : trendDirection === "down"
                  ? "text-[#e04726]"
                  : undefined
            }
          />
          <StatCard
            label="Average"
            value={formatMetricValue(data.stats.average, data.unit, rateMultiplier, rateSuffix)}
            icon={<Hash className="size-4" />}
          />
          <StatCard
            label="Min"
            value={formatMetricValue(data.stats.min, data.unit, rateMultiplier, rateSuffix)}
            icon={<TrendingDown className="size-4" />}
          />
          <StatCard
            label="Max"
            value={formatMetricValue(data.stats.max, data.unit, rateMultiplier, rateSuffix)}
            icon={<TrendingUp className="size-4" />}
          />
        </div>
      </section>

      {/* ================================================================= */}
      {/* SUB-METRIC BREAKDOWN                                              */}
      {/* ================================================================= */}
      {data.childMetrics && data.childMetrics.length > 0 && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="size-4 text-muted-foreground" />
                Sub-Metric Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stacked bar chart */}
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={buildStackedData(data.childMetrics)}
                    margin={{ top: 10, right: 15, left: 15, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatYAxis}
                      width={55}
                    />
                    <Tooltip
                      content={
                        <StackedTooltip
                          unit={data.unit}
                          rateMultiplier={rateMultiplier}
                          rateSuffix={rateSuffix}
                        />
                      }
                      cursor={{ strokeDasharray: "3 3" }}
                    />
                    <Legend />
                    {data.childMetrics.map((child, idx) => (
                      <Bar
                        key={child.id}
                        dataKey={child.name}
                        stackId="children"
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                        radius={idx === data.childMetrics.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        maxBarSize={48}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Summary table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-semibold">Sub-Metric</th>
                      <th className="pb-2 font-semibold text-right">Current Value</th>
                      <th className="pb-2 font-semibold text-right">Trend</th>
                      <th className="pb-2 font-semibold text-right hidden sm:table-cell">
                        Sparkline
                      </th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.childMetrics.map((child, idx) => {
                      const childTrend =
                        child.trend > 0.5 ? "up" : child.trend < -0.5 ? "down" : "flat";
                      const childHref =
                        viewContext === "global"
                          ? `/metric/${child.slug}`
                          : viewContext === "division" && data.division?.slug
                            ? `/division/${data.division.slug}/metric/${child.slug}`
                            : `/department/${departmentSlug}/metric/${child.slug}`;
                      return (
                        <tr
                          key={child.id}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 font-medium">
                            <Link
                              href={childHref}
                              className="hover:text-[#00b0ad] transition-colors"
                            >
                              {child.name}
                            </Link>
                          </td>
                          <td className="py-3 text-right font-mono">
                            {formatMetricValue(
                              child.currentValue,
                              data.unit,
                              rateMultiplier,
                              rateSuffix
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                childTrend === "up" && "text-[#00b0ad]",
                                childTrend === "down" && "text-[#e04726]",
                                childTrend === "flat" && "text-muted-foreground"
                              )}
                            >
                              {childTrend === "up" && <TrendingUp className="size-3" />}
                              {childTrend === "down" && <TrendingDown className="size-3" />}
                              {childTrend === "flat" && <Minus className="size-3" />}
                              {childTrend === "flat"
                                ? "—"
                                : `${childTrend === "up" ? "+" : ""}${child.trend.toFixed(1)}%`}
                            </span>
                          </td>
                          <td className="py-3 text-right hidden sm:table-cell">
                            <div className="flex justify-end">
                              <MiniSparkline
                                data={child.data}
                                color={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            </div>
                          </td>
                          <td className="py-3">
                            <Link href={childHref}>
                              <ArrowRight className="size-4 text-muted-foreground hover:text-[#00b0ad] transition-colors" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* ABOUT THIS METRIC                                                 */}
      {/* ================================================================= */}
      {(data.dataDefinition || data.methodology || data.description) && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="size-4 text-muted-foreground" />
                About This Metric
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.dataDefinition && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                    Data Definition
                  </h3>
                  <p className="text-sm leading-relaxed">{data.dataDefinition}</p>
                </div>
              )}
              {data.methodology && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Methodology</h3>
                  <p className="text-sm leading-relaxed">{data.methodology}</p>
                </div>
              )}
              {!data.dataDefinition && !data.methodology && data.description && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-1">Description</h3>
                  <p className="text-sm leading-relaxed">{data.description}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  {data.stats.count} data points
                </span>
                <span className="capitalize">Unit: {data.unit}</span>
                <span className="capitalize">Chart: {data.chartType}</span>
                {data.target !== null && (
                  <span>Target: {formatMetricValue(data.target, data.unit, null, rateSuffix)}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* QUALITY IMPROVEMENT TIMELINE                                      */}
      {/* ================================================================= */}
      {(data.annotations.length > 0 ||
        (data.qiAnnotations?.filter((a) => a.type === "pdsa").length ?? 0) > 0) && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                Quality Improvement Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-4">
                  {/* Merge manual annotations + PDSA entries into unified timeline */}
                  {[
                    ...data.annotations.map((a) => ({
                      id: a.id,
                      date: a.date,
                      title: a.title,
                      description: a.description,
                      type: a.type as string,
                    })),
                    ...(data.qiAnnotations ?? [])
                      .filter((a) => a.type === "pdsa")
                      .map((a) => ({
                        id: a.id,
                        date: a.date,
                        title: a.label,
                        description: null as string | null,
                        type: "pdsa",
                      })),
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((annotation) => {
                      const style = ANNOTATION_STYLES[annotation.type] ?? ANNOTATION_STYLES.event;
                      return (
                        <div key={annotation.id} className="relative flex items-start gap-4 pl-8">
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              "absolute left-0 top-1 size-6 rounded-full flex items-center justify-center",
                              style.bg,
                              "border",
                              style.border
                            )}
                          >
                            <div className={cn("size-2 rounded-full", style.dotColor)} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{annotation.title}</span>
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0", style.color, style.border)}
                              >
                                {style.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(toUTCDate(parseISO(annotation.date)), "MMMM d, yyyy")}
                            </p>
                            {annotation.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {annotation.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* BREAKDOWN (Division or Department depending on context)           */}
      {/* ================================================================= */}
      {data.divisionBreakdown.length > 0 && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">
                {viewContext === "division" ? "Department" : "Division"} Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-semibold">
                        {viewContext === "division" ? "Department" : "Division"}
                      </th>
                      <th className="pb-2 font-semibold text-right">Current Value</th>
                      <th className="pb-2 font-semibold text-right">Trend</th>
                      <th className="pb-2 font-semibold text-right hidden sm:table-cell">
                        Sparkline
                      </th>
                      {viewContext !== "division" && <th className="pb-2 w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {data.divisionBreakdown.map((div, idx) => {
                      const divTrend = div.trend > 0.5 ? "up" : div.trend < -0.5 ? "down" : "flat";

                      // Links depend on context
                      const breakdownHref =
                        viewContext === "division"
                          ? undefined // No department-level metric page yet
                          : `/division/${div.divisionSlug}/metric/${data.slug}`;

                      return (
                        <tr
                          key={div.divisionId}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-3 font-medium">
                            {breakdownHref ? (
                              <Link
                                href={breakdownHref}
                                className="hover:text-[#00b0ad] transition-colors"
                              >
                                {div.divisionName}
                              </Link>
                            ) : (
                              div.divisionName
                            )}
                          </td>
                          <td className="py-3 text-right font-mono">
                            {formatMetricValue(
                              div.currentValue,
                              data.unit,
                              rateMultiplier,
                              rateSuffix
                            )}
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium",
                                divTrend === "up" && "text-[#00b0ad]",
                                divTrend === "down" && "text-[#e04726]",
                                divTrend === "flat" && "text-muted-foreground"
                              )}
                            >
                              {divTrend === "up" && <TrendingUp className="size-3" />}
                              {divTrend === "down" && <TrendingDown className="size-3" />}
                              {divTrend === "flat" && <Minus className="size-3" />}
                              {divTrend === "flat"
                                ? "—"
                                : `${divTrend === "up" ? "+" : ""}${div.trend.toFixed(1)}%`}
                            </span>
                          </td>
                          <td className="py-3 text-right hidden sm:table-cell">
                            <div className="flex justify-end">
                              <MiniSparkline
                                data={div.data}
                                color={CHART_COLORS[idx % CHART_COLORS.length]}
                              />
                            </div>
                          </td>
                          {viewContext !== "division" && (
                            <td className="py-3">
                              {breakdownHref && (
                                <Link href={breakdownHref}>
                                  <ArrowRight className="size-4 text-muted-foreground hover:text-[#00b0ad] transition-colors" />
                                </Link>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* RESPONSIBLE PARTIES                                               */}
      {/* ================================================================= */}
      {data.responsibleParties.length > 0 && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                Responsible Parties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.responsibleParties.map((party) => (
                  <div
                    key={party.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="size-10 rounded-full bg-[#00b0ad]/10 flex items-center justify-center flex-shrink-0">
                      <User className="size-5 text-[#00b0ad]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{party.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{party.role}</p>
                      {party.email && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 truncate">
                          <Mail className="size-3 flex-shrink-0" />
                          {party.email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ================================================================= */}
      {/* RESOURCES                                                         */}
      {/* ================================================================= */}
      {data.resources.length > 0 && (
        <section>
          <Card className="rounded-xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="size-4 text-muted-foreground" />
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.resources.map((resource) => {
                  const Icon = RESOURCE_ICONS[resource.type] || LinkIcon;
                  return (
                    <a
                      key={resource.id}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 hover:border-[#00b0ad]/30 transition-all group"
                    >
                      <div className="size-9 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-[#00b0ad]/10">
                        <Icon className="size-4 text-muted-foreground group-hover:text-[#00b0ad]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium group-hover:text-[#00b0ad] transition-colors truncate">
                          {resource.title}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{resource.type}</p>
                      </div>
                      <ExternalLink className="size-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* QI Coach floating panel */}
      <QICoachPanel
        context={{
          metricName: data.name,
          metricUnit: data.unit,
          metricTarget: data.target,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stacked chart helpers for sub-metric breakdown
// ---------------------------------------------------------------------------

/**
 * Merge child metric time-series into a single array where each object has
 * { period: "Jan 2025", "OMD Clinical Debrief": 5, "QA Clinical Debrief": 8 }
 */
function buildStackedData(children: ChildMetricSummary[]): Record<string, string | number>[] {
  const periodMap = new Map<string, Record<string, string | number>>();

  for (const child of children) {
    for (const point of child.data) {
      if (!periodMap.has(point.period)) {
        periodMap.set(point.period, { period: point.period });
      }
      periodMap.get(point.period)![child.name] = point.value;
    }
  }

  // Sort by period order (already chronological from API)
  return Array.from(periodMap.values());
}

function StackedTooltip({
  active,
  payload,
  label,
  unit,
  rateMultiplier,
  rateSuffix,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  unit: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </span>
          <span className="font-mono">
            {formatMetricValue(p.value, unit, rateMultiplier, rateSuffix)}
          </span>
        </div>
      ))}
      <div className="border-t mt-1.5 pt-1.5 flex justify-between font-semibold">
        <span>Total</span>
        <span className="font-mono">
          {formatMetricValue(total, unit, rateMultiplier, rateSuffix)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card sub-component
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueColor?: string;
}) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={cn("text-xl font-bold tracking-tight", valueColor)}>{value}</p>
      </CardContent>
    </Card>
  );
}
