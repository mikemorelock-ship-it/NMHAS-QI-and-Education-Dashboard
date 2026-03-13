"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, AlertTriangle, Loader2, Pencil, X } from "lucide-react";
import { bulkCreateEntries, fetchEntriesForPeriod } from "@/actions/entries";
import type { PrefillEntry } from "@/actions/entries";
import type { ProposedEntry } from "@/lib/data-entry-ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposedEntriesReviewProps {
  entries: ProposedEntry[];
  onSaved: (count: number) => void;
}

interface ReviewRow extends ProposedEntry {
  selected: boolean;
  editing: boolean;
  existingEntryId: string | null;
  hasConflict: boolean;
  updateExisting: boolean;
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <Badge variant="outline" className={`text-[10px] ${styles[level]}`}>
      {level}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProposedEntriesReview({ entries, onSaved }: ProposedEntriesReviewProps) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(true);

  // On mount, check for duplicates and build rows
  useEffect(() => {
    let cancelled = false;

    async function checkDuplicates() {
      setCheckingDuplicates(true);

      // Group entries by metricId + periodType + periodStart to batch lookups
      const lookupKeys = new Map<
        string,
        { metricId: string; periodType: string; periodStart: string }
      >();
      for (const entry of entries) {
        const key = `${entry.metricDefinitionId}:${entry.periodType}:${entry.periodStart}`;
        if (!lookupKeys.has(key)) {
          lookupKeys.set(key, {
            metricId: entry.metricDefinitionId,
            periodType: entry.periodType,
            periodStart: entry.periodStart,
          });
        }
      }

      // Fetch existing entries for each unique metric+period combo
      const existingMap = new Map<string, PrefillEntry[]>();
      await Promise.all(
        Array.from(lookupKeys.entries()).map(
          async ([key, { metricId, periodType, periodStart }]) => {
            const existing = await fetchEntriesForPeriod(metricId, periodType, periodStart);
            existingMap.set(key, existing);
          }
        )
      );

      if (cancelled) return;

      // Build review rows
      const reviewRows: ReviewRow[] = entries.map((entry) => {
        const key = `${entry.metricDefinitionId}:${entry.periodType}:${entry.periodStart}`;
        const existing = existingMap.get(key) ?? [];

        // Find a matching existing entry by division+region
        const match = existing.find(
          (e) =>
            (e.divisionId ?? null) === entry.divisionId && (e.regionId ?? null) === entry.regionId
        );

        return {
          ...entry,
          selected: true,
          editing: false,
          existingEntryId: match?.id ?? null,
          hasConflict: !!match,
          updateExisting: !!match, // default to updating
        };
      });

      setRows(reviewRows);
      setCheckingDuplicates(false);
    }

    checkDuplicates();
    return () => {
      cancelled = true;
    };
  }, [entries]);

  // Toggle row selection
  function toggleRow(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  }

