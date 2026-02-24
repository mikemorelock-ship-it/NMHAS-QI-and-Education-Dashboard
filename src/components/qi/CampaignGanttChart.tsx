"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CAMPAIGN_STATUS_COLORS, CAMPAIGN_STATUS_LABELS } from "@/lib/constants";
import {
  addDays,
  differenceInDays,
  format,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
  isToday,
} from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZoomPreset = "fit" | "day" | "month" | "quarter" | "year" | "2year" | "3year" | "custom";

/** Parse a YYYY-MM-DD string as local midnight (not UTC) */
function toLocalDate(str: string): Date {
  return new Date(str + "T00:00:00");
}

const ZOOM_PRESETS: { value: ZoomPreset; label: string }[] = [
  { value: "fit", label: "Fit All" },
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
  { value: "2year", label: "2 Year" },
  { value: "3year", label: "3 Year" },
  { value: "custom", label: "Custom" },
];

/** Forward days and leading padding for each named preset, ordered smallest → largest */
const PRESET_CONFIGS: { key: string; forwardDays: number; paddingBefore: number }[] = [
  { key: "day", forwardDays: 28, paddingBefore: 3 },
  { key: "month", forwardDays: 90, paddingBefore: 7 },
  { key: "quarter", forwardDays: 180, paddingBefore: 14 },
  { key: "year", forwardDays: 395, paddingBefore: 30 },
  { key: "2year", forwardDays: 760, paddingBefore: 30 },
  { key: "3year", forwardDays: 1125, paddingBefore: 60 },
];

/** Lookup helper for named presets */
const PRESET_CONFIG: Record<string, { forwardDays: number; paddingBefore: number }> =
  Object.fromEntries(PRESET_CONFIGS.map((p) => [p.key, p]));

/** Auto-select column granularity from the visible day range */
function getGranularity(rangeDays: number): "day" | "week" | "month" | "quarter" | "year" {
  if (rangeDays <= 45) return "day";
  if (rangeDays <= 120) return "week";
  if (rangeDays <= 730) return "month";
  if (rangeDays <= 1500) return "quarter";
  return "year";
}

/** Minimum pixel width per column for each granularity */
const COL_MIN_WIDTHS: Record<string, number> = {
  day: 40,
  week: 70,
  month: 90,
  quarter: 110,
  year: 130,
};

/** Width of the campaign name column (px) */
const CAMPAIGN_COL_WIDTH = 300;

