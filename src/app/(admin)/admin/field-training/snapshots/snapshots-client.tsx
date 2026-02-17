"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Search,
  Copy,
  ExternalLink,
  Ban,
  CheckCircle2,
  Link2,
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

interface SnapshotsClientProps {
  trainees: TraineeOption[];
  recentSnapshots: SnapshotRecord[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SnapshotsClient({ trainees, recentSnapshots }: SnapshotsClientProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    { traineeName: string; token: string }[] | null
  >(null);
  const [resultsOpen, setResultsOpen] = useState(false);

  const siteUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const filteredTrainees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return trainees;
    return trainees.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.employeeId && t.employeeId.toLowerCase().includes(q)) ||
        (t.division && t.division.toLowerCase().includes(q))
    );
  }, [trainees, searchQuery]);

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
          setResults([
            { traineeName: result.data.traineeName, token: result.data.token },
          ]);
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Select Trainees</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trainees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
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
                      filteredTrainees.length > 0 &&
                      selected.size === filteredTrainees.length
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Division</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrainees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {searchQuery ? "No trainees match your search." : "No active trainees."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrainees.map((t) => (
                  <TableRow
                    key={t.id}
                    className={selected.has(t.id) ? "bg-nmh-teal/5" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.employeeId || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.division || "—"}
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
                              <a
                                href={`/snapshot/${s.token}`}
                                target="_blank"
                                rel="noreferrer"
                              >
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Snapshots Generated
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Share these links with directors, medical directors, or educators.
              Anyone with the link can view the report.
            </p>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(r.token)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/snapshot/${r.token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
