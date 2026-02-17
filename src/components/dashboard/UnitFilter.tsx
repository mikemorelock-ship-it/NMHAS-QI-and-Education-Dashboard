"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface UnitOption {
  id: string;
  name: string;
}

interface UnitFilterProps {
  units: UnitOption[];
  activeId: string; // "" = all
  onChange: (id: string) => void;
  label?: string;
}

/**
 * Horizontal, touch-friendly pill bar for filtering by sub-unit (individual).
 * Shows "All" plus each unit as a selectable pill. Scrolls horizontally
 * and auto-centers the active pill on small screens.
 */
export function UnitFilter({
  units,
  activeId,
  onChange,
  label = "Filter by unit",
}: UnitFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeId]);

  if (units.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide gap-2 pb-1"
        role="radiogroup"
        aria-label={label}
      >
        {/* All option */}
        <button
          ref={activeId === "" ? activeRef : undefined}
          role="radio"
          aria-checked={activeId === ""}
          onClick={() => onChange("")}
          className={cn(
            "inline-flex items-center min-h-10 px-4 rounded-full text-sm font-medium",
            "whitespace-nowrap transition-colors flex-shrink-0",
            "touch-manipulation select-none border",
            activeId === ""
              ? "bg-[#00b0ad] text-white border-[#00b0ad] shadow-sm"
              : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
          )}
        >
          All
        </button>

        {units.map((unit) => {
          const isActive = unit.id === activeId;
          return (
            <button
              key={unit.id}
              ref={isActive ? activeRef : undefined}
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(unit.id)}
              className={cn(
                "inline-flex items-center min-h-10 px-4 rounded-full text-sm font-medium",
                "whitespace-nowrap transition-colors flex-shrink-0",
                "touch-manipulation select-none border",
                isActive
                  ? "bg-[#00b0ad] text-white border-[#00b0ad] shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
              )}
            >
              {unit.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
