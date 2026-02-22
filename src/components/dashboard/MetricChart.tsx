"use client";

import { useMemo } from "react";
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
  ReferenceArea,
} from "recharts";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatMetricValue } from "@/lib/utils";
import { NMH_COLORS } from "@/lib/constants";
import type { ChartDataPoint } from "@/types";

interface MetricChartProps {
  name: string;
  unit: string;
  chartType: "line" | "bar" | "area";
  data: ChartDataPoint[];
  target?: number;
  color?: string;
  href?: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
  baselineStartPeriod?: string | null;
  baselineEndPeriod?: string | null;
}

/**
 * Custom tooltip for consistent styling across all chart types.
 */
function CustomTooltip({
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

export function MetricChart({
  name,
  unit,
  chartType,
  data,
  target,
  color = NMH_COLORS.teal,
  href,
  rateMultiplier,
  rateSuffix,
  baselineStartPeriod,
  baselineEndPeriod,
}: MetricChartProps) {
  /**
   * IHI Run Chart Rules — detect shifts and trends in the data.
   *
   * Shift: 6+ consecutive points all above or all below the median
   *        (points exactly on the median are skipped / do not break a run).
   * Trend: 5+ consecutive points continuously increasing or decreasing.
   */
  const runChartAnalysis = useMemo(() => {
    if (data.length < 2) {
      return { median: 0, enrichedData: data, shifts: [] as number[][], trends: [] as number[][] };
    }

    // --- Compute median ---
    const sorted = [...data.map((d) => d.value)].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    // --- Detect shifts (6+ consecutive above or below median) ---
    const shifts: number[][] = [];
    let shiftRun: number[] = [];
    let shiftSide: "above" | "below" | null = null;

    for (let i = 0; i < data.length; i++) {
      const v = data[i].value;
      if (v === median) {
        // Point on median — does not break or extend a run
        continue;
      }
      const side: "above" | "below" = v > median ? "above" : "below";
      if (side === shiftSide) {
        shiftRun.push(i);
      } else {
        if (shiftRun.length >= 6) shifts.push([...shiftRun]);
        shiftRun = [i];
        shiftSide = side;
      }
    }
    if (shiftRun.length >= 6) shifts.push([...shiftRun]);

    // --- Detect trends (5+ consecutive increasing or decreasing) ---
    const trends: number[][] = [];
    let trendRun: number[] = [0];
    let trendDir: "up" | "down" | null = null;

    for (let i = 1; i < data.length; i++) {
      const diff = data[i].value - data[i - 1].value;
      if (diff === 0) {
        if (trendRun.length >= 5) trends.push([...trendRun]);
        trendRun = [i];
        trendDir = null;
        continue;
      }
      const dir: "up" | "down" = diff > 0 ? "up" : "down";
      if (dir === trendDir) {
        trendRun.push(i);
      } else {
        if (trendRun.length >= 5) trends.push([...trendRun]);
        trendRun = [i - 1, i];
        trendDir = dir;
      }
    }
    if (trendRun.length >= 5) trends.push([...trendRun]);

    // --- Build index sets for fast lookup ---
    const shiftIndices = new Set(shifts.flat());
    const trendIndices = new Set(trends.flat());

    // --- Enrich data with shift / trend flags ---
    const enrichedData = data.map((d, i) => ({
      ...d,
      shift: shiftIndices.has(i),
      trend: trendIndices.has(i),
    }));

    return { median, enrichedData, shifts, trends };
  }, [data]);

  // Empty state
  if (data.length === 0) {
    return (
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  /**
   * Compact Y-axis tick formatter.
   */
  const formatYAxis = (value: number) => {
    if (unit === "rate" && rateMultiplier) return (value * rateMultiplier).toFixed(1);
    if (unit === "percentage") return `${value}%`;
    if (unit === "currency") {
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value}`;
    }
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return `${value}`;
  };

  // Determine label positions for target + median to avoid overlap.
  // When their Y values are close (within 15 % of the visible range) we put
  // them on opposite sides of the chart; otherwise both sit on the right.
  let targetLabelPos: "insideTopRight" | "insideTopLeft" = "insideTopRight";
  let medianLabelPos: "insideBottomRight" | "insideTopLeft" | "insideTopRight" =
    "insideBottomRight";

  if (target !== undefined && data.length >= 2) {
    const vals = data.map((d) => d.value).concat(target, runChartAnalysis.median);
    const yRange = Math.max(...vals) - Math.min(...vals) || 1;
    const close = Math.abs(target - runChartAnalysis.median) / yRange < 0.15;

    if (close) {
      // Close — put the higher line's label top-right, the lower one's top-left
      if (target >= runChartAnalysis.median) {
        medianLabelPos = "insideTopLeft";
      } else {
        targetLabelPos = "insideTopLeft";
      }
    }
  }

  /**
   * Shared axis/grid/tooltip/reference-line elements used by every chart type.
   */
  const commonAxisElements = (
    <>
      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
      <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis
        tick={{ fontSize: 12 }}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatYAxis}
        width={50}
      />
      <Tooltip
        content={
          <CustomTooltip unit={unit} rateMultiplier={rateMultiplier} rateSuffix={rateSuffix} />
        }
        cursor={{ strokeDasharray: "3 3" }}
      />
      {target !== undefined && (
        <ReferenceLine
          y={target}
          stroke={NMH_COLORS.orange}
          strokeDasharray="6 4"
          strokeWidth={2}
          label={{
            value: `Target: ${formatMetricValue(target, unit, rateMultiplier, rateSuffix)}`,
            position: targetLabelPos,
            fill: NMH_COLORS.orange,
            fontSize: 11,
          }}
        />
      )}
      {baselineStartPeriod && baselineEndPeriod && (
        <ReferenceArea
          x1={baselineStartPeriod}
          x2={baselineEndPeriod}
          fill="#3b82f6"
          fillOpacity={0.08}
        />
      )}
      {data.length >= 2 && (
        <ReferenceLine
          y={runChartAnalysis.median}
          stroke={NMH_COLORS.gray}
          strokeDasharray="4 4"
          strokeWidth={1}
          label={{
            value: `Median: ${formatMetricValue(runChartAnalysis.median, unit, rateMultiplier, rateSuffix)}`,
            position: medianLabelPos,
            fill: NMH_COLORS.gray,
            fontSize: 11,
          }}
        />
      )}
    </>
  );

  const { median, enrichedData, shifts, trends } = runChartAnalysis;

  /**
   * Custom dot renderer for the line chart.
   * Shift points are orange, trend points are purple, normal points use the
   * chart colour. If a point is both shift and trend, shift takes priority.
   */
  const renderDot = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: { shift?: boolean; trend?: boolean };
  }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    let fill = color;
    if (payload?.shift) fill = NMH_COLORS.orange;
    else if (payload?.trend) fill = "#8b5cf6"; // purple
    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={3} fill={fill} stroke="none" />;
  };

  const commonChartProps = {
    data: enrichedData,
    margin: { top: 5, right: 10, left: 10, bottom: 5 },
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart {...commonChartProps}>
            {commonAxisElements}
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        );
      case "area":
        return (
          <AreaChart {...commonChartProps}>
            {commonAxisElements}
            <defs>
              <linearGradient
                id={`gradient-${name.replace(/\s+/g, "-")}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${name.replace(/\s+/g, "-")})`}
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
              stroke={color}
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 5, fill: color }}
            />
          </LineChart>
        );
    }
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 hover:text-[#00b0ad] transition-colors"
            >
              {name}
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          ) : (
            name
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        {(shifts.length > 0 || trends.length > 0) && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {shifts.map((run, idx) => (
              <p key={`shift-${idx}`}>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: NMH_COLORS.orange }}
                />
                <strong>Shift detected</strong> — {run.length} consecutive points{" "}
                {enrichedData[run[0]].value > median ? "above" : "below"} median (
                {enrichedData[run[0]].period} – {enrichedData[run[run.length - 1]].period})
              </p>
            ))}
            {trends.map((run, idx) => (
              <p key={`trend-${idx}`}>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: "#8b5cf6" }}
                />
                <strong>Trend detected</strong> — {run.length} consecutive points{" "}
                {enrichedData[run[run.length - 1]].value > enrichedData[run[0]].value
                  ? "increasing"
                  : "decreasing"}{" "}
                ({enrichedData[run[0]].period} – {enrichedData[run[run.length - 1]].period})
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
