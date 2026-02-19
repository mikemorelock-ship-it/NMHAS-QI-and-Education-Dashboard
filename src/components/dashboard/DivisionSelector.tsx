"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Division {
  id: string;
  name: string;
  slug: string;
}

interface DivisionSelectorProps {
  divisions: Division[];
  activeSlug: string;
  onChange: (slug: string) => void;
}

/**
 * Horizontal, touch-friendly tab bar for switching between divisions.
 * Scrolls horizontally on small screens with the active tab auto-centered.
 * Minimum 48px tap targets for kiosk/touch-screen usage.
 */
export function DivisionSelector({ divisions, activeSlug, onChange }: DivisionSelectorProps) {
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
      aria-label="Division tabs"
    >
      {divisions.map((div) => {
        const isActive = div.slug === activeSlug;
        return (
          <button
            key={div.id}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(div.slug)}
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
            <span>{div.name}</span>
          </button>
        );
      })}
    </div>
  );
}
