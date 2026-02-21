"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Trash2,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RatingBadge } from "@/components/field-training/RatingBadge";
import {
  updateTraineePhase,
  signoffSkill,
  removeSkillSignoff,
  updateTrainee,
  setTraineePin,
  addSupervisorNote,
  deleteSupervisorNote,
} from "@/actions/field-training";
import { FTO_ROLE_LABELS, PHASE_SIGNOFF_ROLES } from "@/lib/constants";

type Trainee = {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string | null;
  hireDate: string;
  startDate: string;
  completionDate: string | null;
  status: string;
  notes: string | null;
  hasPin: boolean;
  divisionName: string | null;
};

type Assignment = {
  id: string;
  ftoName: string;
  ftoEmployeeId: string;
  startDate: string;
  endDate: string | null;
  status: string;
};

type Phase = {
  id: string;
  phaseName: string;
  phaseSlug: string;
  minDays: number | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  ftoSignoffName: string | null;
  notes: string | null;
};

type NoteEntry = {
  id: string;
  text: string;
  authorName: string;
  authorId: string;
  createdAt: string;
};

type Dor = {
  id: string;
  date: string;
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
  acknowledgedAt: string | null;
  supervisorNotes: string | null;
  status: string;
  ratings: { categoryName: string; rating: number; comments: string | null }[];
  noteEntries: NoteEntry[];
};

type SkillStep = {
  id: string;
  stepNumber: number;
  description: string;
  isRequired: boolean;
};

type SkillCat = {
  id: string;
  name: string;
  skills: {
    id: string;
    name: string;
    isCritical: boolean;
    signedOff: boolean;
    signoffFto: string | null;
    signoffDate: string | null;
    steps: SkillStep[];
  }[];
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-800",
  separated: "bg-gray-100 text-gray-800",
  remediation: "bg-orange-100 text-orange-800",
};

const phaseStatusIcons: Record<string, React.ReactNode> = {
  not_started: <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />,
  in_progress: <Clock className="h-5 w-5 text-nmh-teal" aria-hidden="true" />,
  completed: <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />,
};

