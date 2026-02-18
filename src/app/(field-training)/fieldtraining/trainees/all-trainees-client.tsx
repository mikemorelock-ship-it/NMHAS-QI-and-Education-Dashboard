"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Users,
  Search,
  UserCog,
  X,
  Bell,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import {
  createAssignment,
  endAssignment,
  reviewAssignmentRequest,
} from "@/actions/field-training";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TraineeAssignment {
  id: string;
  ftoId: string;
  ftoName: string;
}

interface TraineeRow {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  division: string | null;
  currentAssignments: TraineeAssignment[];
  currentPhase: string | null;
  completedPhases: number;
  totalPhases: number;
  dorCount: number;
  avgRating: number | null;
}

interface FtoOption {
  id: string;
  name: string;
  employeeId: string;
  role: string;
}

interface PendingRequest {
  id: string;
  requesterName: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  reason: string | null;
  createdAt: string;
}

interface AllTraineesClientProps {
  trainees: TraineeRow[];
  canManageAssignments: boolean;
  ftos: FtoOption[];
  pendingRequests: PendingRequest[];
  divisions: string[];
  phases: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  separated: "bg-gray-100 text-gray-700",
  remediation: "bg-orange-100 text-orange-700",
};

type SortField =
  | "name"
  | "division"
  | "status"
  | "phase"
  | "progress"
  | "dorCount"
  | "avgRating";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AllTraineesClient({
  trainees,
  canManageAssignments,
  ftos,
  pendingRequests: initialPendingRequests,
  divisions,
  phases,
}: AllTraineesClientProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [ftoFilter, setFtoFilter] = useState<string>("all"); // all | assigned | unassigned

  // Sorting
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Assign FTO dialog
  const [assignTrainee, setAssignTrainee] = useState<TraineeRow | null>(null);
  const [assignFtoId, setAssignFtoId] = useState("");
  const [assignDate, setAssignDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Remove FTO confirmation
  const [removeAssignment, setRemoveAssignment] = useState<{
    id: string;
    ftoName: string;
    traineeName: string;
  } | null>(null);

  // Pending requests
  const [pendingRequests, setPendingRequests] = useState(
    initialPendingRequests
  );
  const [reviewingRequest, setReviewingRequest] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filtered = useMemo(() => {
    return trainees.filter((t) => {
      const matchesSearch =
        !search ||
        `${t.firstName} ${t.lastName}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || t.status === statusFilter;
      const matchesDivision =
        divisionFilter === "all" || t.division === divisionFilter;
      const matchesPhase =
        phaseFilter === "all" || t.currentPhase === phaseFilter;
      const matchesFto =
        ftoFilter === "all" ||
        (ftoFilter === "assigned" && t.currentAssignments.length > 0) ||
        (ftoFilter === "unassigned" && t.currentAssignments.length === 0);
      return (
        matchesSearch &&
        matchesStatus &&
        matchesDivision &&
        matchesPhase &&
        matchesFto
      );
    });
  }, [trainees, search, statusFilter, divisionFilter, phaseFilter, ftoFilter]);

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = `${a.lastName}, ${a.firstName}`.localeCompare(
            `${b.lastName}, ${b.firstName}`
          );
          break;
        case "division":
          cmp = (a.division ?? "").localeCompare(b.division ?? "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "phase":
          cmp = (a.currentPhase ?? "").localeCompare(b.currentPhase ?? "");
          break;
        case "progress": {
          const pa = a.totalPhases > 0 ? a.completedPhases / a.totalPhases : 0;
          const pb = b.totalPhases > 0 ? b.completedPhases / b.totalPhases : 0;
          cmp = pa - pb;
          break;
        }
        case "dorCount":
          cmp = a.dorCount - b.dorCount;
          break;
        case "avgRating":
          cmp = (a.avgRating ?? 0) - (b.avgRating ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // -------------------------------------------------------------------------
  // Counts
  // -------------------------------------------------------------------------

  const activeCount = trainees.filter((t) => t.status === "active").length;
  const remCount = trainees.filter((t) => t.status === "remediation").length;
  const completedCount = trainees.filter(
    (t) => t.status === "completed"
  ).length;
  const unassignedCount = trainees.filter(
    (t) =>
      t.currentAssignments.length === 0 &&
      (t.status === "active" || t.status === "remediation")
  ).length;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1" />
    );
  }

  function handleAssign() {
    if (!assignTrainee) return;
    setAssignError(null);
    if (!assignFtoId || assignFtoId === "__none__") {
      setAssignError("Please select an FTO.");
      return;
    }
    startTransition(async () => {
      const result = await createAssignment(
        assignTrainee.id,
        assignFtoId,
        assignDate
      );
      if (result.success) {
        setAssignTrainee(null);
        setAssignFtoId("");
      } else {
        setAssignError(result.error ?? "Failed to assign FTO.");
      }
    });
  }

  function handleRemoveFto() {
    if (!removeAssignment) return;
    startTransition(async () => {
      const result = await endAssignment(removeAssignment.id, "completed");
      if (result.success) {
        setRemoveAssignment(null);
      }
    });
  }

  function handleReviewRequest(
    requestId: string,
    decision: "approved" | "denied"
  ) {
    startTransition(async () => {
      const result = await reviewAssignmentRequest(
        requestId,
        decision,
        reviewNotes || undefined
      );
      if (result.success) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        setReviewingRequest(null);
        setReviewNotes("");
      }
    });
  }

  function ratingColor(rating: number | null): string {
    if (rating === null) return "text-muted-foreground";
    if (rating <= 2) return "text-red-600 font-semibold";
    if (rating <= 3) return "text-orange-600 font-semibold";
    if (rating <= 4) return "text-gray-800";
    if (rating <= 5) return "text-green-600 font-semibold";
    return "text-green-700 font-bold";
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Trainees</h1>
        <p className="text-muted-foreground mt-1">
          Overview of all trainees across the program
        </p>
      </div>

      {/* Pending Assignment Requests */}
      {canManageAssignments && pendingRequests.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-800">
              <Bell className="h-4 w-4" />
              Pending Assignment Requests ({pendingRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-white p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      <span className="text-amber-700">{req.requesterName}</span>{" "}
                      requested assignment to{" "}
                      <span className="font-semibold">{req.traineeName}</span>
                      {req.traineeEmployeeId && (
                        <span className="text-muted-foreground ml-1">
                          ({req.traineeEmployeeId})
                        </span>
                      )}
                    </p>
                    {req.reason && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        &ldquo;{req.reason}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(req.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {reviewingRequest === req.id ? (
                    <div className="flex flex-col gap-2 min-w-[220px]">
                      <Textarea
                        placeholder="Optional notes..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleReviewRequest(req.id, "approved")
                          }
                          disabled={isPending}
                          className="flex-1"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            handleReviewRequest(req.id, "denied")
                          }
                          disabled={isPending}
                          className="flex-1"
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewingRequest(null);
                            setReviewNotes("");
                          }}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReviewingRequest(req.id)}
                    >
                      Review
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold">{trainees.length}</div>
            <div className="text-xs text-muted-foreground">Total Trainees</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">
              {activeCount}
            </div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-600">
              {remCount}
            </div>
            <div className="text-xs text-muted-foreground">Remediation</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">
              {completedCount}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className={`text-2xl font-bold ${unassignedCount > 0 ? "text-red-600" : "text-gray-400"}`}>
              {unassignedCount}
            </div>
            <div className="text-xs text-muted-foreground">Unassigned</div>
          </CardContent>
        </Card>
      </div>

      {/* Trainee Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Trainees
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-56"
                />
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="remediation">Remediation</option>
                <option value="completed">Completed</option>
                <option value="separated">Separated</option>
              </select>

              <select
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Divisions</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Phases</option>
                {phases.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <select
                value={ftoFilter}
                onChange={(e) => setFtoFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All FTO Status</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>

              <span className="text-xs text-muted-foreground ml-auto">
                {sorted.length} of {trainees.length} trainees
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No trainees found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className="flex items-center hover:text-foreground"
                      >
                        Name
                        <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("division")}
                        className="flex items-center hover:text-foreground"
                      >
                        Division
                        <SortIcon field="division" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="flex items-center hover:text-foreground"
                      >
                        Status
                        <SortIcon field="status" />
                      </button>
                    </TableHead>
                    <TableHead>Current FTO(s)</TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("phase")}
                        className="flex items-center hover:text-foreground"
                      >
                        Phase
                        <SortIcon field="phase" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        type="button"
                        onClick={() => toggleSort("progress")}
                        className="flex items-center hover:text-foreground"
                      >
                        Progress
                        <SortIcon field="progress" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("dorCount")}
                        className="flex items-center justify-center hover:text-foreground w-full"
                      >
                        DORs
                        <SortIcon field="dorCount" />
                      </button>
                    </TableHead>
                    <TableHead className="text-center">
                      <button
                        type="button"
                        onClick={() => toggleSort("avgRating")}
                        className="flex items-center justify-center hover:text-foreground w-full"
                      >
                        Avg Rating
                        <SortIcon field="avgRating" />
                      </button>
                    </TableHead>
                    {canManageAssignments && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((t) => {
                    const progressPct =
                      t.totalPhases > 0
                        ? Math.round(
                            (t.completedPhases / t.totalPhases) * 100
                          )
                        : 0;
                    return (
                      <TableRow key={t.id}>
                        {/* Name — clickable link to detail page */}
                        <TableCell className="font-medium">
                          <Link
                            href={`/fieldtraining/trainees/${t.id}`}
                            className="text-nmh-teal hover:underline"
                          >
                            {t.lastName}, {t.firstName}
                          </Link>
                        </TableCell>

                        {/* Division */}
                        <TableCell className="text-sm">
                          {t.division || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            className={
                              STATUS_COLORS[t.status] ||
                              "bg-gray-100 text-gray-700"
                            }
                          >
                            {t.status}
                          </Badge>
                        </TableCell>

                        {/* Current FTO(s) — chips with X button */}
                        <TableCell>
                          {t.currentAssignments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.currentAssignments.map((a) => (
                                <Badge
                                  key={a.id}
                                  variant="secondary"
                                  className="flex items-center gap-1 pr-1"
                                >
                                  <span className="text-xs">{a.ftoName}</span>
                                  {canManageAssignments && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRemoveAssignment({
                                          id: a.id,
                                          ftoName: a.ftoName,
                                          traineeName: `${t.lastName}, ${t.firstName}`,
                                        });
                                      }}
                                      className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                                      title={`Remove ${a.ftoName}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              UNASSIGNED
                            </Badge>
                          )}
                        </TableCell>

                        {/* Phase */}
                        <TableCell className="text-sm">
                          {t.currentPhase || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Progress */}
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress
                              value={progressPct}
                              className="h-2 flex-1"
                            />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {t.completedPhases}/{t.totalPhases}
                            </span>
                          </div>
                        </TableCell>

                        {/* DOR Count */}
                        <TableCell className="text-center">
                          {t.dorCount}
                        </TableCell>

                        {/* Avg Rating */}
                        <TableCell className="text-center">
                          <span className={ratingColor(t.avgRating)}>
                            {t.avgRating !== null
                              ? `${t.avgRating}/7`
                              : "—"}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        {canManageAssignments && (
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAssignTrainee(t);
                                setAssignFtoId("");
                                setAssignDate(
                                  new Date().toISOString().slice(0, 10)
                                );
                                setAssignError(null);
                              }}
                            >
                              <UserCog className="h-3.5 w-3.5 mr-1" />
                              Assign FTO
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign FTO Dialog */}
      <Dialog
        open={!!assignTrainee}
        onOpenChange={(open) => {
          if (!open) {
            setAssignTrainee(null);
            setAssignFtoId("");
            setAssignError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign FTO</DialogTitle>
            <DialogDescription>
              {assignTrainee && (
                <>
                  Assign an FTO to{" "}
                  <strong>
                    {assignTrainee.lastName}, {assignTrainee.firstName}
                  </strong>
                  .
                  {assignTrainee.currentAssignments.length > 0 && (
                    <>
                      {" "}
                      Currently assigned to:{" "}
                      <strong>
                        {assignTrainee.currentAssignments
                          .map((a) => a.ftoName)
                          .join(", ")}
                      </strong>
                      .
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {assignError && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{assignError}</p>
            </Card>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>FTO</Label>
              <Select value={assignFtoId} onValueChange={setAssignFtoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an FTO..." />
                </SelectTrigger>
                <SelectContent>
                  {ftos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.employeeId})
                      {f.role === "supervisor" ? " [Sup]" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignTrainee(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={isPending}>
              {isPending ? "Assigning..." : "Assign FTO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove FTO Confirmation Dialog */}
      <Dialog
        open={!!removeAssignment}
        onOpenChange={(open) => {
          if (!open) setRemoveAssignment(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove FTO Assignment</DialogTitle>
            <DialogDescription>
              {removeAssignment && (
                <>
                  Are you sure you want to remove{" "}
                  <strong>{removeAssignment.ftoName}</strong> from{" "}
                  <strong>{removeAssignment.traineeName}</strong>?
                  This will end the active assignment.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveAssignment(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveFto}
              disabled={isPending}
            >
              {isPending ? "Removing..." : "Remove FTO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
