"use client";

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
}: MetricChartProps) {
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
            position: "insideTopRight",
            fill: NMH_COLORS.orange,
            fontSize: 11,
          }}
        />
      )}
    </>
  );

  const commonChartProps = {
    data,
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
              dot={{ r: 3, fill: color }}
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
      </CardContent>
    </Card>
  );
}
