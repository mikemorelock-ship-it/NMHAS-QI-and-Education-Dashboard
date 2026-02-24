"use client";

import { LayoutGrid, BarChart3, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "cards" | "charts" | "list";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const VIEW_OPTIONS: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { mode: "cards", icon: LayoutGrid, label: "Cards" },
  { mode: "charts", icon: BarChart3, label: "Charts" },
  { mode: "list", icon: List, label: "List" },
];

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-lg border bg-card p-0.5 gap-0.5"
      role="radiogroup"
      aria-label="View mode"
    >
      {VIEW_OPTIONS.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-md text-sm font-medium transition-colors",
            "touch-manipulation select-none",
            value === mode
              ? "bg-[#00b0ad] text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
