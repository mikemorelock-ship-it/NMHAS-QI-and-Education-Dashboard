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
  const label = RATING_LABELS[rating] ?? "Unknown";
  const color =
    rating === 1
      ? "bg-red-200 text-red-900"
      : rating === 2
        ? "bg-red-100 text-red-800"
        : rating === 3
          ? "bg-orange-100 text-orange-800"
          : rating === 4
            ? "bg-gray-100 text-gray-800"
            : rating === 5
              ? "bg-green-100 text-green-800"
              : rating === 6
                ? "bg-green-200 text-green-900"
                : "bg-emerald-200 text-emerald-900";
  return (
    <Badge
      className={cn("font-mono text-xs", color)}
      aria-label={`${rating} out of 7 – ${label}`}
    >
      {rating}/7
    </Badge>
  );
}
