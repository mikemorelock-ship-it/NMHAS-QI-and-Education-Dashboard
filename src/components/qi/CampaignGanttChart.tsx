"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

type ZoomLevel = "day" | "week" | "month" | "year" | "3year";

const ZOOM_LEVELS: { value: ZoomLevel; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "3year", label: "3 Year" },
];

const COL_WIDTHS: Record<ZoomLevel, number> = {
  day: 30,
  week: 80,
  month: 120,
  year: 100,
  "3year": 120,
};

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
  const [zoom, setZoom] = useState<ZoomLevel>("month");

  // Calculate timeline bounds from all campaign dates + today
  const { timelineStart, timelineEnd, columns } = useMemo(() => {
    const dates: Date[] = [];

    for (const c of campaigns) {
      if (c.startDate) dates.push(new Date(c.startDate));
      if (c.endDate) dates.push(new Date(c.endDate));
    }

    // Always include today
    dates.push(new Date());

    if (dates.length <= 1) {
      const now = new Date();
      dates.push(addDays(now, -14), addDays(now, 60));
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Wider padding for broader zoom levels
    const isWide = zoom === "year" || zoom === "3year";
    const start = addDays(minDate, isWide ? -30 : -7);
    const end = addDays(maxDate, isWide ? 60 : 14);

    let cols: { date: Date; label: string }[] = [];

    if (zoom === "day") {
      cols = eachDayOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "d"),
      }));
    } else if (zoom === "week") {
      cols = eachWeekOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "MMM d"),
      }));
    } else if (zoom === "month") {
      cols = eachMonthOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "MMM yyyy"),
      }));
    } else if (zoom === "year") {
      cols = eachQuarterOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "QQQ yyyy"),
      }));
    } else {
      // 3year
      cols = eachYearOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "yyyy"),
      }));
    }

    return { timelineStart: start, timelineEnd: end, columns: cols };
  }, [campaigns, zoom]);

  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;
  const colWidth = COL_WIDTHS[zoom];

  // Compute each column's percentage width based on its actual duration
  const columnPcts = useMemo(() => {
    return columns.map((col, i) => {
      const colStart = col.date;
      const colEnd = i < columns.length - 1 ? columns[i + 1].date : timelineEnd;
      const days = differenceInDays(colEnd, colStart);
      return (days / totalDays) * 100;
    });
  }, [columns, timelineEnd, totalDays]);

  // Total minimum width so columns aren't too narrow
  const totalMinWidth = columns.reduce((sum, _, i) => {
    const pctWidth = columnPcts[i];
    // Ensure each column is at least colWidth pixels
    return sum + Math.max(colWidth, (pctWidth / 100) * columns.length * colWidth);
  }, 0);

  const getBarStyle = (start: string | null, end: string | null) => {
    if (!start) return null;
    const startDate = new Date(start);
    // Wider fallback for broad zoom levels so bars remain visible
    const fallbackDays = zoom === "year" || zoom === "3year" ? 30 : 14;
    const endDate = end ? new Date(end) : addDays(startDate, fallbackDays);

    const leftPct = (differenceInDays(startDate, timelineStart) / totalDays) * 100;
    const widthPct = (differenceInDays(endDate, startDate) / totalDays) * 100;

    return {
      left: `${Math.max(0, leftPct)}%`,
      width: `${Math.max(1, widthPct)}%`,
    };
  };

  // Today line position
  const todayPct = (differenceInDays(new Date(), timelineStart) / totalDays) * 100;

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
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Zoom:</span>
        {ZOOM_LEVELS.map(({ value, label }) => (
          <Button
            key={value}
            variant={zoom === value ? "default" : "outline"}
            size="sm"
            onClick={() => setZoom(value)}
            className="text-xs h-7"
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Gantt Grid */}
      <div className="border rounded-lg overflow-x-auto">
        <div style={{ minWidth: columns.length * colWidth }}>
          {/* Timeline Header */}
          <div className="flex border-b bg-muted/30 sticky top-0 z-10">
            <div className="w-[200px] shrink-0 px-3 py-2 text-xs font-semibold border-r bg-card">
              Campaign
            </div>
            <div className="flex-1 flex">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-center text-xs py-2 border-r text-muted-foreground overflow-hidden",
                    zoom === "day" && isToday(col.date) && "bg-primary/5 font-semibold"
                  )}
                  style={{ width: `${columnPcts[i]}%` }}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Rows */}
          {campaigns.map((campaign) => {
            const barStyle = getBarStyle(campaign.startDate, campaign.endDate);
            const statusColor = CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#4b4f54";

            return (
              <div key={campaign.id} className="flex border-b hover:bg-muted/20">
                {/* Label */}
                <div className="w-[200px] shrink-0 px-3 py-2 text-sm border-r flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: statusColor }}
                    title={CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}
                  />
                  <Link
                    href={`${linkPrefix}/${campaign.linkId}`}
                    className="truncate hover:text-nmh-teal font-medium"
                  >
                    {campaign.name}
                  </Link>
                </div>

                {/* Timeline area */}
                <div className="flex-1 relative h-10">
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
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/50 z-10"
                    style={{ left: `${todayPct}%` }}
                  />

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
