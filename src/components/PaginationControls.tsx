"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/lib/pagination";

interface PaginationControlsProps {
  /** Pagination metadata from paginatedQuery() */
  pagination: PaginationMeta;
  /** Base path for building pagination links (e.g., "/admin/data-entry") */
  basePath: string;
  /** Any existing search params to preserve when navigating pages */
  searchParams?: Record<string, string | string[] | undefined>;
  /** Whether to show the page size selector (default: false) */
  showPageSize?: boolean;
}

/**
 * Reusable pagination controls for admin list pages.
 *
 * Uses Next.js Link components for server-side rendering compatibility
 * (no client-side router needed). Preserves existing search params
 * (filters, search queries, etc.) when navigating between pages.
 */
export function PaginationControls({
  pagination,
  basePath,
  searchParams = {},
}: PaginationControlsProps) {
  const { page, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage } = pagination;

  if (totalPages <= 1) {
    // Still show count when there's only 1 page but items exist
    if (totalItems > 0) {
      return (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1 py-2">
          <span>
            Showing {totalItems} {totalItems === 1 ? "item" : "items"}
          </span>
        </div>
      );
    }
    return null;
  }

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  function buildUrl(targetPage: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || key === "pageSize") continue;
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
    params.set("page", String(targetPage));
    if (pageSize !== 25) {
      params.set("pageSize", String(pageSize));
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  // Calculate visible page numbers (show max 5 pages around current)
  const pageNumbers: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground px-1 py-3">
      <span>
        Showing {startItem}–{endItem} of {totalItems}
      </span>

      <div className="flex items-center gap-1">
        {/* First page */}
        {hasPreviousPage ? (
          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
            <Link href={buildUrl(1)} aria-label="First page">
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Previous page */}
        {hasPreviousPage ? (
          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
            <Link href={buildUrl(page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Page numbers */}
        {start > 1 && <span className="px-1 text-muted-foreground">...</span>}
        {pageNumbers.map((p) => (
          <Button
            key={p}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-8 w-8"
            asChild={p !== page}
          >
            {p === page ? <span>{p}</span> : <Link href={buildUrl(p)}>{p}</Link>}
          </Button>
        ))}
        {end < totalPages && <span className="px-1 text-muted-foreground">...</span>}

        {/* Next page */}
        {hasNextPage ? (
          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
            <Link href={buildUrl(page + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="h-8 w-8" disabled aria-label="Next page">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}

        {/* Last page */}
        {hasNextPage ? (
          <Button variant="outline" size="icon" className="h-8 w-8" asChild>
            <Link href={buildUrl(totalPages)} aria-label="Last page">
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="h-8 w-8" disabled aria-label="Last page">
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