  // Toggle select all
  function toggleAll() {
    const allSelected = rows.every((r) => r.selected);
    setRows((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  }

  // Toggle update vs skip for conflicts
  function toggleUpdateExisting(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, updateExisting: !r.updateExisting } : r))
    );
  }

  // Toggle edit mode for a row
  function toggleEdit(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, editing: !r.editing } : r)));
  }

  // Update an editable field
  function updateField(index: number, field: "value" | "numerator" | "denominator", val: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const numVal = val === "" ? null : Number(val);
        return { ...r, [field]: numVal ?? 0 };
      })
    );
  }

  // Save selected entries
  async function handleSave() {
    setSaving(true);
    setError(null);

    const toSave = rows.filter((r) => {
      if (!r.selected) return false;
      // Skip conflicting rows where user chose not to update
      if (r.hasConflict && !r.updateExisting) return false;
      return true;
    });

    if (toSave.length === 0) {
      setError("No entries selected to save.");
      setSaving(false);
      return;
    }

    const bulkEntries = toSave.map((r) => ({
      metricDefinitionId: r.metricDefinitionId,
      departmentId: r.departmentId,
      divisionId: r.divisionId,
      regionId: r.regionId,
      periodType: r.periodType,
      periodStart: r.periodStart,
      value: r.value,
      numerator: r.numerator,
      denominator: r.denominator,
      notes: r.notes ? `${r.notes} (via AI Assistant)` : "Entered via AI Assistant",
      existingEntryId:
        r.hasConflict && r.updateExisting ? (r.existingEntryId ?? undefined) : undefined,
    }));

    const result = await bulkCreateEntries(bulkEntries);

    if (result.success) {
      onSaved(result.count ?? toSave.length);
    } else {
      setError(result.error ?? "Failed to save entries.");
    }

    setSaving(false);
  }

  const selectedCount = rows.filter(
    (r) => r.selected && (!r.hasConflict || r.updateExisting)
  ).length;

  if (checkingDuplicates) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking for existing entries...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={rows.length > 0 && rows.every((r) => r.selected)}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="text-xs">Metric</TableHead>
              <TableHead className="text-xs">Division / Region</TableHead>
              <TableHead className="text-xs">Period</TableHead>
              <TableHead className="text-xs">Value</TableHead>
              <TableHead className="text-xs w-16">Conf.</TableHead>
              <TableHead className="text-xs w-16">Status</TableHead>
              <TableHead className="text-xs w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} className={!row.selected ? "opacity-50" : undefined}>
                <TableCell>
                  <Checkbox checked={row.selected} onCheckedChange={() => toggleRow(i)} />
                </TableCell>
                <TableCell className="text-xs font-medium">{row.metricName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.divisionName || row.regionName
                    ? [row.divisionName, row.regionName].filter(Boolean).join(" / ")
                    : "Dept-level"}
                </TableCell>
                <TableCell className="text-xs">{row.periodStart}</TableCell>
                <TableCell className="text-xs">
                  {row.editing ? (
                    <div className="flex items-center gap-1">
                      {row.numerator !== null ? (
                        <>
                          <Input
                            type="number"
                            value={row.numerator ?? ""}
                            onChange={(e) => updateField(i, "numerator", e.target.value)}
                            className="w-16 h-6 text-xs"
                          />
                          <span>/</span>
                          <Input
                            type="number"
                            value={row.denominator ?? ""}
                            onChange={(e) => updateField(i, "denominator", e.target.value)}
                            className="w-16 h-6 text-xs"
                          />
                        </>
                      ) : (
                        <Input
                          type="number"
                          value={row.value}
                          onChange={(e) => updateField(i, "value", e.target.value)}
                          className="w-20 h-6 text-xs"
                        />
                      )}
                    </div>
                  ) : row.numerator !== null ? (
                    `${row.numerator} / ${row.denominator}`
                  ) : (
                    row.value
                  )}
                </TableCell>
                <TableCell>
                  <ConfidenceBadge level={row.confidence} />
                </TableCell>
                <TableCell>
                  {row.hasConflict ? (
                    <button
                      onClick={() => toggleUpdateExisting(i)}
                      className="text-[10px] text-yellow-700 hover:underline"
                      title={
                        row.updateExisting
                          ? "Will update existing entry. Click to skip."
                          : "Will skip. Click to update."
                      }
                    >
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-yellow-50 border-yellow-200 text-yellow-700 cursor-pointer"
                      >
                        {row.updateExisting ? "update" : "skip"}
                      </Badge>
                    </button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 border-blue-200 text-blue-700"
                    >
                      new
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => toggleEdit(i)}
                    className="text-muted-foreground hover:text-foreground"
                    title={row.editing ? "Done editing" : "Edit value"}
                  >
                    {row.editing ? (
                      <X className="h-3.5 w-3.5" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedCount} of {rows.length} {rows.length === 1 ? "entry" : "entries"} selected
        </p>
        <Button
          onClick={handleSave}
          disabled={saving || selectedCount === 0}
          size="sm"
          className="bg-nmh-teal hover:bg-nmh-teal/90"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Confirm & Save {selectedCount > 0 ? `(${selectedCount})` : ""}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
