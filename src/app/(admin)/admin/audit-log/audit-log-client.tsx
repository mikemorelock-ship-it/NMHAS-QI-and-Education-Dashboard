"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format } from "date-fns";
import { ScrollText, Search, Filter, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/PaginationControls";
import type { AuditLogViewRow, AuditLogFilters, AuditLogLookupData } from "@/actions/audit-log";
import type { PaginationMeta } from "@/lib/pagination";

// ---------------------------------------------------------------------------
// Inline audit changes parser (avoids importing @/lib/audit which pulls in Prisma)
// ---------------------------------------------------------------------------

interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

function parseAuditChanges(changesJson: string | null): AuditChanges | null {
  if (!changesJson) return null;
  try {
    return JSON.parse(changesJson) as AuditChanges;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Action badge color mapping
// ---------------------------------------------------------------------------

function actionBadgeVariant(action: string): string {
  const upper = action.toUpperCase();
  if (upper.includes("CREATE"))
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (upper.includes("UPDATE"))
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (upper.includes("DELETE"))
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (upper.includes("LOGIN"))
    return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  if (upper.includes("SECURITY"))
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  items: AuditLogViewRow[];
  pagination: PaginationMeta;
  lookup: AuditLogLookupData;
  filters: AuditLogFilters;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogClient({ items, pagination, lookup, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Push filter changes to URL
  function updateFilters(updates: Partial<AuditLogFilters>) {
    const params = new URLSearchParams(searchParams.toString());

    // Reset to page 1 when filters change
    params.delete("page");

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined);

  // Build searchParams record for PaginationControls
  const currentParams: Record<string, string | string[] | undefined> = {};
  searchParams.forEach((value, key) => {
    currentParams[key] = value;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScrollText className="h-7 w-7 text-nmh-teal" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Track all system changes and user activity
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Action filter */}
            <Select
              value={filters.action ?? "__all__"}
              onValueChange={(v) => updateFilters({ action: v === "__all__" ? undefined : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Actions</SelectItem>
                {lookup.actions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity filter */}
            <Select
              value={filters.entity ?? "__all__"}
              onValueChange={(v) => updateFilters({ entity: v === "__all__" ? undefined : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Entities</SelectItem>
                {lookup.entities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Actor filter */}
            <Select
              value={filters.actorId ?? "__all__"}
              onValueChange={(v) => updateFilters({ actorId: v === "__all__" ? undefined : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Users</SelectItem>
                {lookup.actors.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity ID search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Entity ID..."
                className="pl-9"
                defaultValue={filters.entityId ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateFilters({ entityId: e.currentTarget.value || undefined });
                  }
                }}
                onBlur={(e) => {
                  if (e.currentTarget.value !== (filters.entityId ?? "")) {
                    updateFilters({ entityId: e.currentTarget.value || undefined });
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {/* Text search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search details..."
                className="pl-9"
                defaultValue={filters.search ?? ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateFilters({ search: e.currentTarget.value || undefined });
                  }
                }}
                onBlur={(e) => {
                  if (e.currentTarget.value !== (filters.search ?? "")) {
                    updateFilters({ search: e.currentTarget.value || undefined });
                  }
                }}
              />
            </div>

            {/* Start date */}
            <Input
              type="date"
              placeholder="Start date"
              value={filters.startDate ?? ""}
              onChange={(e) => updateFilters({ startDate: e.target.value || undefined })}
            />

            {/* End date */}
            <Input
              type="date"
              placeholder="End date"
              value={filters.endDate ?? ""}
              onChange={(e) => updateFilters({ endDate: e.target.value || undefined })}
            />

            {/* Clear button */}
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="pt-6">
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No audit log entries found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Audit entries will appear here as actions are performed"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => {
                    const hasChanges = row.changes !== null;
                    const isExpanded = expandedRows.has(row.id);
                    const changes = isExpanded ? parseAuditChanges(row.changes) : null;

                    return (
                      <Fragment key={row.id}>
                        <TableRow
                          className={hasChanges ? "cursor-pointer hover:bg-muted/50" : ""}
                          onClick={() => hasChanges && toggleRow(row.id)}
                        >
                          <TableCell className="w-8">
                            {hasChanges &&
                              (isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              ))}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(row.createdAt), "MMM d, yyyy h:mm a")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={actionBadgeVariant(row.action)}>
                              {row.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{row.entity}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[120px] truncate">
                            {row.entityId}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.actorName ?? (
                              <span className="text-muted-foreground italic">
                                {row.actorType ?? "System"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {row.details}
                          </TableCell>
                        </TableRow>

                        {/* Expanded change diff */}
                        {isExpanded && changes && (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={6}>
                              <Card className="bg-muted/40 border-dashed">
                                <CardContent className="pt-4 pb-4">
                                  <p className="text-xs font-semibold text-muted-foreground mb-3">
                                    Changes
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    {/* Before column */}
                                    <div>
                                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                                        Before
                                      </p>
                                      {changes.before &&
                                        Object.entries(changes.before).map(([field, value]) => (
                                          <div key={field} className="mb-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              {field}:
                                            </span>{" "}
                                            <span className="text-xs bg-red-100 dark:bg-red-900/20 px-1.5 py-0.5 rounded">
                                              {value === null
                                                ? "null"
                                                : typeof value === "object"
                                                  ? JSON.stringify(value)
                                                  : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                    </div>

                                    {/* After column */}
                                    <div>
                                      <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                                        After
                                      </p>
                                      {changes.after &&
                                        Object.entries(changes.after).map(([field, value]) => (
                                          <div key={field} className="mb-1.5">
                                            <span className="text-xs font-medium text-muted-foreground">
                                              {field}:
                                            </span>{" "}
                                            <span className="text-xs bg-green-100 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                                              {value === null
                                                ? "null"
                                                : typeof value === "object"
                                                  ? JSON.stringify(value)
                                                  : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4">
                <PaginationControls
                  pagination={pagination}
                  basePath="/admin/audit-log"
                  searchParams={currentParams}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
