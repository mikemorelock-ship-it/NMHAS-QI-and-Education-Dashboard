"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { Users, Search, UserCog } from "lucide-react";
import { createAssignment } from "@/actions/field-training";

interface TraineeRow {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  status: string;
  startDate: string;
  currentFtos: string[];
  currentPhase: string | null;
  completedPhases: number;
  totalPhases: number;
  dorCount: number;
}

interface FtoOption {
  id: string;
  name: string;
  employeeId: string;
  role: string;
}

interface AllTraineesClientProps {
  trainees: TraineeRow[];
  canManageAssignments: boolean;
  ftos: FtoOption[];
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  separated: "bg-gray-100 text-gray-700",
  remediation: "bg-orange-100 text-orange-700",
};

export function AllTraineesClient({
  trainees,
  canManageAssignments,
  ftos,
}: AllTraineesClientProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  // Assign FTO dialog state
  const [assignTrainee, setAssignTrainee] = useState<TraineeRow | null>(null);
  const [assignFtoId, setAssignFtoId] = useState("");
  const [assignDate, setAssignDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = trainees.filter((t) => {
    const matchesSearch =
      !search ||
      `${t.firstName} ${t.lastName}`
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      t.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = trainees.filter((t) => t.status === "active").length;
  const remCount = trainees.filter((t) => t.status === "remediation").length;

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Trainees</h1>
        <p className="text-muted-foreground mt-1">
          Overview of all trainees across the program
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              {trainees.filter((t) => t.status === "completed").length}
            </div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
      </div>

      {/* Trainee Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Trainees
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-56"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="remediation">Remediation</option>
                <option value="completed">Completed</option>
                <option value="separated">Separated</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No trainees found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Current FTO</TableHead>
                    <TableHead>Current Phase</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead className="text-center">DORs</TableHead>
                    <TableHead>Start Date</TableHead>
                    {canManageAssignments && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const progressPct =
                      t.totalPhases > 0
                        ? Math.round(
                            (t.completedPhases / t.totalPhases) * 100
                          )
                        : 0;
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          {t.lastName}, {t.firstName}
                        </TableCell>
                        <TableCell>{t.employeeId}</TableCell>
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
                        <TableCell>
                          {t.currentFtos.length > 0
                            ? t.currentFtos.join(", ")
                            : "-"}
                        </TableCell>
                        <TableCell>{t.currentPhase || "-"}</TableCell>
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
                        <TableCell className="text-center">
                          {t.dorCount}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {new Date(t.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
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
                  Assign an additional FTO to{" "}
                  <strong>
                    {assignTrainee.lastName}, {assignTrainee.firstName}
                  </strong>
                  .
                  {assignTrainee.currentFtos.length > 0 && (
                    <>
                      {" "}
                      Currently assigned to:{" "}
                      <strong>{assignTrainee.currentFtos.join(", ")}</strong>.
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
    </div>
  );
}
