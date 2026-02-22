"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { NMH_COLORS } from "@/lib/constants";
import type { SPCChartData, QIAnnotation } from "@/types";
import { formatMetricValue } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ControlChartProps {
  spcData: SPCChartData;
  unit: string;
  target?: number | null;
  className?: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
  annotations?: QIAnnotation[];
}

// ---------------------------------------------------------------------------
// Custom dot renderer: red for special cause, teal for normal
// ---------------------------------------------------------------------------

function CustomDot(props: { cx?: number; cy?: number; payload?: { specialCause?: boolean } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;

  const isSpecial = payload?.specialCause ?? false;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isSpecial ? 5 : 3.5}
      fill={isSpecial ? NMH_COLORS.orange : NMH_COLORS.teal}
      stroke={isSpecial ? NMH_COLORS.darkRed : NMH_COLORS.teal}
      strokeWidth={isSpecial ? 2 : 1}
    />
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

function ControlChartTooltip({
  active,
  payload,
  unit,
  rateMultiplier,
  rateSuffix,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }>;
  unit: string;
  rateMultiplier?: number | null;
  rateSuffix?: string | null;
}) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload ?? {};
  const value = data.value as number | undefined;
  const ucl = data.ucl as number | undefined;
  const lcl = data.lcl as number | undefined;
  const centerLine = data.centerLine as number | undefined;
  const period = data.period as string | undefined;
  const specialCause = data.specialCause as boolean | undefined;
  const specialCauseRules = data.specialCauseRules as string[] | undefined;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm max-w-[280px]">
      <p className="font-semibold text-gray-700 mb-1.5">{period}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Value:</span>
          <span className="font-mono font-medium" style={{ color: NMH_COLORS.teal }}>
            {value != null ? formatMetricValue(value, unit, rateMultiplier, rateSuffix) : "--"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Center:</span>
          <span className="font-mono text-gray-600">
            {centerLine != null
              ? formatMetricValue(centerLine, unit, rateMultiplier, rateSuffix)
              : "--"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">UCL:</span>
          <span className="font-mono text-gray-600">
            {ucl != null ? formatMetricValue(ucl, unit, rateMultiplier, rateSuffix) : "--"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">LCL:</span>
          <span className="font-mono text-gray-600">
            {lcl != null ? formatMetricValue(lcl, unit, rateMultiplier, rateSuffix) : "--"}
          </span>
        </div>
      </div>
      {specialCause && specialCauseRules && specialCauseRules.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-xs font-medium" style={{ color: NMH_COLORS.orange }}>
            Special Cause Detected
          </p>
          {specialCauseRules.map((rule, i) => (
            <p key={i} className="text-xs text-gray-500 mt-0.5">
              {rule}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom annotation label for vertical reference lines — renders rotated text
// that extends downward inside the chart area so it doesn't clip.
// ---------------------------------------------------------------------------

function AnnotationLabel({
  viewBox,
  value,
  fill,
}: {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  value?: string;
  fill: string;
}) {
  if (!viewBox || viewBox.x == null || viewBox.y == null) return null;

  return (
    <text
      x={viewBox.x + 4}
      y={(viewBox.y ?? 0) + 14}
      fill={fill}
      fontSize={9}
      textAnchor="start"
      transform={`rotate(-90, ${viewBox.x + 4}, ${(viewBox.y ?? 0) + 14})`}
    >
      {value}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ControlChart({
  spcData,
  unit,
  target,
  className,
  rateMultiplier,
  rateSuffix,
  annotations,
}: ControlChartProps) {
  if (!spcData || spcData.points.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Not enough data for control chart analysis.
      </div>
    );
  }

  // Determine Y-axis domain from data + limits
  const allValues = spcData.points.flatMap((p) => [p.value, p.ucl, p.lcl]);
  if (target != null) allValues.push(target);
  const yMin = Math.min(...allValues);
  const yMax = Math.max(...allValues);
  const yPadding = (yMax - yMin) * 0.1 || 1;

  const specialCauseCount = spcData.points.filter((p) => p.specialCause).length;

  const hasAnnotations = annotations && annotations.length > 0;
  const chartTopMargin = hasAnnotations ? 20 : 10;

  return (
    <div className={className}>
      {/* Individuals Chart */}
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={hasAnnotations ? 380 : 350}>
          <ComposedChart
            data={spcData.points}
            margin={{ top: chartTopMargin, right: 30, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              domain={[Math.floor(yMin - yPadding), Math.ceil(yMax + yPadding)]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v: number) => formatMetricValue(v, unit, rateMultiplier, rateSuffix)}
            />
            <Tooltip
              content={
                <ControlChartTooltip
                  unit={unit}
                  rateMultiplier={rateMultiplier}
                  rateSuffix={rateSuffix}
                />
              }
            />
            <Legend verticalAlign="top" height={36} iconType="plainline" />

            {/* UCL line (dashed, orange) */}
            <Line
              type="monotone"
              dataKey="ucl"
              name="UCL"
              stroke={NMH_COLORS.orange}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              legendType="plainline"
            />

            {/* LCL line (dashed, orange) */}
            <Line
              type="monotone"
              dataKey="lcl"
              name="LCL"
              stroke={NMH_COLORS.orange}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              legendType="plainline"
            />

            {/* Center line */}
            <ReferenceLine
              y={spcData.centerLine}
              stroke={NMH_COLORS.teal}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `CL: ${formatMetricValue(spcData.centerLine, unit, rateMultiplier, rateSuffix)}`,
                position: "insideTopRight",
                fill: NMH_COLORS.teal,
                fontSize: 11,
              }}
            />

            {/* Target line (if set) */}
            {target != null && (
              <ReferenceLine
                y={target}
                stroke={NMH_COLORS.yellow}
                strokeDasharray="8 4"
                strokeWidth={1}
                label={{
                  value: `Target: ${formatMetricValue(target, unit, rateMultiplier, rateSuffix)}`,
                  position: "insideBottomRight",
                  fill: NMH_COLORS.yellow,
                  fontSize: 10,
                }}
              />
            )}

            {/* QI Annotation vertical lines */}
            {annotations?.map((ann) => {
              const color = ann.type === "pdsa" ? "#7c3aed" : NMH_COLORS.teal;
              return (
                <ReferenceLine
                  key={ann.id}
                  x={ann.period}
                  stroke={color}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={<AnnotationLabel value={ann.label} fill={color} />}
                />
              );
            })}

            {/* Data line */}
            <Line
              type="monotone"
              dataKey="value"
              name="Value"
              stroke={NMH_COLORS.teal}
              strokeWidth={2}
              dot={CustomDot}
              activeDot={{ r: 6, stroke: NMH_COLORS.darkTeal, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Moving Range Chart (for I-MR) */}
      {spcData.chartType === "i-mr" && spcData.movingRange && spcData.movingRange.length > 0 && (
        <div className="mt-4" aria-hidden="true">
          <p className="text-xs font-medium text-muted-foreground mb-2 ml-1">Moving Range</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart
              data={spcData.movingRange}
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                tickFormatter={(v: number) =>
                  formatMetricValue(v, unit, rateMultiplier, rateSuffix)
                }
              />
              <Tooltip
                formatter={
                  ((value: number | undefined, name: string | undefined) => [
                    formatMetricValue(Number(value ?? 0), unit, rateMultiplier, rateSuffix),
                    name === "ucl" ? "UCL" : name === "centerLine" ? "CL" : "MR",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ]) as any
                }
                labelFormatter={(label) => String(label ?? "")}
              />

              {/* MR UCL line */}
              <Line
                type="monotone"
                dataKey="ucl"
                name="UCL"
                stroke={NMH_COLORS.orange}
                strokeDasharray="6 3"
                strokeWidth={1}
                dot={false}
                activeDot={false}
              />

              {/* MR Center line */}
              <ReferenceLine
                y={spcData.movingRange[0]?.centerLine ?? 0}
                stroke={NMH_COLORS.gray}
                strokeDasharray="4 4"
                strokeWidth={1}
              />

              {/* MR data line */}
              <Line
                type="monotone"
                dataKey="value"
                name="Moving Range"
                stroke={NMH_COLORS.gray}
                strokeWidth={1.5}
                dot={{ r: 2, fill: NMH_COLORS.gray }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <span className="sr-only">
        Control chart summary: {spcData.chartType.toUpperCase()} chart with {spcData.points.length}{" "}
        data points and {specialCauseCount} special cause{specialCauseCount !== 1 ? "s" : ""}.
      </span>
      {/* SPC summary */}
      <div className="flex flex-wrap gap-4 mt-3 px-2 text-xs text-muted-foreground">
        <span>
          Chart: <strong className="text-foreground">{spcData.chartType.toUpperCase()}</strong>
        </span>
        <span>
          Center Line:{" "}
          <strong className="text-foreground">
            {formatMetricValue(spcData.centerLine, unit, rateMultiplier, rateSuffix)}
          </strong>
        </span>
        {spcData.points.length > 0 && (
          <>
            <span>
              UCL:{" "}
              <strong className="text-foreground">
                {formatMetricValue(
                  spcData.points[spcData.points.length - 1].ucl,
                  unit,
                  rateMultiplier,
                  rateSuffix
                )}
              </strong>
            </span>
            <span>
              LCL:{" "}
              <strong className="text-foreground">
                {formatMetricValue(
                  spcData.points[spcData.points.length - 1].lcl,
                  unit,
                  rateMultiplier,
                  rateSuffix
                )}
              </strong>
            </span>
          </>
        )}
        <span>
          Special Causes:{" "}
          <strong className={specialCauseCount > 0 ? "text-orange-600" : "text-foreground"}>
            {specialCauseCount}
          </strong>
        </span>
      </div>
    </div>
  );
}
