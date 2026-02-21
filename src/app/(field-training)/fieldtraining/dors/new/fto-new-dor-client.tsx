"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  Lightbulb,
  Save,
  X,
  Loader2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createDailyObservationReport, getTraineeDorHistory } from "@/actions/field-training";
import { useDorAutosave, type DorDraftData } from "@/hooks/use-dor-autosave";
import { getTraineeFocusAreas } from "@/actions/focus-areas";
import type { FocusArea } from "@/lib/focus-areas";

type Props = {
  fto: { id: string; firstName: string; lastName: string };
  trainees: { id: string; firstName: string; lastName: string; employeeId: string }[];
  phases: { id: string; name: string }[];
  dorCategories: { id: string; name: string; description: string | null }[];
  traineePhaseMap: Record<string, string>;
  unackDorMap: Record<string, number>;
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

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-700",
  2: "bg-red-500",
  3: "bg-orange-500",
  4: "bg-gray-500",
  5: "bg-green-500",
  6: "bg-green-600",
  7: "bg-emerald-700",
};

const RATING_BADGE_COLORS: Record<number, string> = {
  1: "bg-red-700 text-white",
  2: "bg-red-500 text-white",
  3: "bg-orange-500 text-white",
  4: "bg-gray-500 text-white",
  5: "bg-green-500 text-white",
  6: "bg-green-600 text-white",
  7: "bg-emerald-700 text-white",
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

function RatingInput({
  value,
  onChange,
  showLabel = false,
  readOnly = false,
}: {
  value: number | null;
  onChange: (v: number) => void;
  showLabel?: boolean;
  readOnly?: boolean;
}) {
  // For the overall assessment: value may be a decimal (e.g. 3.5)
  // The "selected" position is the rounded value; if it's a decimal, we show
  // the decimal in that box and make it slightly larger to highlight it.
  const isDecimal = value !== null && value % 1 !== 0;
  const roundedValue = value !== null ? Math.round(value) : null;

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => {
        const isSelected = roundedValue !== null && i === roundedValue && isDecimal;
        const isFilled = value !== null && i <= (roundedValue ?? 0);
        return (
          <button
            key={i}
            type="button"
            onClick={() => !readOnly && onChange(i)}
            disabled={readOnly}
            className={cn(
              "rounded-md font-bold transition-all",
              isSelected
                ? "w-12 h-12 text-base ring-2 ring-offset-1 ring-white/50"
                : "w-10 h-10 text-sm",
              isFilled
                ? `${RATING_COLORS[i]} text-white shadow-sm`
                : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
              readOnly && "cursor-default"
            )}
          >
            {isSelected && value !== null ? value.toFixed(1) : i}
          </button>
        );
      })}
      {showLabel && value !== null && (
        <span className="ml-2 text-xs text-muted-foreground">
          {RATING_LABELS[roundedValue ?? 0]}
        </span>
      )}
    </div>
  );
}

type DorHistoryItem = {
  id: string;
  date: string;
  ftoName: string;
  phaseName: string | null;
  overallRating: number;
  recommendAction: string;
};

