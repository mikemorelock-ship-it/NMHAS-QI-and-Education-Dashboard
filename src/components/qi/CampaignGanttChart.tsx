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
  isToday,
} from "date-fns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ZoomLevel = "day" | "week" | "month";

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
  const [zoom, setZoom] = useState<ZoomLevel>("week");

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

    // Add padding
    const start = addDays(minDate, -7);
    const end = addDays(maxDate, 14);

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
    } else {
      cols = eachMonthOfInterval({ start, end }).map((d) => ({
        date: d,
        label: format(d, "MMM yyyy"),
      }));
    }

    return { timelineStart: start, timelineEnd: end, columns: cols };
  }, [campaigns, zoom]);

  const totalDays = differenceInDays(timelineEnd, timelineStart) || 1;

  const getBarStyle = (start: string | null, end: string | null) => {
    if (!start) return null;
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : addDays(startDate, 14);

    const leftPct =
      (differenceInDays(startDate, timelineStart) / totalDays) * 100;
    const widthPct =
      (differenceInDays(endDate, startDate) / totalDays) * 100;

    return {
      left: `${Math.max(0, leftPct)}%`,
      width: `${Math.max(1, widthPct)}%`,
    };
  };

  // Today line position
  const todayPct =
    (differenceInDays(new Date(), timelineStart) / totalDays) * 100;

  const colWidth = zoom === "day" ? 30 : zoom === "week" ? 80 : 120;

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
        {(["day", "week", "month"] as ZoomLevel[]).map((level) => (
          <Button
            key={level}
            variant={zoom === level ? "default" : "outline"}
            size="sm"
            onClick={() => setZoom(level)}
            className="capitalize text-xs h-7"
          >
            {level}
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
            <div className="flex-1 relative">
              <div className="flex">
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-center text-xs py-2 border-r text-muted-foreground",
                      zoom === "day" &&
                        isToday(col.date) &&
                        "bg-primary/5 font-semibold"
                    )}
                    style={{ width: colWidth }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Campaign Rows */}
          {campaigns.map((campaign) => {
            const barStyle = getBarStyle(campaign.startDate, campaign.endDate);
            const statusColor =
              CAMPAIGN_STATUS_COLORS[campaign.status] ?? "#4b4f54";

            return (
              <div
                key={campaign.id}
                className="flex border-b hover:bg-muted/20"
              >
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
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex">
                    {columns.map((_, i) => (
                      <div
                        key={i}
                        className="border-r border-dashed border-muted"
                        style={{ width: colWidth }}
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
                      <span className="text-xs text-muted-foreground italic">
                        No dates set
                      </span>
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