export interface CampaignGanttItem {
  id: string;
  name: string;
  /** Used for linking — slug on public, id on admin */
  linkId: string;
  status: string;
  ownerName: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface Props {
  campaigns: CampaignGanttItem[];
  /** Link prefix for campaign rows, e.g. "/admin/campaigns" or "/quality-improvement/campaign" */
  linkPrefix: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CampaignGanttChart({ campaigns, linkPrefix }: Props) {
  const [zoom, setZoom] = useState<ZoomPreset>("fit");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Sort by soonest end date first; campaigns without end dates go last
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      if (!a.endDate && !b.endDate) return 0;
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return toLocalDate(a.endDate).getTime() - toLocalDate(b.endDate).getTime();
    });
  }, [campaigns]);

  // Calculate timeline bounds based on the active zoom preset
  const { timelineStart, timelineEnd, columns, granularity } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start: Date;
    let end: Date;

    if (zoom === "custom" && customStart && customEnd) {
      start = new Date(customStart + "T00:00:00");
      end = new Date(customEnd + "T00:00:00");
      if (end <= start) end = addDays(start, 30);
    } else if (zoom === "fit") {
      // Compute effective start and end dates for all campaigns
      const effectiveStarts = campaigns
        .map((c) => (c.startDate ? toLocalDate(c.startDate).getTime() : null))
        .filter((t): t is number => t !== null && !isNaN(t));

      const effectiveEnds = campaigns
        .map((c) => {
          if (c.endDate) return toLocalDate(c.endDate).getTime();
          if (c.startDate) return addDays(toLocalDate(c.startDate), 365).getTime();
          return null;
        })
        .filter((t): t is number => t !== null && !isNaN(t));

      // Start from the earlier of today or the earliest campaign start
      const earliestStart =
        effectiveStarts.length > 0
          ? new Date(Math.min(Math.min(...effectiveStarts), today.getTime()))
          : today;

      const latestEnd =
        effectiveEnds.length > 0 ? new Date(Math.max(...effectiveEnds)) : addDays(today, 90);

      // Add a small proportional buffer (5% of range, clamped 7–30 days)
      const rawRange = Math.max(differenceInDays(latestEnd, earliestStart), 30);
      const buffer = Math.min(30, Math.max(7, Math.round(rawRange * 0.05)));

      start = addDays(earliestStart, -buffer);
      end = addDays(latestEnd, buffer);
    } else {
      const config = PRESET_CONFIG[zoom] ?? { forwardDays: 90, paddingBefore: 14 };
      start = addDays(today, -config.paddingBefore);
      end = addDays(today, config.forwardDays);
    }

    const rangeDays = differenceInDays(end, start) || 1;
    const gran = getGranularity(rangeDays);

    let rawCols: { date: Date; label: string }[] = [];

    if (gran === "day") {
      rawCols = eachDayOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "MMM d"),
      }));
    } else if (gran === "week") {
      rawCols = eachWeekOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "MMM d"),
      }));
    } else if (gran === "month") {
      rawCols = eachMonthOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "MMM yyyy"),
      }));
    } else if (gran === "quarter") {
      rawCols = eachQuarterOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "QQQ yyyy"),
      }));
    } else {
      rawCols = eachYearOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "yyyy"),
      }));
    }

    // Clamp the first column to start no earlier than timelineStart so that
    // percentage widths always sum to exactly 100%.
    const cols = rawCols
      .filter((c) => c.date < end)
      .map((c, i) => (i === 0 && c.date < start ? { ...c, date: start } : c));

    return { timelineStart: start, timelineEnd: end, columns: cols, granularity: gran };
  }, [campaigns, zoom, customStart, customEnd]);

  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
  const colWidth = COL_MIN_WIDTHS[granularity] ?? 80;

  // Compute each column's percentage width based on its actual duration
  const columnPcts = useMemo(() => {
    return columns.map((col, i) => {
      const colStart = col.date;
      const colEnd = i < columns.length - 1 ? columns[i + 1].date : timelineEnd;
      const days = differenceInDays(colEnd, colStart);
      return (days / totalDays) * 100;
    });
  }, [columns, timelineEnd, totalDays]);

  const getBarStyle = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return null;
    const startDate = toLocalDate(startStr);
    const fallbackDays = totalDays > 365 ? 30 : 14;
    const endDate = endStr ? toLocalDate(endStr) : addDays(startDate, fallbackDays);

    // Compute left and right edges relative to the timeline, then clamp to
    // the visible area so bars starting before the timeline don't overshoot.
    const leftPct = (differenceInDays(startDate, timelineStart) / totalDays) * 100;
    const rightPct = (differenceInDays(endDate, timelineStart) / totalDays) * 100;

    const clampedLeft = Math.max(0, leftPct);
    const clampedWidth = Math.max(0.5, rightPct - clampedLeft);

    return {
      left: `${clampedLeft}%`,
      width: `${clampedWidth}%`,
    };
  };

  // Today line position (percentage)
  const todayPct = (differenceInDays(new Date(), timelineStart) / totalDays) * 100;

  /** When switching to Custom, pre-populate dates from current Fit bounds */
  function handleZoomChange(preset: ZoomPreset) {
    if (preset === "custom" && !customStart) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveStarts = campaigns
        .map((c) => (c.startDate ? toLocalDate(c.startDate).getTime() : null))
        .filter((t): t is number => t !== null && !isNaN(t));
      const effectiveEnds = campaigns
        .map((c) => {
          if (c.endDate) return toLocalDate(c.endDate).getTime();
          if (c.startDate) return addDays(toLocalDate(c.startDate), 365).getTime();
          return null;
        })
        .filter((t): t is number => t !== null && !isNaN(t));
      const earliestStart =
        effectiveStarts.length > 0
          ? new Date(Math.min(Math.min(...effectiveStarts), today.getTime()))
          : today;
      const latestEnd =
        effectiveEnds.length > 0 ? new Date(Math.max(...effectiveEnds)) : addDays(today, 90);
      const rawRange = Math.max(differenceInDays(latestEnd, earliestStart), 30);
      const buffer = Math.min(30, Math.max(7, Math.round(rawRange * 0.05)));
      setCustomStart(format(addDays(earliestStart, -buffer), "yyyy-MM-dd"));
      setCustomEnd(format(addDays(latestEnd, buffer), "yyyy-MM-dd"));
    }
    setZoom(preset);
  }

  if (campaigns.length === 0) {
    return (
      <div className="border rounded-lg py-8 text-center text-muted-foreground text-sm">
        No campaigns to display on the timeline.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">View:</span>
        {ZOOM_PRESETS.map(({ value, label }) => (
          <Button
            key={value}
            variant={zoom === value ? "default" : "outline"}
            size="sm"
            onClick={() => handleZoomChange(value)}
            className="text-xs h-7"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {zoom === "custom" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">From:</span>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-8 w-auto"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">To:</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-8 w-auto"
            />
          </div>
        </div>
      )}

      {/* Gantt Grid */}
      <div className="border rounded-lg overflow-x-auto">
        <div
          style={
            zoom === "fit"
              ? undefined
              : { minWidth: CAMPAIGN_COL_WIDTH + columns.length * colWidth }
          }
        >
          {/* Timeline Header */}
          <div className="flex border-b bg-muted/30 sticky top-0 z-10">
            <div
              className="shrink-0 px-3 py-2 text-xs font-semibold border-r bg-card"
              style={{ width: CAMPAIGN_COL_WIDTH }}
            >
              Campaign
            </div>
            <div className="flex-1 flex">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-center text-xs py-2 border-r text-muted-foreground overflow-hidden",
                    granularity === "day" && isToday(col.date) && "bg-primary/5 font-semibold"
                  )}
                  style={{ width: `${columnPcts[i]}%` }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Rows */}
          {sortedCampaigns.map((campaign) => {
            const barStyle = getBarStyle(campaign.startDate, campaign.endDate);
            const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#4b4f54";

            return (
              <div key={campaign.id} className="flex border-b hover:bg-muted/20 items-stretch">
                {/* Label */}
                <div
                  className="shrink-0 px-3 py-2 text-sm border-r flex items-center gap-2"
                  style={{ width: CAMPAIGN_COL_WIDTH }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusColor }}
                    title={CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                  />
                  <Link
                    href={`${linkPrefix}/${campaign.linkId}`}
                    className="hover:text-nmh-teal font-medium break-words"
                  >
                    {campaign.name}
                  </Link>
                </div>

                {/* Timeline area */}
                <div className="flex-1 relative min-h-[40px]">
                  {/* Grid lines — percentage-based to match header columns */}
                  <div className="absolute inset-0 flex">
                    {columns.map((_, i) => (
                      <div
                        key={i}
                        className="border-r border-dashed border-muted h-full"
                        style={{ width: `${columnPcts[i]}%` }}
                      />
                    ))}
                  </div>

                  {/* Today line */}
                  {todayPct >= 0 && todayPct <= 100 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-primary/50 z-10"
                      style={{ left: `${todayPct}%` }}
                    />
                  )}

                  {/* Campaign bar */}
                  {barStyle ? (
                    <div
                      className="absolute top-2 h-6 rounded-md"
                      style={{
                        ...barStyle,
                        backgroundColor: statusColor,
                      }}
                    >
                      <div className="px-2 text-xs text-white truncate leading-6 font-medium">
                        {campaign.name}
                      </div>
                    </div>
                  ) : (
                    /* No dates — show a subtle indicator */
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-muted-foreground italic">No dates set</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
