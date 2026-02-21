"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Camera,
  Search,
  Copy,
  ExternalLink,
  Ban,
  CheckCircle2,
  Link2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  createTraineeSnapshot,
  createBulkSnapshots,
  deactivateSnapshot,
} from "@/actions/snapshots";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraineeOption {
  id: string;
  name: string;
  employeeId: string | null;
  division: string | null;
  currentPhase: string | null;
  dorCount: number;
  avgRating: number | null;
}

interface SnapshotRecord {
  id: string;
  token: string;
  title: string | null;
  isActive: boolean;
  createdAt: string;
  traineeName: string;
  traineeEmployeeId: string | null;
}

type SortField = "name" | "division" | "phase" | "dorCount" | "avgRating";
type SortDir = "asc" | "desc";

interface SnapshotsClientProps {
  trainees: TraineeOption[];
  phases: string[];
  divisions: string[];
  recentSnapshots: SnapshotRecord[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ratingColor(rating: number | null): string {
  if (rating === null) return "text-muted-foreground";
  if (rating < 3) return "text-red-600 font-semibold";
  if (rating < 4) return "text-orange-500 font-semibold";
  if (rating >= 5) return "text-green-600 font-semibold";
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// SortIcon (extracted to avoid re-creation on every render)
// ---------------------------------------------------------------------------

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="h-3 w-3 ml-1" />
  ) : (
    <ArrowDown className="h-3 w-3 ml-1" />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapshotsClient({
  trainees,
  phases,
  divisions,
  recentSnapshots,
}: SnapshotsClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ traineeName: string; token: string }[] | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Filter + sort trainees
  const filteredTrainees = useMemo(() => {
    let list = trainees;

    // Text search
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.employeeId && t.employeeId.toLowerCase().includes(q)) ||
          (t.division && t.division.toLowerCase().includes(q))
      );
    }

    // Phase filter
    if (phaseFilter !== "all") {
      if (phaseFilter === "none") {
        list = list.filter((t) => !t.currentPhase);
      } else {
        list = list.filter((t) => t.currentPhase === phaseFilter);
      }
    }

    // Division filter
    if (divisionFilter !== "all") {
      if (divisionFilter === "none") {
        list = list.filter((t) => !t.division);
      } else {
        list = list.filter((t) => t.division === divisionFilter);
      }
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "division":
          cmp = (a.division ?? "").localeCompare(b.division ?? "");
          break;
        case "phase":
          cmp = (a.currentPhase ?? "").localeCompare(b.currentPhase ?? "");
          break;
        case "dorCount":
          cmp = a.dorCount - b.dorCount;
          break;
        case "avgRating":
          cmp = (a.avgRating ?? 0) - (b.avgRating ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [trainees, searchQuery, phaseFilter, divisionFilter, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredTrainees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredTrainees.map((t) => t.id)));
    }
  }

  function handleGenerate() {
    setError(null);
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    startTransition(async () => {
      if (ids.length === 1) {
        const result = await createTraineeSnapshot(ids[0]);
        if (result.success && result.data) {
          setResults([{ traineeName: result.data.traineeName, token: result.data.token }]);
          setResultsOpen(true);
          setSelected(new Set());
        } else {
          setError(result.error || "Failed to create snapshot.");
        }
      } else {
        const result = await createBulkSnapshots(ids);
        if (result.success && result.data) {
          setResults(
            result.data.snapshots.map((s) => ({
              traineeName: s.traineeName,
              token: s.token,
            }))
          );
          setResultsOpen(true);
          setSelected(new Set());
        } else {
          setError(result.error || "Failed to create snapshots.");
        }
      }
    });
  }

  function handleDeactivate(snapshotId: string) {
    startTransition(async () => {
      const result = await deactivateSnapshot(snapshotId);
      if (!result.success) {
        setError(result.error || "Failed to deactivate.");
      }
    });
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(`${siteUrl}/snapshot/${token}`);
  }

