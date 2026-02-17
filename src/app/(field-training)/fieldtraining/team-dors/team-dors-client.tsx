"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ClipboardCheck, Search, MessageSquare } from "lucide-react";
import { updateSupervisorNotes } from "@/actions/field-training";

interface DorRow {
  id: string;
  date: string;
  traineeName: string;
  traineeEmployeeId: string;
  ftoName: string;
  phaseName: string | null;
  overallRating: number;
  status: string;
  traineeAcknowledged: boolean;
  recommendAction: string;
  supervisorNotes: string | null;
}

interface TeamDorsClientProps {
  dors: DorRow[];
  currentFtoId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  reviewed: "bg-green-100 text-green-700",
};

const RECOMMEND_LABELS: Record<string, string> = {
  continue: "Continue",
  advance: "Advance",
  extend: "Extend",
  remediate: "Remediate",
  nrt: "NRT",
  release: "Release",
  terminate: "Terminate",
};

export function TeamDorsClient({ dors, currentFtoId }: TeamDorsClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notesDialog, setNotesDialog] = useState<DorRow | null>(null);
  const [notesText, setNotesText] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = dors.filter((d) => {
    const matchesSearch =
      !search ||
      d.traineeName.toLowerCase().includes(search.toLowerCase()) ||
      d.ftoName.toLowerCase().includes(search.toLowerCase()) ||
      d.traineeEmployeeId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function openNotes(dor: DorRow) {
    setNotesDialog(dor);
    setNotesText(dor.supervisorNotes || "");
  }

  function saveNotes() {
    if (!notesDialog) return;
    startTransition(async () => {
      await updateSupervisorNotes(notesDialog.id, notesText);
      setNotesDialog(null);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team DORs</h1>
        <p className="text-muted-foreground mt-1">
          Review Daily Observation Reports across all FTOs
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5" />
              All DORs
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trainee or FTO..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No DORs found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Trainee</TableHead>
                    <TableHead>FTO</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead className="text-center">Rating</TableHead>
                    <TableHead>Recommend</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((dor) => (
                    <TableRow key={dor.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(dor.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{dor.traineeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {dor.traineeEmployeeId}
                        </div>
                      </TableCell>
                      <TableCell>{dor.ftoName}</TableCell>
                      <TableCell>{dor.phaseName || "-"}</TableCell>
                      <TableCell className="text-center font-medium">
                        {dor.overallRating}
                      </TableCell>
                      <TableCell>
                        {RECOMMEND_LABELS[dor.recommendAction] ||
                          dor.recommendAction}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_COLORS[dor.status] ||
                            "bg-gray-100 text-gray-700"
                          }
                        >
                          {dor.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openNotes(dor)}
                          className={
                            dor.supervisorNotes
                              ? "text-nmh-teal"
                              : "text-muted-foreground"
                          }
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supervisor Notes Dialog */}
      <Dialog
        open={!!notesDialog}
        onOpenChange={(open) => !open && setNotesDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supervisor Notes</DialogTitle>
          </DialogHeader>
          {notesDialog && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                DOR for <strong>{notesDialog.traineeName}</strong> on{" "}
                {new Date(notesDialog.date).toLocaleDateString()} by{" "}
                {notesDialog.ftoName}
              </div>
              <Textarea
                placeholder="Add supervisor notes..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={5}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setNotesDialog(null)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button onClick={saveNotes} disabled={isPending}>
                  {isPending ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
