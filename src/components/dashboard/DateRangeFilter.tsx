"use client";

import { useState, useCallback, useMemo } from "react";
import { format, subMonths, startOfMonth, isAfter } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DateRangeFilterProps {
  value: string;
  onChange: (range: string) => void;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS = [
  { label: "1 Mo", value: "1mo" },
  { label: "3 Mo", value: "3mo" },
  { label: "6 Mo", value: "6mo" },
  { label: "1 Year", value: "1yr" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
] as const;

const SHORTCUTS = [
  { label: "Last 30 days", days: 30, months: 0, yearToDate: false },
  { label: "Last 90 days", days: 90, months: 0, yearToDate: false },
  { label: "Year to date", days: 0, months: 0, yearToDate: true },
  { label: "Last 12 months", days: 0, months: 12, yearToDate: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a "custom:YYYY-MM-DD:YYYY-MM-DD" string back into a DateRange */
function parseCustomRange(value: string): DateRange | undefined {
  if (!value.startsWith("custom:")) return undefined;
  const parts = value.split(":");
  if (parts.length !== 3) return undefined;
  const from = new Date(parts[1] + "T00:00:00");
  const to = new Date(parts[2] + "T00:00:00");
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return undefined;
  return { from, to };
}

/** Format a Date to YYYY-MM-DD for the URL param */
function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  const isCustom = value.startsWith("custom:");
  const activePreset = PRESETS.find((p) => p.value === value)?.value ?? null;

  const customRange = useMemo(() => parseCustomRange(value), [value]);

  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(
    customRange
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setPendingRange(
          customRange ?? {
            from: startOfMonth(subMonths(new Date(), 3)),
            to: new Date(),
          }
        );
      }
      setOpen(nextOpen);
    },
    [customRange]
  );

  const applyCustomRange = useCallback(() => {
    if (pendingRange?.from && pendingRange?.to) {
      let from = pendingRange.from;
      let to = pendingRange.to;
      if (isAfter(from, to)) {
        [from, to] = [to, from];
      }
      onChange(`custom:${toDateStr(from)}:${toDateStr(to)}`);
      setOpen(false);
    }
  }, [pendingRange, onChange]);

  const clearCustom = useCallback(() => {
    onChange("1yr");
  }, [onChange]);

  const customDisplayText = useMemo(() => {
    if (!isCustom || !customRange?.from || !customRange?.to) return null;
    return `${format(customRange.from, "MMM d, yyyy")} – ${format(customRange.to, "MMM d, yyyy")}`;
  }, [isCustom, customRange]);

  // Summary text shown inside the popover
  const pendingSummary = useMemo(() => {
    if (!pendingRange?.from) return "Pick a start date";
    if (!pendingRange?.to)
      return `${format(pendingRange.from, "MMM d, yyyy")} → pick end date`;
    return `${format(pendingRange.from, "MMM d, yyyy")} → ${format(pendingRange.to, "MMM d, yyyy")}`;
  }, [pendingRange]);

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="group"
      aria-label="Date range filter"
    >
      {/* Quick preset pills */}
      {PRESETS.map((preset) => {
        const isActive = preset.value === activePreset;
        return (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            aria-pressed={isActive}
            className={cn(
              "min-h-12 min-w-12 px-4 rounded-lg text-sm font-medium",
              "transition-colors touch-manipulation select-none",
              isActive
                ? "bg-[#00b0ad] text-white shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {preset.label}
          </button>
        );
      })}

      {/* Divider */}
      <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

      {/* Custom date range picker */}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant={isCustom ? "default" : "outline"}
            className={cn(
              "min-h-12 gap-2 text-sm font-medium rounded-lg touch-manipulation",
              isCustom
                ? "bg-[#00b0ad] hover:bg-[#009e9b] text-white shadow-sm"
                : "hover:bg-secondary/80"
            )}
          >
            <CalendarIcon className="size-4" />
            {customDisplayText ?? "Custom"}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-auto p-0 rounded-xl shadow-xl border-border/50"
          sideOffset={8}
        >
          {/* Selection summary bar */}
          <div className="px-5 pt-4 pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[13px] font-semibold text-foreground">
                Custom Range
              </p>
              <p
                className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-md",
                  pendingRange?.from && pendingRange?.to
                    ? "bg-[#00b0ad]/10 text-[#00b0ad]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {pendingSummary}
              </p>
            </div>
          </div>

          {/* Quick range shortcuts */}
          <div className="px-5 py-3 border-b border-border/30 flex gap-1.5 flex-wrap">
            {SHORTCUTS.map((shortcut) => (
              <button
                key={shortcut.label}
                onClick={() => {
                  const to = new Date();
                  let from: Date;
                  if (shortcut.yearToDate) {
                    from = new Date(to.getFullYear(), 0, 1);
                  } else if (shortcut.months > 0) {
                    from = subMonths(to, shortcut.months);
                  } else {
                    from = new Date(to);
                    from.setDate(from.getDate() - shortcut.days);
                  }
                  setPendingRange({ from, to });
                }}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md",
                  "border border-transparent",
                  "bg-muted/60 text-muted-foreground",
                  "hover:bg-[#00b0ad]/10 hover:text-[#00b0ad] hover:border-[#00b0ad]/20",
                  "transition-all duration-150"
                )}
              >
                {shortcut.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="px-2 py-3">
            <Calendar
              mode="range"
              selected={pendingRange}
              onSelect={setPendingRange}
              numberOfMonths={2}
              disabled={(date) => isAfter(date, new Date())}
              defaultMonth={
                pendingRange?.from
                  ? pendingRange.from
                  : subMonths(new Date(), 1)
              }
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/50 bg-muted/20 rounded-b-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!pendingRange?.from || !pendingRange?.to}
              onClick={applyCustomRange}
              className="bg-[#00b0ad] hover:bg-[#009e9b] text-white shadow-sm px-5"
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear custom filter badge */}
      {isCustom && (
        <button
          onClick={clearCustom}
          className="inline-flex items-center gap-1 min-h-8 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors touch-manipulation"
          aria-label="Clear custom date range"
        >
          <X className="size-3" />
          Clear
        </button>
      )}
    </div>
  );
}
