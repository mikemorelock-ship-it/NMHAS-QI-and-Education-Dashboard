"use client";

import { useState, useTransition, useMemo } from "react";
import {
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Plus,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  createAssignment,
  endAssignment,
  reviewAssignmentRequest,
} from "@/actions/field-training";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveAssignment {
  id: string;
  traineeId: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  traineeStatus: string;
  ftoId: string;
  ftoName: string;
  ftoEmployeeId: string | null;
  startDate: string;
  status: string;
}

interface PendingRequest {
  id: string;
  requesterName: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  reason: string | null;
  createdAt: string;
}

interface TraineeOption {
  id: string;
  name: string;
  employeeId: string | null;
}

interface FtoOption {
  id: string;
  name: string;
  employeeId: string | null;
  role: string;
}

interface HistoryRecord {
  id: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  ftoName: string;
  startDate: string;
  endDate: string | null;
  status: string;
}

interface AssignmentsClientProps {
  activeAssignments: ActiveAssignment[];
  pendingRequests: PendingRequest[];
  trainees: TraineeOption[];
  ftos: FtoOption[];
  recentHistory: HistoryRecord[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AssignmentsClient({
  activeAssignments,
  pendingRequests,
  trainees,
  ftos,
  recentHistory,
}: AssignmentsClientProps) {
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  // New assignment dialog state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTraineeId, setNewTraineeId] = useState("");
  const [newFtoId, setNewFtoId] = useState("");
  const [newStartDate, setNewStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newError, setNewError] = useState<string | null>(null);

  // Reassign dialog state
  const [reassignDialog, setReassignDialog] = useState<ActiveAssignment | null>(
    null
  );
  const [reassignFtoId, setReassignFtoId] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);

  // End assignment confirm state
  const [endingId, setEndingId] = useState<string | null>(null);

  // Pending request review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [processedRequestIds, setProcessedRequestIds] = useState<Set<string>>(
    new Set()
  );

  const [isPending, startTransition] = useTransition();

  // Filter active assignments by search
  const filteredAssignments = useMemo(() => {
    if (!search) return activeAssignments;
    const q = search.toLowerCase();
    return activeAssignments.filter(
      (a) =>
        a.traineeName.toLowerCase().includes(q) ||
        a.ftoName.toLowerCase().includes(q) ||
        (a.traineeEmployeeId || "").toLowerCase().includes(q) ||
        (a.ftoEmployeeId || "").toLowerCase().includes(q)
    );
  }, [activeAssignments, search]);