const actionLabels: Record<string, string> = {
  continue: "Continue",
  advance: "Advance",
  extend: "Extend Phase",
  remediate: "Remediate",
  nrt: "NRT",
  release: "Release to Solo",
  terminate: "Terminate",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// RatingBadge imported from shared component

export function TraineeDetailClient({
  trainee,
  assignments,
  phases,
  dors,
  skillCategories,
  ftos,
  currentUserId,
  backUrl = "/admin/field-training/trainees",
  dorNewUrl,
}: {
  trainee: Trainee;
  assignments: Assignment[];
  phases: Phase[];
  dors: Dor[];
  skillCategories: SkillCat[];
  ftos: { id: string; firstName: string; lastName: string; role: string }[];
  currentUserId: string;
  backUrl?: string;
  dorNewUrl?: string;
}) {
  const [expandedDor, setExpandedDor] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [signoffDialog, setSignoffDialog] = useState<{ skillId: string; skillName: string } | null>(
    null
  );
  const [phaseDialog, setPhaseDialog] = useState<Phase | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const phaseSignoffFtos = ftos.filter((f) =>
    (PHASE_SIGNOFF_ROLES as readonly string[]).includes(f.role)
  );

  const totalSkills = skillCategories.reduce((sum, c) => sum + c.skills.length, 0);
  const completedSkills = skillCategories.reduce(
    (sum, c) => sum + c.skills.filter((s) => s.signedOff).length,
    0
  );
  const skillPct = totalSkills > 0 ? Math.round((completedSkills / totalSkills) * 100) : 0;
  const activeAssignment = assignments.find((a) => a.status === "active");

  async function handleSignoff(formData: FormData) {
    if (!signoffDialog) return;
    const ftoId = formData.get("ftoId") as string;
    const date = formData.get("date") as string;
    const notes = formData.get("notes") as string;
    await signoffSkill(trainee.id, signoffDialog.skillId, ftoId, date, notes);
    setSignoffDialog(null);
  }

  async function handleRemoveSignoff(skillId: string) {
    if (!confirm("Remove this skill signoff?")) return;
    await removeSkillSignoff(trainee.id, skillId);
  }

  async function handlePhaseUpdate(formData: FormData) {
    if (!phaseDialog) return;
    setPhaseError(null);
    const result = await updateTraineePhase(phaseDialog.id, {
      status: formData.get("status") as string,
      startDate: (formData.get("startDate") as string) || undefined,
      endDate: (formData.get("endDate") as string) || undefined,
      ftoSignoffId: (formData.get("ftoSignoffId") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    });
    if (!result.success) {
      setPhaseError(result.error || "Failed to update phase.");
      return;
    }
    setPhaseDialog(null);
  }

  async function handleSetPin() {
    setPinError(null);
    if (pinValue.length < 6 || pinValue.length > 8) {
      setPinError("PIN must be 6-8 digits.");
      return;
    }
    if (pinValue !== pinConfirm) {
      setPinError("PINs do not match.");
      return;
    }
    const result = await setTraineePin(trainee.id, pinValue);
    if (!result.success) {
      setPinError(result.error || "Failed to set PIN.");
      return;
    }
    setPinDialogOpen(false);
    setPinValue("");
    setPinConfirm("");
  }

  const [noteText, setNoteText] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState(false);

  async function handleAddNote(dorId: string) {
    const text = noteText[dorId]?.trim();
    if (!text) return;
    setSavingNote(true);
    await addSupervisorNote(dorId, text);
    setNoteText((prev) => ({ ...prev, [dorId]: "" }));
    setSavingNote(false);
  }

  async function handleDeleteNote(noteId: string) {
    setSavingNote(true);
    await deleteSupervisorNote(noteId);
    setSavingNote(false);
  }

  async function handleStatusChange(newStatus: string) {
    const fd = new FormData();
    fd.set("firstName", trainee.firstName);
    fd.set("lastName", trainee.lastName);
    fd.set("employeeId", trainee.employeeId);
    fd.set("hireDate", trainee.hireDate.split("T")[0]);
    fd.set("startDate", trainee.startDate.split("T")[0]);
    fd.set("status", newStatus);
    if (trainee.email) fd.set("email", trainee.email);
    if (trainee.notes) fd.set("notes", trainee.notes);
    await updateTrainee(trainee.id, fd);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild aria-label="Go back">
            <Link href={backUrl}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {trainee.firstName} {trainee.lastName}
            </h1>
            <p className="text-muted-foreground">
              {trainee.employeeId} {trainee.divisionName && `· ${trainee.divisionName}`}
            </p>
          </div>
          <Badge className={statusColors[trainee.status] ?? ""}>{trainee.status}</Badge>
          <Badge
            variant={trainee.hasPin ? "default" : "outline"}
            className={cn("ml-2", trainee.hasPin ? "bg-green-600" : "text-muted-foreground")}
          >
            PIN: {trainee.hasPin ? "Set" : "None"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPinValue("");
              setPinConfirm("");
              setPinError(null);
              setPinDialogOpen(true);
            }}
          >
            <KeyRound className="h-4 w-4 mr-1" aria-hidden="true" />
            {trainee.hasPin ? "Change PIN" : "Set PIN"}
          </Button>
          <Select value={trainee.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="remediation">Remediation</SelectItem>
              <SelectItem value="separated">Separated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Hire Date</p>
            <p className="text-lg font-semibold">{formatDate(trainee.hireDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Current FTO</p>
            <p className="text-lg font-semibold">{activeAssignment?.ftoName ?? "Unassigned"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Phase Progress</p>
            <p className="text-lg font-semibold">
              {phases.filter((p) => p.status === "completed").length}/{phases.length} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Skills Progress</p>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">{skillPct}%</p>
              <Progress value={skillPct} className="h-2 flex-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="phases">
        <TabsList>
          <TabsTrigger value="phases">Phase Timeline</TabsTrigger>
          <TabsTrigger value="dors">DORs ({dors.length})</TabsTrigger>
          <TabsTrigger value="skills">Skills Checklist</TabsTrigger>
          <TabsTrigger value="assignments">FTO Assignments</TabsTrigger>
        </TabsList>

        {/* Phase Timeline */}
        <TabsContent value="phases">
          <Card>
            <CardHeader>
              <CardTitle>Training Phase Timeline</CardTitle>
              <CardDescription>Click a phase to update its status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {phases.map((phase, i) => (
                  <button
                    type="button"
                    key={phase.id}
                    className="flex items-start gap-4 w-full text-left cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors"
                    onClick={() => setPhaseDialog(phase)}
                    aria-label={`Update phase: ${phase.phaseName} — ${phase.status.replace("_", " ")}`}
                  >
                    <div className="flex flex-col items-center">
                      <span aria-hidden="true">{phaseStatusIcons[phase.status]}</span>
                      {i < phases.length - 1 && (
                        <div
                          aria-hidden="true"
                          className={cn(
                            "w-0.5 h-8 mt-1",
                            phase.status === "completed" ? "bg-green-300" : "bg-muted-foreground/20"
                          )}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{phase.phaseName}</span>
                        <Badge
                          variant={
                            phase.status === "completed"
                              ? "default"
                              : phase.status === "in_progress"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {phase.status.replace("_", " ")}
                        </Badge>
                        {phase.minDays && (
                          <span className="text-xs text-muted-foreground">
                            Min {phase.minDays} days
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {phase.startDate && <span>Started {formatDate(phase.startDate)}</span>}
                        {phase.endDate && <span> · Ended {formatDate(phase.endDate)}</span>}
                        {phase.ftoSignoffName && (
                          <span> · Signed off by {phase.ftoSignoffName}</span>
                        )}
                      </div>
                      {phase.notes && <p className="text-sm mt-1">{phase.notes}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Observation Reports */}
        <TabsContent value="dors">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Daily Observation Reports</CardTitle>
                <CardDescription>
                  {dors.length} DOR{dors.length !== 1 ? "s" : ""} recorded
                </CardDescription>
              </div>
              <Button asChild>
                <Link href={dorNewUrl || `/admin/field-training/dors/new?traineeId=${trainee.id}`}>
                  New DOR
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {dors.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No DORs recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {dors.map((dor) => (
                    <div key={dor.id} className="border rounded-lg">
                      <button
                        type="button"
                        className="flex items-center justify-between p-4 w-full text-left cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedDor(expandedDor === dor.id ? null : dor.id)}
                        aria-expanded={expandedDor === dor.id}
                        aria-label={`DOR ${formatDate(dor.date)} by ${dor.ftoName} — overall rating ${dor.overallRating}`}
                      >
                        <div className="flex items-center gap-4">
                          {expandedDor === dor.id ? (
                            <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          )}
                          <div>
                            <span className="font-medium">{formatDate(dor.date)}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              by {dor.ftoName}
                            </span>
                            {dor.phaseName && (
                              <Badge variant="outline" className="ml-2">
                                {dor.phaseName}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dor.nrtFlag && (
                            <Badge className="bg-red-100 text-red-800">
                              <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                              NRT
                            </Badge>
                          )}
                          {dor.remFlag && (
                            <Badge className="bg-orange-100 text-orange-800">REM</Badge>
                          )}
                          {dor.status === "draft" && (
                            <Badge variant="outline" className="border-orange-400 text-orange-700">
                              Draft
                            </Badge>
                          )}
                          <RatingBadge rating={dor.overallRating} />
                          <Badge
                            variant={
                              dor.recommendAction === "continue" ||
                              dor.recommendAction === "advance"
                                ? "secondary"
                                : dor.recommendAction === "release"
                                  ? "default"
                                  : "destructive"
                            }
                          >
                            {actionLabels[dor.recommendAction] ?? dor.recommendAction}
                          </Badge>
                          {dor.status === "submitted" && (
                            <Badge
                              variant={dor.traineeAcknowledged ? "default" : "outline"}
                              className={dor.traineeAcknowledged ? "bg-green-600" : ""}
                            >
                              {dor.traineeAcknowledged ? "Ack'd" : "Pending Ack"}
                            </Badge>
                          )}
                        </div>
                      </button>
                      {expandedDor === dor.id && (
                        <div className="border-t p-4 space-y-3">
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
                          {/* Acknowledgment */}
                          <div className="p-3 rounded-lg border mt-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                              Acknowledgment
                            </p>
                            {dor.traineeAcknowledged ? (
                              <div className="flex items-center gap-2">
                                <CheckCircle2
                                  className="h-4 w-4 text-green-600"
                                  aria-hidden="true"
                                />
                                <span className="text-sm text-green-800">
                                  Acknowledged
                                  {dor.acknowledgedAt
                                    ? ` on ${formatDate(dor.acknowledgedAt)}`
                                    : ""}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                {dor.status === "draft" ? "Draft — not yet submitted" : "Pending"}
                              </span>
                            )}
                          </div>

                          {/* Supervisor Notes — Timestamped Thread */}
                          <div className="p-3 rounded-lg border mt-3">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                              Supervisor Notes
                              {dor.noteEntries.length > 0 && (
                                <span className="ml-1 text-nmh-teal">
                                  ({dor.noteEntries.length})
                                </span>
                              )}
                            </p>

                            {/* Existing notes */}
                            {dor.noteEntries.length > 0 && (
                              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                {dor.noteEntries.map((note) => (
                                  <div
                                    key={note.id}
                                    className="rounded border bg-muted/30 p-2 space-y-0.5"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="text-xs">
                                        <span className="font-medium">{note.authorName}</span>
                                        <span className="text-muted-foreground ml-1.5">
                                          {new Date(note.createdAt).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })}
                                          {" at "}
                                          {new Date(note.createdAt).toLocaleTimeString("en-US", {
                                            hour: "numeric",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                      {note.authorId === currentUserId && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                          onClick={() => handleDeleteNote(note.id)}
                                          disabled={savingNote}
                                          aria-label="Delete note"
                                        >
                                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                                        </Button>
                                      )}
                                    </div>
                                    <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add note input */}
                            <div className="flex gap-2">
                              <Textarea
                                value={noteText[dor.id] ?? ""}
                                onChange={(e) =>
                                  setNoteText((prev) => ({ ...prev, [dor.id]: e.target.value }))
                                }
                                placeholder="Add a note..."
                                rows={2}
                                className="text-sm flex-1"
                              />
                              <Button
                                size="sm"
                                className="self-end"
                                onClick={() => handleAddNote(dor.id)}
                                disabled={savingNote || !noteText[dor.id]?.trim()}
                              >
                                <Send className="h-3 w-3 mr-1" aria-hidden="true" />
                                Add
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Checklist */}
        <TabsContent value="skills">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Skills Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedSkills}/{totalSkills} ({skillPct}%)
                  </span>
                </div>
                <Progress value={skillPct} className="h-3" />
              </CardContent>
            </Card>

            {skillCategories.map((cat) => {
              const catCompleted = cat.skills.filter((s) => s.signedOff).length;
              const catPct =
                cat.skills.length > 0 ? Math.round((catCompleted / cat.skills.length) * 100) : 0;
              return (
                <Card key={cat.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{cat.name}</CardTitle>
                      <Badge variant={catPct === 100 ? "default" : "secondary"}>
                        {catCompleted}/{cat.skills.length}
                      </Badge>
                    </div>
                    <Progress value={catPct} className="h-1.5" />
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        {cat.skills.map((skill) => (
                          <React.Fragment key={skill.id}>
                            <TableRow>
                              <TableCell className="w-8">
                                {skill.signedOff ? (
                                  <CheckCircle2
                                    className="h-5 w-5 text-green-600"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Circle
                                    className="h-5 w-5 text-muted-foreground/40"
                                    aria-hidden="true"
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {skill.steps.length > 0 && (
                                    <button
                                      type="button"
                                      className="p-0.5 hover:bg-muted rounded"
                                      onClick={() =>
                                        setExpandedSkill(
                                          expandedSkill === skill.id ? null : skill.id
                                        )
                                      }
                                      aria-expanded={expandedSkill === skill.id}
                                      aria-label={`${expandedSkill === skill.id ? "Collapse" : "Expand"} steps for ${skill.name}`}
                                    >
                                      {expandedSkill === skill.id ? (
                                        <ChevronDown
                                          className="h-4 w-4 text-muted-foreground"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <ChevronRight
                                          className="h-4 w-4 text-muted-foreground"
                                          aria-hidden="true"
                                        />
                                      )}
                                    </button>
                                  )}
                                  <span
                                    className={cn(
                                      "font-medium",
                                      skill.signedOff && "text-muted-foreground line-through"
                                    )}
                                  >
                                    {skill.name}
                                  </span>
                                  {skill.isCritical && (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px] px-1.5 py-0"
                                    >
                                      <AlertTriangle
                                        className="h-3 w-3 mr-0.5"
                                        aria-hidden="true"
                                      />
                                      Critical
                                    </Badge>
                                  )}
                                  {skill.steps.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 text-muted-foreground"
                                    >
                                      {skill.steps.length} step{skill.steps.length !== 1 ? "s" : ""}
                                    </Badge>
                                  )}
                                </div>
                                {skill.signedOff && skill.signoffFto && (
                                  <p className="text-xs text-muted-foreground">
                                    Signed off by {skill.signoffFto} on{" "}
                                    {formatDate(skill.signoffDate!)}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {skill.signedOff ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveSignoff(skill.id)}
                                  >
                                    Remove
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setSignoffDialog({ skillId: skill.id, skillName: skill.name })
                                    }
                                  >
                                    Sign Off
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            {expandedSkill === skill.id && skill.steps.length > 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="bg-muted/30 py-2 px-8">
                                  <ol className="space-y-1.5">
                                    {skill.steps.map((step) => (
                                      <li key={step.id} className="flex items-start gap-2 text-sm">
                                        <span className="font-mono text-xs text-muted-foreground w-6 shrink-0 pt-0.5">
                                          {step.stepNumber}.
                                        </span>
                                        <span>{step.description}</span>
                                        {!step.isRequired && (
                                          <Badge
                                            variant="outline"
                                            className="text-[10px] px-1 py-0 shrink-0"
                                          >
                                            optional
                                          </Badge>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* FTO Assignments */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <CardTitle>FTO Assignment History</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FTO</TableHead>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.ftoName}</TableCell>
                      <TableCell className="font-mono text-sm">{a.ftoEmployeeId}</TableCell>
                      <TableCell>{formatDate(a.startDate)}</TableCell>
                      <TableCell>{a.endDate ? formatDate(a.endDate) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "active" ? "default" : "secondary"}>
                          {a.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No FTO assignments recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Skill Signoff Dialog */}
      <Dialog
        open={!!signoffDialog}
        onOpenChange={(open) => {
          if (!open) setSignoffDialog(null);
        }}
      >
        <DialogContent>
          <form action={handleSignoff}>
            <DialogHeader>
              <DialogTitle>Sign Off Skill</DialogTitle>
              <DialogDescription>
                Record completion of: <strong>{signoffDialog?.skillName}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="signoff-fto">Signed Off By</Label>
                <Select name="ftoId" required>
                  <SelectTrigger id="signoff-fto">
                    <SelectValue placeholder="Select FTO..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ftos.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.firstName} {f.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signoff-date">Date</Label>
                <Input
                  id="signoff-date"
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signoff-notes">Notes</Label>
                <Textarea id="signoff-notes" name="notes" placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Confirm Signoff</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog
        open={pinDialogOpen}
        onOpenChange={(open) => {
          setPinDialogOpen(open);
          if (!open) setPinError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Portal PIN</DialogTitle>
            <DialogDescription>
              Set a 6-8 digit PIN for {trainee.firstName} {trainee.lastName} to access the Trainee
              Portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div aria-live="polite">
              {pinError && (
                <p className="text-sm text-destructive" role="alert">
                  {pinError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-input">PIN (6-8 digits)</Label>
              <Input
                id="pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter PIN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin-confirm-input">Confirm PIN</Label>
              <Input
                id="pin-confirm-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                placeholder="Confirm PIN"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetPin}>Set PIN</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phase Update Dialog */}
      <Dialog
        open={!!phaseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setPhaseDialog(null);
            setPhaseError(null);
          }
        }}
      >
        <DialogContent>
          <form action={handlePhaseUpdate}>
            <DialogHeader>
              <DialogTitle>Update Phase: {phaseDialog?.phaseName}</DialogTitle>
              <DialogDescription>
                Update the status and dates for this training phase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div aria-live="polite">
                {phaseError && (
                  <p className="text-sm text-destructive" role="alert">
                    {phaseError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase-status">Status</Label>
                <Select name="status" defaultValue={phaseDialog?.status}>
                  <SelectTrigger id="phase-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phase-start-date">Start Date</Label>
                  <Input
                    id="phase-start-date"
                    name="startDate"
                    type="date"
                    defaultValue={phaseDialog?.startDate?.split("T")[0] ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phase-end-date">End Date</Label>
                  <Input
                    id="phase-end-date"
                    name="endDate"
                    type="date"
                    defaultValue={phaseDialog?.endDate?.split("T")[0] ?? ""}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase-signoff-by">Signed Off By</Label>
                {phaseSignoffFtos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No supervisors or managers available. Add an FTO with a supervisor or manager
                    role to enable phase signoffs.
                  </p>
                ) : (
                  <>
                    <Select name="ftoSignoffId" defaultValue={undefined}>
                      <SelectTrigger id="phase-signoff-by">
                        <SelectValue placeholder="Select supervisor/manager..." />
                      </SelectTrigger>
                      <SelectContent>
                        {phaseSignoffFtos.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.firstName} {f.lastName} ({FTO_ROLE_LABELS[f.role]})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Only supervisors and managers can sign off phases.
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase-notes">Notes</Label>
                <Textarea id="phase-notes" name="notes" defaultValue={phaseDialog?.notes ?? ""} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Update Phase</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
