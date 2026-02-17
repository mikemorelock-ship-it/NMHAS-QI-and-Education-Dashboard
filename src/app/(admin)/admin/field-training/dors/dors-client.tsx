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
import { ChevronDown, ChevronRight, Plus, Trash2, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
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
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RatingBadge({ rating }: { rating: number }) {
  const color =
    rating === 1 ? "bg-red-200 text-red-900" :
    rating === 2 ? "bg-red-100 text-red-800" :
    rating === 3 ? "bg-orange-100 text-orange-800" :
    rating === 4 ? "bg-gray-100 text-gray-800" :
    rating === 5 ? "bg-green-100 text-green-800" :
    rating === 6 ? "bg-green-200 text-green-900" :
    "bg-emerald-200 text-emerald-900";
  return <Badge className={cn("font-mono text-xs", color)}>{rating}/7</Badge>;
}

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

export function DorsClient({ dors }: { dors: DorRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "submitted">("all");

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
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/field-training"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Daily Observation Reports</h1>
            <p className="text-muted-foreground">{dors.length} DOR{dors.length !== 1 ? "s" : ""} recorded</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/field-training/dors/new">
            <Plus className="h-4 w-4 mr-2" />New DOR
          </Link>
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          All ({dors.length})
        </Button>
        <Button variant={filter === "draft" ? "default" : "outline"} size="sm" onClick={() => setFilter("draft")}>
          Drafts ({draftCount})
        </Button>
        <Button variant={filter === "submitted" ? "default" : "outline"} size="sm" onClick={() => setFilter("submitted")}>
          Submitted ({submittedCount})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DOR History</CardTitle>
          <CardDescription>Click a row to expand category ratings and details.</CardDescription>
        </CardHeader>
        <CardContent>
          {dors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No DORs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((dor) => (
                <div key={dor.id} className="border rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(expandedId === dor.id ? null : dor.id)}
                  >
                    <div className="flex items-center gap-4">
                      {expandedId === dor.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <div>
                        <span className="font-medium">{formatDate(dor.date)}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          <Link href={`/admin/field-training/trainees/${dor.traineeId}`} className="text-nmh-teal hover:underline" onClick={(e) => e.stopPropagation()}>
                            {dor.traineeName}
                          </Link>
                          {" "}by {dor.ftoName}
                        </span>
                        {dor.phaseName && <Badge variant="outline" className="ml-2">{dor.phaseName}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {dor.nrtFlag && (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />NRT
                        </Badge>
                      )}
                      {dor.remFlag && (
                        <Badge className="bg-orange-100 text-orange-800">REM</Badge>
                      )}
                      {dor.status === "draft" && (
                        <Badge variant="outline" className="border-orange-400 text-orange-700">Draft</Badge>
                      )}
                      {dor.traineeAcknowledged && (
                        <span title="Trainee acknowledged">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </span>
                      )}
                      <RatingBadge rating={dor.overallRating} />
                      <Badge className={actionColors[dor.recommendAction] ?? ""}>
                        {actionLabels[dor.recommendAction] ?? dor.recommendAction}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); handleDelete(dor.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedId === dor.id && (
                    <div className="border-t p-4 space-y-4">
                      {/* Most/Least Satisfactory */}
                      <div className="grid grid-cols-2 gap-4">
                        {dor.mostSatisfactory && (
                          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                            <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">Most Satisfactory</p>
                            <p className="text-sm">{dor.mostSatisfactory}</p>
                          </div>
                        )}
                        {dor.leastSatisfactory && (
                          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <p className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-1">Least Satisfactory</p>
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
                              <TableCell><RatingBadge rating={r.rating} /></TableCell>
                              <TableCell className="text-sm text-muted-foreground">{r.comments ?? "—"}</TableCell>
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
    </div>
  );
}