const SEVERITY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  high: { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-700" },
  medium: { border: "border-l-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
  low: { border: "border-l-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
};

export function FtoNewDorClient({
  fto,
  trainees,
  phases,
  dorCategories,
  traineePhaseMap,
  unackDorMap,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [categoryRatings, setCategoryRatings] = useState<
    Record<string, { rating: number | null; comments: string }>
  >(Object.fromEntries(dorCategories.map((c) => [c.id, { rating: null, comments: "" }])));

  // Overall rating is auto-calculated as the average of all category scores
  const overallRating = useMemo(() => {
    const ratings = Object.values(categoryRatings)
      .map((r) => r.rating)
      .filter((r): r is number => r !== null);
    if (ratings.length === 0) return null;
    const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    // Round to 1 decimal place
    return Math.round(avg * 10) / 10;
  }, [categoryRatings]);
  const [nrtFlag, setNrtFlag] = useState(false);
  const [remFlag, setRemFlag] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Comment dialog state
  const [commentDialog, setCommentDialog] = useState<{ catId: string; catName: string } | null>(
    null
  );
  const [commentDraft, setCommentDraft] = useState("");

  // Trainee selection state
  const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
  const [dorHistory, setDorHistory] = useState<DorHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Focus areas state
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [loadingFocusAreas, setLoadingFocusAreas] = useState(false);
  const [focusAreasExpanded, setFocusAreasExpanded] = useState(true);

  // Autosave
  const { restoredDraft, saveDraft, clearDraft, lastSavedAt } = useDorAutosave({ ftoId: fto.id });
  const [showRestoredBanner, setShowRestoredBanner] = useState(!!restoredDraft);
  const narrativeRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  // Derived auto-phase
  const autoPhaseId = selectedTraineeId ? traineePhaseMap[selectedTraineeId] || null : null;
  const autoPhaseName = autoPhaseId ? phases.find((p) => p.id === autoPhaseId)?.name || null : null;

  // Autosave effect: debounce save on form state changes
  useEffect(() => {
    const draftData: DorDraftData = {
      traineeId: selectedTraineeId || undefined,
      date: dateRef.current?.value || undefined,
      phaseId: autoPhaseId || undefined,
      overallRating,
      categoryRatings,
      narrative: narrativeRef.current?.value || undefined,
      recommendAction: undefined,
      nrtFlag,
      remFlag,
      savedAt: new Date().toISOString(),
    };
    saveDraft(draftData);
  }, [selectedTraineeId, overallRating, categoryRatings, nrtFlag, remFlag, saveDraft, autoPhaseId]);

  function restoreDraft() {
    if (!restoredDraft) return;
    if (restoredDraft.traineeId) {
      setSelectedTraineeId(restoredDraft.traineeId);
      handleTraineeChange(restoredDraft.traineeId);
    }
    if (restoredDraft.date && dateRef.current) {
      dateRef.current.value = restoredDraft.date;
    }
    // overallRating is auto-calculated from category ratings, no need to restore
    if (restoredDraft.categoryRatings) {
      setCategoryRatings(restoredDraft.categoryRatings);
    }
    setNrtFlag(restoredDraft.nrtFlag ?? false);
    setRemFlag(restoredDraft.remFlag ?? false);
    if (restoredDraft.narrative && narrativeRef.current) {
      narrativeRef.current.value = restoredDraft.narrative;
    }
    setShowRestoredBanner(false);
  }

  function discardDraft() {
    clearDraft();
    setShowRestoredBanner(false);
  }

  // DOR acknowledgment gate — block if trainee has unacknowledged DORs
  const unackCount = selectedTraineeId ? unackDorMap[selectedTraineeId] || 0 : 0;
  const isBlocked = unackCount > 0;

  // ---------------------------------------------------------------------------
  // Submit readiness — compute what's missing so we can disable the button
  // ---------------------------------------------------------------------------
  const missingItems: string[] = [];
  if (!selectedTraineeId) missingItems.push("Select a trainee");
  if (overallRating == null) missingItems.push("Rate all categories to calculate overall rating");

  const unratedCategories = dorCategories.filter((c) => categoryRatings[c.id]?.rating == null);
  if (unratedCategories.length > 0) {
    missingItems.push(
      `Rate ${unratedCategories.length === dorCategories.length ? "all categories" : unratedCategories.map((c) => c.name).join(", ")}`
    );
  }

  const missingComments = dorCategories.filter((c) => {
    const r = categoryRatings[c.id];
    return r?.rating != null && r.rating < 4 && !r.comments?.trim();
  });
  if (missingComments.length > 0) {
    missingComments.forEach((c) => {
      missingItems.push(`Add comment for "${c.name}" (rated below 4)`);
    });
  }

  const canSubmit = missingItems.length === 0 && !isBlocked;

  async function handleTraineeChange(traineeId: string) {
    setSelectedTraineeId(traineeId);
    setDorHistory([]);
    setFocusAreas([]);
    setLoadingHistory(true);
    setLoadingFocusAreas(true);

    // Fetch history and focus areas in parallel
    const [historyResult, focusResult] = await Promise.all([
      getTraineeDorHistory(traineeId),
      getTraineeFocusAreas(traineeId),
    ]);

    setLoadingHistory(false);
    setLoadingFocusAreas(false);

    if (historyResult.success && historyResult.dors) {
      setDorHistory(historyResult.dors);
    }
    if (focusResult.success) {
      setFocusAreas(focusResult.focusAreas);
      setFocusAreasExpanded(true);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>, asDraft: boolean) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("ftoId", fto.id);
    formData.set("overallRating", (overallRating ?? 4).toString());
    formData.set("nrtFlag", nrtFlag.toString());
    formData.set("remFlag", remFlag.toString());

    const ratings = dorCategories.map((c) => ({
      categoryId: c.id,
      rating: categoryRatings[c.id]?.rating ?? 4,
      comments: categoryRatings[c.id]?.comments || undefined,
    }));

    const result = await createDailyObservationReport(
      formData,
      ratings,
      asDraft ? "draft" : "submitted"
    );
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Failed to create DOR.");
      return;
    }

    clearDraft();
    router.push("/fieldtraining/dors");
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Go back">
          <Link href="/fieldtraining/dors">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Daily Observation Report</h1>
          <p className="text-muted-foreground">Complete the DOR for this training shift.</p>
        </div>
      </div>

      {/* Autosave: Restore draft banner */}
      {showRestoredBanner && restoredDraft && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <Save className="h-4 w-4" />
                <span>
                  Unsaved draft found from {new Date(restoredDraft.savedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-700 border-blue-300 hover:bg-blue-100"
                  onClick={restoreDraft}
                >
                  Resume Draft
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-800"
                  onClick={discardDraft}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Autosave status */}
      {lastSavedAt && !showRestoredBanner && (
        <p className="text-xs text-muted-foreground text-right">
          Draft saved {new Date(lastSavedAt).toLocaleTimeString()}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // Default to submit
          handleSubmit(e, false);
        }}
      >
        <div aria-live="polite">
          {error && (
            <Card className="border-destructive bg-destructive/5 mb-4">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3" role="alert">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">
                      Please fix the following before submitting:
                    </p>
                    {error.includes(", ") ? (
                      <ul className="text-sm text-destructive list-disc list-inside space-y-0.5">
                        {error.split(", ").map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Shift Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trainee</Label>
                {trainees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No trainees assigned. Contact admin.
                  </p>
                ) : (
                  <Select name="traineeId" required onValueChange={handleTraineeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {trainees.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.lastName}, {t.firstName} ({t.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>FTO</Label>
                <Input value={`${fto.lastName}, ${fto.firstName}`} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  ref={dateRef}
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Training Phase</Label>
                <input type="hidden" name="phaseId" value={autoPhaseId || ""} />
                <Input
                  value={
                    autoPhaseName ||
                    (selectedTraineeId ? "No active phase" : "Select a trainee first")
                  }
                  disabled
                  className="bg-muted"
                />
                {selectedTraineeId && !autoPhaseId && (
                  <p className="text-xs text-orange-600">
                    This trainee has no in-progress training phase.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DOR Acknowledgment Gate */}
        {isBlocked && selectedTraineeId && (
          <Card className="mt-4 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Cannot Create New DOR</p>
                  <p className="text-sm text-red-700 mt-1">
                    This trainee has{" "}
                    <strong>
                      {unackCount} unacknowledged DOR{unackCount > 1 ? "s" : ""}
                    </strong>{" "}
                    that must be reviewed first. Please direct the trainee to log in and acknowledge
                    their previous DOR{unackCount > 1 ? "s" : ""} before submitting a new one.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 text-red-700 border-red-300 hover:bg-red-100"
                    asChild
                  >
                    <Link href="/fieldtraining/dors">View DORs</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Focus Areas */}
        {selectedTraineeId && !isBlocked && (
          <Card className="mt-4 border-violet-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-violet-600" />
                  Recommended Focus Areas
                </CardTitle>
                {focusAreas.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setFocusAreasExpanded(!focusAreasExpanded)}
                  >
                    {focusAreasExpanded ? "Collapse" : "Expand"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingFocusAreas ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing trainee history...
                </div>
              ) : focusAreas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No specific focus areas identified. Continue with standard evaluation.
                </p>
              ) : focusAreasExpanded ? (
                <div className="space-y-2">
                  {focusAreas.map((area, i) => {
                    const colors = SEVERITY_COLORS[area.severity];
                    return (
                      <div
                        key={i}
                        className={cn("rounded-md border-l-4 p-3", colors.border, colors.bg)}
                      >
                        <p className={cn("text-sm font-medium", colors.text)}>{area.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{area.detail}</p>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground italic mt-2">
                    These suggestions are based on training history and are advisory only.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {focusAreas.length} focus area{focusAreas.length === 1 ? "" : "s"} identified.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* DOR History */}
        {selectedTraineeId && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Trainee DOR History</CardTitle>
              <CardDescription>
                Previous submitted DORs for this trainee (from all FTOs).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading history...</p>
              ) : dorHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No previous DORs found.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>FTO</TableHead>
                      <TableHead>Phase</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Rec.</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dorHistory.map((dor) => (
                      <TableRow key={dor.id}>
                        <TableCell className="font-medium">
                          {new Date(dor.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{dor.ftoName}</TableCell>
                        <TableCell>{dor.phaseName || "—"}</TableCell>
                        <TableCell>
                          <Badge className={RATING_BADGE_COLORS[Math.round(dor.overallRating)]}>
                            {dor.overallRating % 1 !== 0
                              ? dor.overallRating.toFixed(1)
                              : dor.overallRating}
                            /7
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {RECOMMEND_LABELS[dor.recommendAction] || dor.recommendAction}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/fieldtraining/dors/${dor.id}`} target="_blank">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-xl">Daily Observation Report</CardTitle>
            <CardDescription>
              Rate the trainee in each category using the FTEP 1-7 scale.
              <span className="block mt-1 text-xs">
                1-2 = Not Acceptable &middot; 3 = Below Standard &middot; 4 = Acceptable &middot; 5
                = Above Standard &middot; 6-7 = Superior
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dorCategories.map((cat) => {
                const rating = categoryRatings[cat.id]?.rating;
                const comments = categoryRatings[cat.id]?.comments || "";
                const hasComment = !!comments.trim();
                const isLowRating = rating !== null && rating < 4;
                const needsComment = isLowRating && !hasComment;

                return (
                  <div
                    key={cat.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      needsComment && "border-amber-400 bg-amber-50/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm font-medium">{cat.name}</Label>
                        {cat.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {cat.description}
                          </p>
                        )}
                        <div className="mt-2">
                          <RatingInput
                            value={rating ?? null}
                            onChange={(v) =>
                              setCategoryRatings((prev) => ({
                                ...prev,
                                [cat.id]: { ...prev[cat.id], rating: v },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        title={hasComment ? "Edit comment" : "Add comment"}
                        onClick={() => {
                          setCommentDraft(comments);
                          setCommentDialog({ catId: cat.id, catName: cat.name });
                        }}
                        className={cn(
                          "relative inline-flex items-center justify-center gap-1.5 rounded-md transition-colors shrink-0",
                          "h-10 px-3 border text-sm font-medium",
                          needsComment
                            ? "border-amber-400 bg-amber-50 text-amber-600 hover:bg-amber-100 animate-pulse"
                            : hasComment
                              ? "border-nmh-teal bg-nmh-teal/10 text-nmh-teal hover:bg-nmh-teal/20"
                              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Comment</span>
                        {hasComment && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-nmh-teal ring-2 ring-background" />
                        )}
                        {needsComment && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Most Satisfactory Performance</Label>
                <Select name="mostSatisfactory">
                  <SelectTrigger>
                    <SelectValue placeholder="Select strongest area..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dorCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Least Satisfactory Performance</Label>
                <Select name="leastSatisfactory">
                  <SelectTrigger>
                    <SelectValue placeholder="Select area needing most improvement..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dorCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Overall Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Overall Rating{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  (auto-calculated average)
                </span>
              </Label>
              <RatingInput value={overallRating} onChange={() => {}} readOnly showLabel />
            </div>
            <div className="space-y-2">
              <Label>Recommendation</Label>
              <Select name="recommendAction" defaultValue="continue">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continue">Continue in Current Phase</SelectItem>
                  <SelectItem value="advance">Advance to Next Phase</SelectItem>
                  <SelectItem value="extend">Extend Current Phase</SelectItem>
                  <SelectItem value="remediate">Place on Remedial Training</SelectItem>
                  <SelectItem value="nrt">Not Responding to Training (NRT)</SelectItem>
                  <SelectItem value="release">Recommend Release to Solo</SelectItem>
                  <SelectItem value="terminate">Recommend Termination</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Narrative / Notes</Label>
              <Textarea
                ref={narrativeRef}
                name="narrative"
                placeholder="Overall observations, strengths, areas for improvement..."
                rows={4}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="nrtFlag" checked={nrtFlag} onCheckedChange={(v) => setNrtFlag(!!v)} />
                <Label htmlFor="nrtFlag" className="text-sm">
                  <Badge className="bg-red-100 text-red-800">NRT</Badge> Not Responding to Training
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remFlag" checked={remFlag} onCheckedChange={(v) => setRemFlag(!!v)} />
                <Label htmlFor="remFlag" className="text-sm">
                  <Badge className="bg-orange-100 text-orange-800">REM</Badge> Remedial Training
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Readiness checklist — shown when form is incomplete */}
        {!canSubmit && !isBlocked && selectedTraineeId && (
          <Card className="mt-4 border-amber-300 bg-amber-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800">
                    Complete the following to submit:
                  </p>
                  <ul className="text-sm text-amber-700 list-disc list-inside space-y-0.5">
                    {missingItems.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link href="/fieldtraining/dors">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting || isBlocked}
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest("form");
              if (form) {
                const fakeEvent = {
                  preventDefault: () => {},
                  currentTarget: form,
                } as unknown as React.FormEvent<HTMLFormElement>;
                handleSubmit(fakeEvent, true);
              }
            }}
          >
            {submitting ? "Saving..." : "Save Draft"}
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Submitting..." : "Submit DOR"}
          </Button>
        </div>
      </form>

      {/* Comment Dialog */}
      <Dialog
        open={commentDialog !== null}
        onOpenChange={(open) => {
          if (!open) setCommentDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments — {commentDialog?.catName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-hidden">
            {commentDialog &&
              (categoryRatings[commentDialog.catId]?.rating ?? null) !== null &&
              (categoryRatings[commentDialog.catId]?.rating ?? 4) < 4 && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 border border-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    This category is rated below standard. Please provide comments to help the
                    trainee improve.
                  </span>
                </div>
              )}
            <Textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Enter observations, specific examples, teaching points, or areas for improvement..."
              rows={8}
              className="!field-sizing-normal resize-y min-h-[180px]"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Detailed comments help trainees understand expectations and track their growth.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (commentDialog) {
                  setCategoryRatings((prev) => ({
                    ...prev,
                    [commentDialog.catId]: {
                      ...prev[commentDialog.catId],
                      comments: commentDraft,
                    },
                  }));
                }
                setCommentDialog(null);
              }}
            >
              Save Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
