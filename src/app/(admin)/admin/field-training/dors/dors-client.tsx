"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Eye,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RatingBadge } from "@/components/field-training/RatingBadge";
import { deleteDailyObservationReport } from "@/actions/field-training";

type DorRow = {
  id: string;
  date: string;
  traineeId: string;
  traineeName: string;
  traineeEmployeeId: string;
  ftoName: string;
  phaseName: string | null;
  overallRating: number;
  narrative: string | null;
  mostSatisfactory: string | null;
  leastSatisfactory: string | null;
  recommendAction: string;
  nrtFlag: boolean;
  remFlag: boolean;
  traineeAcknowledged: boolean;
  status: string;
  supervisorReviewedBy: string | null;
  ratings: { categoryName: string; rating: number; comments: string | null }[];
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// RatingBadge imported from shared component

const actionLabels: Record<string, string> = {
  continue: "Continue",
  advance: "Advance",
  extend: "Extend Phase",
  remediate: "Remediate",
  nrt: "NRT",
  release: "Release to Solo",
  terminate: "Terminate",
};

const actionColors: Record<string, string> = {
  continue: "bg-green-100 text-green-800",
  advance: "bg-blue-100 text-blue-800",
  release: "bg-blue-100 text-blue-800",
  remediate: "bg-orange-100 text-orange-800",
  extend: "bg-yellow-100 text-yellow-800",
  nrt: "bg-red-100 text-red-800",
  terminate: "bg-red-100 text-red-800",
};

const RATING_LABELS: Record<number, string> = {
  1: "Not Acceptable",
  2: "Not Acceptable",
  3: "Below Standard",
  4: "Acceptable",
  5: "Above Standard",
  6: "Superior",
  7: "Superior",
};

export function DorsClient({ dors }: { dors: DorRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "submitted">("all");
  const [viewDor, setViewDor] = useState<DorRow | null>(null);

  const filtered = dors.filter((d) => {
    if (filter === "draft") return d.status === "draft";
    if (filter === "submitted") return d.status === "submitted";
    return true;
  });

  const draftCount = dors.filter((d) => d.status === "draft").length;
  const submittedCount = dors.filter((d) => d.status === "submitted").length;

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this Daily Observation Report?")) return;
    await deleteDailyObservationReport(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Go back">
            <Link href="/admin/field-training">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Observation Reports</h1>
            <p className="text-muted-foreground">
              {dors.length} DOR{dors.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/field-training/dors/new">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            New DOR
          </Link>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
        >
          All ({dors.length})
        </Button>
        <Button
          variant={filter === "draft" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("draft")}
        >
          Drafts ({draftCount})
        </Button>
        <Button
          variant={filter === "submitted" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("submitted")}
        >
          Submitted ({submittedCount})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DOR History</CardTitle>
          <CardDescription>
            Click a row to expand category ratings, or use the view button for full detail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No DORs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((dor) => (
                <div key={dor.id} className="border rounded-lg">
                  <div className="flex items-center justify-between p-4 hover:bg-muted/50">
                    <button
                      type="button"
                      className="flex items-center gap-4 cursor-pointer text-left bg-transparent border-0 p-0 flex-1 min-w-0"
                      aria-expanded={expandedId === dor.id}
                      aria-label={`DOR ${formatDate(dor.date)} – ${dor.traineeName} by ${dor.ftoName}, rating ${dor.overallRating}/7`}
                      onClick={() => setExpandedId(expandedId === dor.id ? null : dor.id)}
                    >
                      {expandedId === dor.id ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      <div>
                        <span className="font-medium">{formatDate(dor.date)}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {dor.traineeName} by {dor.ftoName}
                        </span>
                        {dor.phaseName && (
                          <Badge variant="outline" className="ml-2">
                            {dor.phaseName}
                          </Badge>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Link
                        href={`/admin/field-training/trainees/${dor.traineeId}`}
                        className="text-sm text-nmh-teal hover:underline"
                      >
                        {dor.traineeName}
                      </Link>
                      {dor.nrtFlag && (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                          NRT
                        </Badge>
                      )}
                      {dor.remFlag && <Badge className="bg-orange-100 text-orange-800">REM</Badge>}
                      {dor.status === "draft" && (
                        <Badge variant="outline" className="border-orange-400 text-orange-700">
                          Draft
                        </Badge>
                      )}
                      {dor.traineeAcknowledged && (
                        <span aria-label="Trainee acknowledged">
                          <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                        </span>
                      )}
                      <RatingBadge rating={dor.overallRating} />
                      <Badge className={actionColors[dor.recommendAction] ?? ""}>
                        {actionLabels[dor.recommendAction] ?? dor.recommendAction}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`View DOR for ${dor.traineeName} on ${formatDate(dor.date)}`}
                        onClick={() => setViewDor(dor)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete DOR for ${dor.traineeName} on ${formatDate(dor.date)}`}
                        onClick={() => handleDelete(dor.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === dor.id && (
                    <div className="border-t p-4 space-y-4">
                      {/* Most/Least Satisfactory */}
                      <div className="grid grid-cols-2 gap-4">
                        {dor.mostSatisfactory && (
                          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                            <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
                              Most Satisfactory
                            </p>
                            <p className="text-sm">{dor.mostSatisfactory}</p>
                          </div>
                        )}
                        {dor.leastSatisfactory && (
                          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">
                              Least Satisfactory
                            </p>
                            <p className="text-sm">{dor.leastSatisfactory}</p>
                          </div>
                        )}
                      </div>

                      {dor.narrative && <p className="text-sm">{dor.narrative}</p>}

                      {dor.supervisorReviewedBy && (
                        <p className="text-xs text-muted-foreground">
                          Supervisor review: {dor.supervisorReviewedBy}
                        </p>
                      )}

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Rating</TableHead>
                            <TableHead>Comments</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dor.ratings.map((r) => (
                            <TableRow key={r.categoryName}>
                              <TableCell className="font-medium">{r.categoryName}</TableCell>
                              <TableCell>
                                <RatingBadge rating={r.rating} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {r.comments ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DOR Detail Dialog */}
      <Dialog open={viewDor !== null} onOpenChange={(open) => !open && setViewDor(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Daily Observation Report</span>
              {viewDor && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/fieldtraining/dors/${viewDor.id}`} target="_blank">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                    Open Full Page
                  </Link>
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewDor && <DorDetailView dor={viewDor} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOR Detail View — rendered inside the dialog
// ---------------------------------------------------------------------------

function DorDetailView({ dor }: { dor: DorRow }) {
  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Trainee</p>
            <p className="font-medium">{dor.traineeName}</p>
            <p className="text-xs text-muted-foreground">{dor.traineeEmployeeId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">FTO</p>
            <p className="font-medium">{dor.ftoName}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Date</p>
            <p className="font-medium">{formatDate(dor.date)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Phase</p>
            <p className="font-medium">{dor.phaseName ?? "Not assigned"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex items-center gap-2 mt-0.5">
              {dor.status === "draft" ? (
                <Badge variant="outline" className="border-orange-400 text-orange-700">
                  Draft
                </Badge>
              ) : (
                <Badge variant="outline" className="border-green-400 text-green-700">
                  Submitted
                </Badge>
              )}
              {dor.traineeAcknowledged && (
                <Badge variant="outline" className="border-green-400 text-green-700">
                  <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
                  Acknowledged
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overall rating & recommendation */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Overall Rating
          </p>
          <div className="flex items-center gap-2">
            <RatingBadge rating={dor.overallRating} />
            <span className="text-sm text-muted-foreground">
              {RATING_LABELS[dor.overallRating]}
            </span>
          </div>
        </div>
        <div className="border-l pl-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Recommendation
          </p>
          <Badge className={actionColors[dor.recommendAction] ?? ""}>
            {actionLabels[dor.recommendAction] ?? dor.recommendAction}
          </Badge>
        </div>
        {(dor.nrtFlag || dor.remFlag) && (
          <div className="border-l pl-4 flex items-center gap-2">
            {dor.nrtFlag && (
              <Badge className="bg-red-100 text-red-800">
                <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                NRT
              </Badge>
            )}
            {dor.remFlag && <Badge className="bg-orange-100 text-orange-800">REM</Badge>}
          </div>
        )}
      </div>

      {/* Most/Least Satisfactory */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-green-50 border border-green-200">
          <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
            Most Satisfactory
          </p>
          <p className="text-sm">{dor.mostSatisfactory || "—"}</p>
        </div>
        <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
          <p className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">
            Least Satisfactory
          </p>
          <p className="text-sm">{dor.leastSatisfactory || "—"}</p>
        </div>
      </div>

      {/* Narrative */}
      {dor.narrative && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Narrative</p>
          <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border">
            {dor.narrative}
          </p>
        </div>
      )}

      {/* Category Ratings */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
          Category Ratings
        </p>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="w-24">Rating</TableHead>
                <TableHead>Comments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dor.ratings.map((r) => (
                <TableRow key={r.categoryName}>
                  <TableCell className="font-medium">{r.categoryName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <RatingBadge rating={r.rating} />
                      <span className="text-xs text-muted-foreground">
                        {RATING_LABELS[r.rating]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.comments ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Supervisor review */}
      {dor.supervisorReviewedBy && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Supervisor Review
          </p>
          <p className="text-sm">{dor.supervisorReviewedBy}</p>
        </div>
      )}
    </div>
  );
}
