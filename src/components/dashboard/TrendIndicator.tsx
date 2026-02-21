"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendIndicatorProps {
  value: number;
  direction: "up" | "down" | "flat";
}

export function TrendIndicator({ value, direction }: TrendIndicatorProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 text-sm font-medium",
        direction === "up" && "text-[var(--color-nmh-teal)]",
        direction === "down" && "text-[var(--color-nmh-orange)]",
        direction === "flat" && "text-muted-foreground"
      )}
    >
      {direction === "up" && <TrendingUp className="size-4" aria-hidden="true" />}
      {direction === "down" && <TrendingDown className="size-4" aria-hidden="true" />}
      {direction === "flat" && <Minus className="size-4" aria-hidden="true" />}
      <span>
        {direction === "flat" ? "0%" : `${direction === "up" ? "+" : "-"}${value.toFixed(1)}%`}
      </span>
    </div>
  );
}
