"use client";

import { ResponsiveContainer, ComposedChart, Line, ReferenceLine, YAxis } from "recharts";
import { NMH_COLORS } from "@/lib/constants";
import type { SPCChartData } from "@/types";

interface MiniControlChartProps {
  spcData: SPCChartData;
  target?: number | null;
}

/**
 * Renders a dot that is red/larger for special cause, teal/smaller for normal.
 */
function MiniDot(props: { cx?: number; cy?: number; payload?: { specialCause?: boolean } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;

  const isSpecial = payload?.specialCause ?? false;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSpecial ? 4 : 2.5}
      fill={isSpecial ? NMH_COLORS.orange : NMH_COLORS.teal}
      stroke={isSpecial ? NMH_COLORS.darkRed : NMH_COLORS.teal}
      strokeWidth={isSpecial ? 1.5 : 0.5}
    />
  );
}

/**
 * Simplified control chart for display inside KPI cards.
 * Shows the data line with UCL/LCL dashed lines, center line, and
 * special cause dots. No tooltips, legends, or annotations.
 */
export function MiniControlChart({ spcData, target }: MiniControlChartProps) {
  if (!spcData || spcData.points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        Not enough data
      </div>
    );
  }

  // Use fixed-limit points if available for cleaner mini chart display
  const points = spcData.fixedPoints ?? spcData.points;

  // Compute Y domain from data + limits
  const allValues = points.flatMap((p) => [p.value, p.ucl, p.lcl]);
  if (target != null) allValues.push(target);
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yPadding = (yMax - yMin) * 0.12 || 1;

  return (
    <div className="w-full h-full" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <YAxis domain={[Math.floor(yMin - yPadding), Math.ceil(yMax + yPadding)]} hide />

          {/* UCL line (dashed, orange) */}
          <Line
            type="monotone"
            dataKey="ucl"
            stroke={NMH_COLORS.orange}
            strokeDasharray="4 2"
            strokeWidth={1}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          {/* LCL line (dashed, orange) */}
          <Line
            type="monotone"
            dataKey="lcl"
            stroke={NMH_COLORS.orange}
            strokeDasharray="4 2"
            strokeWidth={1}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />

          {/* Center line */}
          <ReferenceLine
            y={spcData.centerLine}
            stroke={NMH_COLORS.teal}
            strokeDasharray="3 3"
            strokeWidth={1}
          />

          {/* Target line */}
          {target != null && (
            <ReferenceLine
              y={target}
              stroke={NMH_COLORS.yellow}
              strokeDasharray="6 3"
              strokeWidth={1}
            />
          )}

          {/* Data line with special cause dots */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={NMH_COLORS.teal}
            strokeWidth={1.5}
            dot={MiniDot}
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