  const activeFilters = (phaseFilter !== "all" ? 1 : 0) + (divisionFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nmh-gray flex items-center gap-2">
            <Camera className="h-6 w-6 text-nmh-teal" />
            Trainee Snapshots
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate shareable progress reports for trainees.
          </p>
        </div>
        <Button
          className="bg-nmh-teal hover:bg-nmh-dark-teal"
          onClick={handleGenerate}
          disabled={selected.size === 0 || isPending}
        >
          <Camera className="h-4 w-4 mr-2" />
          {isPending
            ? "Generating..."
            : `Generate ${selected.size > 0 ? `(${selected.size})` : ""}`}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Trainee Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Select Trainees
                {activeFilters > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {activeFilters} filter{activeFilters > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {filteredTrainees.length} of {trainees.length} trainees
                {selected.size > 0 && ` · ${selected.size} selected`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, or division..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              {divisions.length > 0 && (
                <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-sm">
                    <SelectValue placeholder="Division" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Divisions</SelectItem>
                    {divisions.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">No Division</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {phases.length > 0 && (
                <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-sm">
                    <SelectValue placeholder="Phase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Phases</SelectItem>
                    {phases.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                    <SelectItem value="none">No Phase</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {activeFilters > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => {
                    setPhaseFilter("all");
                    setDivisionFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredTrainees.length > 0 && selected.size === filteredTrainees.length
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center text-xs font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center text-xs font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("division")}
                  >
                    Division
                    <SortIcon field="division" sortField={sortField} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center text-xs font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("phase")}
                  >
                    Phase
                    <SortIcon field="phase" sortField={sortField} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="inline-flex items-center text-xs font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("dorCount")}
                  >
                    DORs
                    <SortIcon field="dorCount" sortField={sortField} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-center">
                  <button
                    className="inline-flex items-center text-xs font-medium hover:text-foreground transition-colors"
                    onClick={() => handleSort("avgRating")}
                  >
                    Avg Rating
                    <SortIcon field="avgRating" sortField={sortField} sortDir={sortDir} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrainees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchQuery || phaseFilter !== "all" || divisionFilter !== "all"
                      ? "No trainees match your filters."
                      : "No active trainees."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrainees.map((t) => (
                  <TableRow key={t.id} className={selected.has(t.id) ? "bg-nmh-teal/5" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {t.name}
                      {t.employeeId && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          ({t.employeeId})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {t.division || "—"}
                    </TableCell>
                    <TableCell>
                      {t.currentPhase ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          {t.currentPhase}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {t.dorCount}
                    </TableCell>
                    <TableCell className={`text-center text-sm ${ratingColor(t.avgRating)}`}>
                      {t.avgRating !== null ? t.avgRating.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Snapshots */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentSnapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No snapshots generated yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainee</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSnapshots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.traineeName}
                      {s.traineeEmployeeId && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({s.traineeEmployeeId})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(s.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {s.isActive ? (
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">Deactivated</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {s.isActive && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Copy link"
                              onClick={() => copyLink(s.token)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Open" asChild>
                              <a href={`/snapshot/${s.token}`} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Deactivate"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeactivate(s.id)}
                              disabled={isPending}
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Results Dialog */}
      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Snapshots Generated
              {results && results.length > 1 && (
                <Badge variant="secondary" className="text-xs ml-1">
                  {results.length}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2 min-h-0">
            <p className="text-sm text-muted-foreground shrink-0">
              Share these links with directors, medical directors, or educators. Anyone with the
              link can view the report.
            </p>
            <div className="overflow-y-auto space-y-2 min-h-0">
              {results?.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg border overflow-hidden"
                >
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="font-medium text-sm">{r.traineeName}</p>
                    <div className="flex items-center gap-1.5 mt-1 min-w-0">
                      <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">
                        {siteUrl}/snapshot/{r.token}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => copyLink(r.token)}>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/snapshot/${r.token}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
