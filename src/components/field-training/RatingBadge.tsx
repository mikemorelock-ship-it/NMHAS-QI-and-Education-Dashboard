import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RATING_LABELS: Record<number, string> = {
  1: "Not Acceptable",
  2: "Not Acceptable",
  3: "Below Standard",
  4: "Acceptable",
  5: "Above Standard",
  6: "Superior",
  7: "Superior",
};

export function RatingBadge({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  const label = RATING_LABELS[rounded] ?? "Unknown";
  const color =
    rounded === 1
      ? "bg-red-200 text-red-900"
      : rounded === 2
        ? "bg-red-100 text-red-800"
        : rounded === 3
          ? "bg-orange-100 text-orange-800"
          : rounded === 4
            ? "bg-gray-100 text-gray-800"
            : rounded === 5
              ? "bg-green-100 text-green-800"
              : rounded === 6
                ? "bg-green-200 text-green-900"
                : "bg-emerald-200 text-emerald-900";

  // Display with one decimal if it's not a whole number
  const displayValue = rating % 1 !== 0 ? rating.toFixed(1) : rating;

  return (
    <Badge
      className={cn("font-mono text-xs", color)}
      aria-label={`${displayValue} out of 7 – ${label}`}
    >
      {displayValue}/7
    </Badge>
  );
}
