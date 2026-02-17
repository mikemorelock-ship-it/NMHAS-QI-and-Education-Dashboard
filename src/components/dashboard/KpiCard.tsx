"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMetricValue, cn } from "@/lib/utils";
import { NMH_COLORS } from "@/lib/constants";

interface KpiCardProps {
  name: string;
  value: number;
  unit: string;
  trend: number;
  target: number | null;
  sparkline: number[];
  className?: string;
  href?: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}

export function KpiCard({
  name,
  value,
  unit,
  trend,
  target,
  sparkline,
  className,
  href,
  rateMultiplier,
  rateSuffix,
}: KpiCardProps) {
  const direction = trend > 0.5 ? "up" : trend < -0.5 ? "down" : "flat";

  const sparklineData = sparkline.map((v, i) => ({ index: i, value: v }));

  // Determine if being on-target or above is "good" (most metrics: higher is better)
  const atOrAboveTarget =
    target !== null && value >= target;

  const cardContent = (
    <Card
      className={cn(
        "relative min-h-[140px] p-4 rounded-xl shadow-sm",
        "flex flex-col justify-between gap-2",
        "touch-manipulation select-none",
        "transition-all hover:shadow-md",
        href && "cursor-pointer group hover:border-[#00b0ad]/30",
        className
      )}
    >
      {/* Top row: metric name + sparkline */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground truncate leading-tight">
            {name}
            {href && (
              <ArrowRight className="inline-block size-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-[#00b0ad]" />
            )}
          </p>
          <p className="text-3xl font-bold tracking-tight mt-1 lg:text-4xl">
            {formatMetricValue(value, unit, rateMultiplier, rateSuffix)}
          </p>
        </div>

        {/* Mini sparkline chart */}
        {sparklineData.length > 1 && (
          <div className="w-20 h-10 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={NMH_COLORS.teal}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom row: trend + target */}
      <div className="flex items-center justify-between gap-2">
        {/* Trend indicator */}
        <div
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium",
            direction === "up" && "text-[#00b0ad]",
            direction === "down" && "text-[#e04726]",
            direction === "flat" && "text-muted-foreground"
          )}
        >
          {direction === "up" && <TrendingUp className="size-4" />}
          {direction === "down" && <TrendingDown className="size-4" />}
          {direction === "flat" && <Minus className="size-4" />}
          <span>
            {direction === "flat"
              ? "No change"
              : `${direction === "up" ? "+" : "-"}${Math.abs(trend).toFixed(1)}%`}
          </span>
        </div>

        {/* Target badge */}
        {target !== null && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              atOrAboveTarget
                ? "bg-[#00b0ad]/10 text-[#00b0ad]"
                : "bg-[#e04726]/10 text-[#e04726]"
            )}
          >
            Target: {formatMetricValue(target, unit, rateMultiplier, rateSuffix)}
          </span>
        )}
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{cardContent}</Link>;
  }

  return cardContent;
}
