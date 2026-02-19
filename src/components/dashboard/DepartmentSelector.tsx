"use client";

import { useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  slug: string;
  type: string;
}

interface DepartmentSelectorProps {
  departments: Department[];
  activeSlug: string;
  onChange: (slug: string) => void;
}

/**
 * Horizontal, touch-friendly tab bar for switching between departments.
 * Scrolls horizontally on small screens with the active tab auto-centered.
 * Minimum 48px tap targets for kiosk/touch-screen usage.
 */
export function DepartmentSelector({ departments, activeSlug, onChange }: DepartmentSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll the active tab into view when it changes
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeSlug]);

  return (
    <div
      ref={scrollRef}
      className="flex overflow-x-auto scrollbar-hide gap-1 border-b"
      role="tablist"
      aria-label="Department tabs"
    >
      {departments.map((dept) => {
        const isActive = dept.slug === activeSlug;
        return (
          <button
            key={dept.id}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(dept.slug)}
            className={cn(
              // 48px minimum touch target via min-h-12 (48px)
              "flex items-center gap-2 min-h-12 px-6 whitespace-nowrap",
              "text-sm font-medium transition-colors border-b-2 flex-shrink-0",
              "touch-manipulation select-none",
              isActive
                ? "border-[#00b0ad] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <span>{dept.name}</span>
            {/* Show type badge for real departments (not "All") */}
            {dept.type && (
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={cn("text-[10px] uppercase tracking-wider", isActive && "bg-[#00b0ad]")}
              >
                {dept.type === "quality"
                  ? "Quality"
                  : dept.type === "clinical"
                    ? "Clinical"
                    : dept.type === "education"
                      ? "Education"
                      : dept.type === "operations"
                        ? "Ops"
                        : dept.type}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
