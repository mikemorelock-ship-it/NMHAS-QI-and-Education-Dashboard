"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { getEntityHistory, type AuditLogViewRow } from "@/actions/audit-log";
import { parseAuditChanges } from "@/lib/audit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityHistoryProps {
  entity: string;
  entityId: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// Action badge color map
// ---------------------------------------------------------------------------

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-gray-100 text-gray-800",
  SECURITY: "bg-amber-100 text-amber-800",
};

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? "bg-gray-100 text-gray-800";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityHistory({ entity, entityId, label = "History" }: EntityHistoryProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditLogViewRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntries([]);
      return;
    }

    let cancelled = false;

    async function fetchHistory() {
      setLoading(true);
      try {
        const result = await getEntityHistory(entity, entityId);
        if (!cancelled) {
          setEntries(result);
        }
      } catch (err) {
        console.error("Failed to load entity history:", err);
        if (!cancelled) {
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [open, entity, entityId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History className="h-4 w-4 mr-1.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entity} History</DialogTitle>
        </DialogHeader>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading history...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div className="py-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No history found.</p>
          </div>
        )}

        {/* Timeline entries */}
        {!loading && entries.length > 0 && (
          <div className="space-y-0">
            {entries.map((entry, idx) => {
              const changes = parseAuditChanges(entry.changes ?? null);
              const changedFields = changes?.before ? Object.keys(changes.before) : [];

              return (
                <div
                  key={entry.id}
                  className={`py-3 ${idx < entries.length - 1 ? "border-b" : ""}`}
                >
                  {/* Header row: timestamp + action badge */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className={`text-xs font-medium ${getActionColor(entry.action)}`}
                    >
                      {entry.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.createdAt), "MMM d, yyyy h:mm a")}
                    </span>
                  </div>

                  {/* Actor */}
                  {entry.actorName && (
                    <p className="text-xs text-muted-foreground mb-0.5">by {entry.actorName}</p>
                  )}

                  {/* Details */}
                  {entry.details && <p className="text-sm text-foreground">{entry.details}</p>}

                  {/* Changes diff */}
                  {changedFields.length > 0 && changes && (
                    <div className="mt-2 rounded-md border bg-muted/50 p-2.5 text-xs space-y-1">
                      {changedFields.map((field) => (
                        <div key={field} className="flex flex-col gap-0.5">
                          <span className="font-medium text-muted-foreground">{field}</span>
                          <div className="flex items-center gap-2 pl-2">
                            <span className="text-red-600 line-through">
                              {formatValue(changes.before?.[field])}
                            </span>
                            <span className="text-muted-foreground">&rarr;</span>
                            <span className="text-green-700">
                              {formatValue(changes.after?.[field])}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
