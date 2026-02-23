"use client";

import Link from "next/link";
import { LineChart, Line, ResponsiveContainer } from "recharts";
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
  desiredDirection?: "up" | "down";
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
  desiredDirection = "up",
  rateMultiplier,
  rateSuffix,
}: KpiCardProps) {
  const direction = trend > 0.5 ? "up" : trend < -0.5 ? "down" : "flat";

  // Determine if the current trend is favorable based on desiredDirection
  const isFavorable = direction === "flat" ? null : direction === desiredDirection;

  const sparklineData = sparkline.map((v, i) => ({ index: i, value: v }));

  // Determine if being on-target is "good" based on desiredDirection
  const meetsTarget =
    target !== null && (desiredDirection === "down" ? value <= target : value >= target);

  const cardContent = (
    <Card
      className={cn(
        "relative min-h-[140px] h-full p-4 rounded-xl shadow-sm",
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
              <ArrowRight
                className="inline-block size-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-[#00b0ad]"
                aria-hidden="true"
              />
            )}
          </p>
          <p className="text-3xl font-bold tracking-tight mt-1 lg:text-4xl">
            {formatMetricValue(value, unit, rateMultiplier, rateSuffix)}
          </p>
        </div>

        {/* Mini sparkline chart */}
        {sparklineData.length > 1 && (
          <div className="w-20 h-10 flex-shrink-0" aria-hidden="true">
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
            isFavorable === true && "text-[#00b0ad]",
            isFavorable === false && "text-[#e04726]",
            isFavorable === null && "text-muted-foreground"
          )}
        >
          {direction === "up" && <TrendingUp className="size-4" aria-hidden="true" />}
          {direction === "down" && <TrendingDown className="size-4" aria-hidden="true" />}
          {direction === "flat" && <Minus className="size-4" aria-hidden="true" />}
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
              meetsTarget ? "bg-[#00b0ad]/10 text-[#00b0ad]" : "bg-[#e04726]/10 text-[#e04726]"
            )}
          >
            Target: {formatMetricValue(target, unit, rateMultiplier, rateSuffix)}
            <span className="sr-only">{meetsTarget ? " (on target)" : " (off target)"}</span>
          </span>
        )}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
