"use client";

import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "cards" | "list";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-lg border bg-card p-0.5 gap-0.5"
      role="radiogroup"
      aria-label="View mode"
    >
      <button
        role="radio"
        aria-checked={value === "cards"}
        onClick={() => onChange("cards")}
        className={cn(
          "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-md text-sm font-medium transition-colors",
          "touch-manipulation select-none",
          value === "cards"
            ? "bg-[#00b0ad] text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGrid className="size-4" />
        <span className="hidden sm:inline">Cards</span>
      </button>
      <button
        role="radio"
        aria-checked={value === "list"}
        onClick={() => onChange("list")}
        className={cn(
          "inline-flex items-center gap-1.5 min-h-9 px-3 rounded-md text-sm font-medium transition-colors",
          "touch-manipulation select-none",
          value === "list"
            ? "bg-[#00b0ad] text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <List className="size-4" />
        <span className="hidden sm:inline">List</span>
      </button>
    </div>
  );
}
