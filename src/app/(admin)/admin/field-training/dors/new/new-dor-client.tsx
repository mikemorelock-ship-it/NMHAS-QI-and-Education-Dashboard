"use client";

import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Lightbulb, Loader2, MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createDailyObservationReport } from "@/actions/field-training";
import { getTraineeFocusAreas } from "@/actions/focus-areas";
import type { FocusArea } from "@/lib/focus-areas";

type Props = {
  trainees: { id: string; firstName: string; lastName: string; employeeId: string }[];
  ftos: { id: string; firstName: string; lastName: string }[];
  phases: { id: string; name: string }[];
  dorCategories: { id: string; name: string; description: string | null }[];
  defaultTraineeId: string | null;
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

function RatingInput({
  value,
  onChange,
  showLabel = false,
}: {
  value: number | null;
  onChange: (v: number) => void;
  showLabel?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            "w-8 h-8 rounded text-xs font-bold transition-all",
            value !== null && i <= value
              ? `${RATING_COLORS[i]} text-white`
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
          )}
        >
          {i}
        </button>
      ))}
      {showLabel && value !== null && (
        <span className="ml-2 text-xs text-muted-foreground">{RATING_LABELS[value]}</span>
      )}
    </div>
  );
}

const SEVERITY_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  high: { border: "border-l-red-500", bg: "bg-red-50", text: "text-red-700" },
  medium: { border: "border-l-orange-500", bg: "bg-orange-50", text: "text-orange-700" },
  low: { border: "border-l-blue-500", bg: "bg-blue-50", text: "text-blue-700" },
};

export function NewDorClient({ trainees, ftos, phases, dorCategories, defaultTraineeId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [categoryRatings, setCategoryRatings] = useState<
    Record<string, { rating: number | null; comments: string }>
  >(Object.fromEntries(dorCategories.map((c) => [c.id, { rating: null, comments: "" }])));
  const [nrtFlag, setNrtFlag] = useState(false);
  const [remFlag, setRemFlag] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Comment dialog state
  const [commentDialog, setCommentDialog] = useState<{ catId: string; catName: string } | null>(
    null
  );
  const [commentDraft, setCommentDraft] = useState("");

  // Focus areas state
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [loadingFocusAreas, setLoadingFocusAreas] = useState(false);
  const [focusAreasExpanded, setFocusAreasExpanded] = useState(true);

  async function handleTraineeChange(traineeId: string) {
    setFocusAreas([]);
    setLoadingFocusAreas(true);
    const result = await getTraineeFocusAreas(traineeId);
    setLoadingFocusAreas(false);
    if (result.success) {
      setFocusAreas(result.focusAreas);
      setFocusAreasExpanded(true);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    // Validate all ratings are selected
    const missingCategories = dorCategories.filter((c) => categoryRatings[c.id]?.rating == null);
    if (overallRating == null) {
      setError("Please select an overall rating.");
      setSubmitting(false);
      return;
    }
    if (missingCategories.length > 0) {
      setError(
        `Please rate all categories. Missing: ${missingCategories.map((c) => c.name).join(", ")}`
      );
      setSubmitting(false);
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("overallRating", overallRating.toString());
    formData.set("nrtFlag", nrtFlag.toString());
    formData.set("remFlag", remFlag.toString());

    const ratings = dorCategories.map((c) => ({
      categoryId: c.id,
      rating: categoryRatings[c.id]?.rating as number,
      comments: categoryRatings[c.id]?.comments || undefined,
    }));

    const result = await createDailyObservationReport(formData, ratings);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Failed to create DOR.");
      return;
    }

    router.push("/admin/field-training/dors");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/field-training/dors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Daily Observation Report</h1>
          <p className="text-muted-foreground">Complete the DOR for this training shift.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Shift Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trainee</Label>
                <Select
                  name="traineeId"
                  defaultValue={defaultTraineeId ?? undefined}
                  required
                  onValueChange={handleTraineeChange}
                >
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
              </div>
              <div className="space-y-2">
                <Label>FTO</Label>
                <Select name="ftoId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select FTO..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ftos.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.lastName}, {f.firstName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  name="date"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Training Phase</Label>
                <Select name="phaseId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select phase..." />
                  </SelectTrigger>
                  <SelectContent>
                    {phases.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Focus Areas */}
        {(loadingFocusAreas || focusAreas.length > 0) && (
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
                          "relative inline-flex items-center justify-center rounded-md transition-colors shrink-0",
                          "h-9 w-9 border",
                          needsComment
                            ? "border-amber-400 bg-amber-50 text-amber-600 hover:bg-amber-100 animate-pulse"
                            : hasComment
                              ? "border-nmh-teal bg-nmh-teal/10 text-nmh-teal hover:bg-nmh-teal/20"
                              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <MessageSquare className="h-4 w-4" />
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
            <CardDescription>
              Identify the trainee&apos;s strongest and weakest areas this shift.
            </CardDescription>
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
              <Label>Overall Rating</Label>
              <RatingInput value={overallRating} onChange={setOverallRating} showLabel />
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
                name="narrative"
                placeholder="Overall observations, strengths, areas for improvement, critical incidents, teaching points..."
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
                  Assigned
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Acknowledgment & Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="traineeAcknowledged" name="traineeAcknowledged" value="true" />
              <Label htmlFor="traineeAcknowledged" className="text-sm">
                Trainee has reviewed and acknowledged this DOR
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Supervisor Review (optional)</Label>
              <Input name="supervisorReviewedBy" placeholder="Supervisor name..." />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link href="/admin/field-training/dors">Cancel</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Submit DOR"}
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
              categoryRatings[commentDialog.catId]?.rating !== null &&
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