  const visibleRequests = pendingRequests.filter(
    (r) => !processedRequestIds.has(r.id)
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleNewAssignment() {
    setNewError(null);
    if (!newTraineeId || newTraineeId === "__none__") {
      setNewError("Please select a trainee.");
      return;
    }
    if (!newFtoId || newFtoId === "__none__") {
      setNewError("Please select an FTO.");
      return;
    }

    startTransition(async () => {
      const result = await createAssignment(newTraineeId, newFtoId, newStartDate);
      if (result.success) {
        setNewDialogOpen(false);
        resetNewDialog();
      } else {
        setNewError(result.error ?? "Failed to create assignment.");
      }
    });
  }

  function resetNewDialog() {
    setNewTraineeId("");
    setNewFtoId("");
    setNewStartDate(new Date().toISOString().slice(0, 10));
    setNewError(null);
  }

  function handleReassign() {
    if (!reassignDialog) return;
    setReassignError(null);
    if (!reassignFtoId || reassignFtoId === "__none__") {
      setReassignError("Please select a new FTO.");
      return;
    }

    startTransition(async () => {
      const result = await createAssignment(
        reassignDialog.traineeId,
        reassignFtoId,
        new Date().toISOString().slice(0, 10)
      );
      if (result.success) {
        setReassignDialog(null);
        setReassignFtoId("");
      } else {
        setReassignError(result.error ?? "Failed to reassign.");
      }
    });
  }

  function handleEndAssignment(assignmentId: string) {
    startTransition(async () => {
      const result = await endAssignment(assignmentId, "completed");
      if (result.success) {
        setEndingId(null);
      }
    });
  }

  function handleReviewRequest(
    requestId: string,
    decision: "approved" | "denied"
  ) {
    setReviewError(null);
    startTransition(async () => {
      const result = await reviewAssignmentRequest(
        requestId,
        decision,
        reviewNotes || undefined
      );
      if (result.success) {
        setProcessedRequestIds((prev) => new Set(prev).add(requestId));
        setReviewingId(null);
        setReviewNotes("");
      } else {
        setReviewError(result.error ?? "Failed to process request.");
      }
    });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function daysSince(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            FTO-Trainee Assignments
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage trainee-to-FTO assignments and review requests
          </p>
        </div>
        <Button
          onClick={() => {
            resetNewDialog();
            setNewDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Assignment
        </Button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Pending Requests */}
      {/* ----------------------------------------------------------------- */}
      {visibleRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base text-amber-800">
                Pending Assignment Requests
              </CardTitle>
              <Badge
                variant="outline"
                className="text-amber-700 border-amber-300 ml-auto"
              >
                {visibleRequests.length} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewError && (
              <Card className="border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{reviewError}</p>
              </Card>
            )}
            {visibleRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-lg border bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {req.requesterName}{" "}
                      <span className="text-muted-foreground font-normal">
                        requests
                      </span>{" "}
                      {req.traineeName}
                      {req.traineeEmployeeId && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({req.traineeEmployeeId})
                        </span>
                      )}
                    </p>
                    {req.reason && (
                      <p className="text-sm text-muted-foreground mt-1">
                        &ldquo;{req.reason}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(req.createdAt)}
                    </p>
                  </div>
                </div>

                {reviewingId === req.id ? (
                  <div className="space-y-3 pt-2 border-t">
                    <div>
                      <Label
                        htmlFor={`notes-${req.id}`}
                        className="text-xs"
                      >
                        Review Notes (optional)
                      </Label>
                      <Textarea
                        id={`notes-${req.id}`}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add notes about your decision..."
                        rows={2}
                        maxLength={500}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          handleReviewRequest(req.id, "approved")
                        }
                        disabled={isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        {isPending ? "Processing..." : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleReviewRequest(req.id, "denied")
                        }
                        disabled={isPending}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        {isPending ? "Processing..." : "Deny"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReviewingId(null);
                          setReviewNotes("");
                          setReviewError(null);
                        }}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewingId(req.id);
                        setReviewNotes("");
                        setReviewError(null);
                      }}
                    >
                      Review
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Current Assignments Table */}
      {/* ----------------------------------------------------------------- */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5" />
              Current Assignments
              <Badge variant="secondary">{activeAssignments.length}</Badge>
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trainee or FTO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-60"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {activeAssignments.length === 0
                ? "No active assignments."
                : "No assignments match your search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead>FTO</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{a.traineeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.traineeEmployeeId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{a.ftoName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.ftoEmployeeId}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(a.startDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {daysSince(a.startDate)} days
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700">
                          {a.traineeStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {endingId === a.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleEndAssignment(a.id)}
                                disabled={isPending}
                              >
                                {isPending ? "..." : "Confirm End"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEndingId(null)}
                                disabled={isPending}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReassignDialog(a);
                                  setReassignFtoId("");
                                  setReassignError(null);
                                }}
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5 mr-1" />
                                Reassign
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEndingId(a.id)}
                              >
                                End
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* Recent History (collapsible) */}
      {/* ----------------------------------------------------------------- */}
      {recentHistory.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowHistory((h) => !h)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                Recent History
                <Badge variant="outline">{recentHistory.length}</Badge>
              </CardTitle>
              {showHistory ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Trainee</TableHead>
                      <TableHead>FTO</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{h.traineeName}</p>
                            <p className="text-xs text-muted-foreground">
                              {h.traineeEmployeeId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{h.ftoName}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(h.startDate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {h.endDate ? formatDate(h.endDate) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              h.status === "completed"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }
                          >
                            {h.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* New Assignment Dialog */}
      {/* ----------------------------------------------------------------- */}
      <Dialog
        open={newDialogOpen}
        onOpenChange={(open) => {
          setNewDialogOpen(open);
          if (!open) resetNewDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Assignment</DialogTitle>
            <DialogDescription>
              Assign a trainee to an FTO. Any existing active assignment for this
              trainee will be automatically ended.
            </DialogDescription>
          </DialogHeader>

          {newError && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{newError}</p>
            </Card>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trainee</Label>
              <Select value={newTraineeId} onValueChange={setNewTraineeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trainee..." />
                </SelectTrigger>
                <SelectContent>
                  {trainees.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.employeeId ? ` (${t.employeeId})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>FTO</Label>
              <Select value={newFtoId} onValueChange={setNewFtoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an FTO..." />
                </SelectTrigger>
                <SelectContent>
                  {ftos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}{f.employeeId ? ` (${f.employeeId})` : ""}
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
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleNewAssignment} disabled={isPending}>
              {isPending ? "Creating..." : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------------------- */}
      {/* Reassign Dialog */}
      {/* ----------------------------------------------------------------- */}
      <Dialog
        open={!!reassignDialog}
        onOpenChange={(open) => {
          if (!open) {
            setReassignDialog(null);
            setReassignFtoId("");
            setReassignError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Trainee</DialogTitle>
            <DialogDescription>
              {reassignDialog && (
                <>
                  Reassign <strong>{reassignDialog.traineeName}</strong> from{" "}
                  <strong>{reassignDialog.ftoName}</strong> to a new FTO.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {reassignError && (
            <Card className="border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{reassignError}</p>
            </Card>
          )}

          <div className="space-y-2">
            <Label>New FTO</Label>
            <Select value={reassignFtoId} onValueChange={setReassignFtoId}>
              <SelectTrigger>
                <SelectValue placeholder="Select new FTO..." />
              </SelectTrigger>
              <SelectContent>
                {ftos
                  .filter((f) => f.id !== reassignDialog?.ftoId)
                  .map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}{f.employeeId ? ` (${f.employeeId})` : ""}
                      {f.role === "supervisor" ? " [Sup]" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReassignDialog(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleReassign} disabled={isPending}>
              {isPending ? "Reassigning..." : "Reassign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
