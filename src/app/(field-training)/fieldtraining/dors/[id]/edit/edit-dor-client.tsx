"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateDorDraft, submitDor, getTraineeDorHistory } from "@/actions/field-training";

type Props = {
  dorId: string;
  fto: { id: string; firstName: string; lastName: string };
  trainees: { id: string; firstName: string; lastName: string; employeeId: string }[];
  phases: { id: string; name: string }[];
  dorCategories: { id: string; name: string; description: string | null }[];
  traineePhaseMap: Record<string, string>;
  existingData: {
    traineeId: string;
    phaseId: string | null;
    date: string;
    overallRating: number;
    narrative: string;
    mostSatisfactory: string;
    leastSatisfactory: string;
    recommendAction: string;
    nrtFlag: boolean;
    remFlag: boolean;
    categoryRatings: Record<string, { rating: number; comments: string }>;
  };
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

const RATING_LABELS: Record<number, string> = {
  1: "Not Acceptable",
  2: "Not Acceptable",
  3: "Below Standard",
  4: "Acceptable",
  5: "Above Standard",
  6: "Superior",
  7: "Superior",
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
}: {
  value: number;
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
            i <= value
              ? `${RATING_COLORS[i]} text-white`
              : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
          )}
        >
          {i}
        </button>
      ))}
      {showLabel && (
        <span className="ml-2 text-xs text-muted-foreground">{RATING_LABELS[value]}</span>
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

export function EditDorClient({ dorId, fto, trainees, phases, dorCategories, traineePhaseMap, existingData }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overallRating, setOverallRating] = useState(existingData.overallRating);
  const [categoryRatings, setCategoryRatings] = useState<
    Record<string, { rating: number; comments: string }>
  >(
    Object.fromEntries(
      dorCategories.map((c) => [
        c.id,
        existingData.categoryRatings[c.id] || { rating: 4, comments: "" },
      ])
    )
  );
  const [nrtFlag, setNrtFlag] = useState(existingData.nrtFlag);
  const [remFlag, setRemFlag] = useState(existingData.remFlag);
  const [submitting, setSubmitting] = useState(false);

  // Trainee selection state
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>(existingData.traineeId);
  const [dorHistory, setDorHistory] = useState<DorHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Derived auto-phase
  const autoPhaseId = traineePhaseMap[selectedTraineeId] || null;
  const autoPhaseName = autoPhaseId ? phases.find((p) => p.id === autoPhaseId)?.name || null : null;

  // Load DOR history on mount for the existing trainee
  useEffect(() => {
    async function loadHistory() {
      setLoadingHistory(true);
      const result = await getTraineeDorHistory(selectedTraineeId);
      setLoadingHistory(false);
      if (result.success && result.dors) {
        setDorHistory(result.dors);
      }
    }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTraineeChange(traineeId: string) {
    setSelectedTraineeId(traineeId);
    setDorHistory([]);
    setLoadingHistory(true);
    const result = await getTraineeDorHistory(traineeId);
    setLoadingHistory(false);
    if (result.success && result.dors) {
      setDorHistory(result.dors);
    }
  }

  function buildFormData(form: HTMLFormElement) {
    const formData = new FormData(form);
    formData.set("ftoId", fto.id);
    formData.set("overallRating", overallRating.toString());
    formData.set("nrtFlag", nrtFlag.toString());
    formData.set("remFlag", remFlag.toString());
    return formData;
  }

  function buildRatings() {
    return dorCategories.map((c) => ({
      categoryId: c.id,
      rating: categoryRatings[c.id]?.rating ?? 4,
      comments: categoryRatings[c.id]?.comments || undefined,
    }));
  }

  async function handleSaveDraft(form: HTMLFormElement) {
    setError(null);
    setSubmitting(true);
    const result = await updateDorDraft(dorId, buildFormData(form), buildRatings());
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || "Failed to save draft.");
      return;
    }
    router.push("/fieldtraining/dors");
  }

  async function handleSubmitDor(form: HTMLFormElement) {
    setError(null);
    setSubmitting(true);
    // First update the draft with latest data
    const updateResult = await updateDorDraft(dorId, buildFormData(form), buildRatings());
    if (!updateResult.success) {
      setSubmitting(false);
      setError(updateResult.error || "Failed to save changes.");
      return;
    }
    // Then submit
    const submitResult = await submitDor(dorId);
    setSubmitting(false);
    if (!submitResult.success) {
      setError(submitResult.error || "Failed to submit DOR.");
      return;
    }
    router.push("/fieldtraining/dors");
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fieldtraining/dors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Draft DOR</h1>
          <p className="text-muted-foreground">Update the draft and submit when ready.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmitDor(e.currentTarget);
        }}
      >
        {error && (
          <Card className="border-destructive mb-4">
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
                <Select name="traineeId" defaultValue={existingData.traineeId} required onValueChange={handleTraineeChange}>
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
                <Input value={`${fto.lastName}, ${fto.firstName}`} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input name="date" type="date" defaultValue={existingData.date} required />
              </div>
              <div className="space-y-2">
                <Label>Training Phase</Label>
                <input type="hidden" name="phaseId" value={autoPhaseId || ""} />
                <Input
                  value={autoPhaseName || "No active phase"}
                  disabled
                  className="bg-muted"
                />
                {!autoPhaseId && (
                  <p className="text-xs text-orange-600">
                    This trainee has no in-progress training phase.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DOR History */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Trainee DOR History</CardTitle>
            <CardDescription>
              Previous submitted DORs for this trainee (from all FTOs).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Loading history...
              </p>
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
                        <Badge className={RATING_BADGE_COLORS[dor.overallRating]}>
                          {dor.overallRating}/7
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

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Performance Ratings</CardTitle>
            <CardDescription>
              1-2 = Not Acceptable &middot; 3 = Below Standard &middot; 4 = Acceptable &middot; 5 =
              Above Standard &middot; 6-7 = Superior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dorCategories.map((cat) => (
                <div key={cat.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Label className="text-sm font-medium">{cat.name}</Label>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {cat.description}
                        </p>
                      )}
                      <div className="mt-2">
                        <RatingInput
                          value={categoryRatings[cat.id]?.rating ?? 4}
                          onChange={(v) =>
                            setCategoryRatings((prev) => ({
                              ...prev,
                              [cat.id]: { ...prev[cat.id], rating: v },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Comments (optional)"
                        value={categoryRatings[cat.id]?.comments ?? ""}
                        onChange={(e) =>
                          setCategoryRatings((prev) => ({
                            ...prev,
                            [cat.id]: { ...prev[cat.id], comments: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Most Satisfactory Performance</Label>
                <Select
                  name="mostSatisfactory"
                  defaultValue={existingData.mostSatisfactory || undefined}
                >
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
                <Select
                  name="leastSatisfactory"
                  defaultValue={existingData.leastSatisfactory || undefined}
                >
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
            <CardTitle>Overall Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              <RatingInput value={overallRating} onChange={setOverallRating} showLabel />
            </div>
            <div className="space-y-2">
              <Label>Recommendation</Label>
              <Select name="recommendAction" defaultValue={existingData.recommendAction}>
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
                defaultValue={existingData.narrative}
                placeholder="Overall observations, strengths, areas for improvement..."
                rows={4}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="nrtFlag"
                  checked={nrtFlag}
                  onCheckedChange={(v) => setNrtFlag(!!v)}
                />
                <Label htmlFor="nrtFlag" className="text-sm">
                  <Badge className="bg-red-100 text-red-800">NRT</Badge> Not Responding to
                  Training
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remFlag"
                  checked={remFlag}
                  onCheckedChange={(v) => setRemFlag(!!v)}
                />
                <Label htmlFor="remFlag" className="text-sm">
                  <Badge className="bg-orange-100 text-orange-800">REM</Badge> Remedial Training
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" asChild>
            <Link href="/fieldtraining/dors">Cancel</Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting}
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest("form");
              if (form) handleSaveDraft(form);
            }}
          >
            {submitting ? "Saving..." : "Save Draft"}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit DOR"}
          </Button>
        </div>
      </form>
    </div>
  );
}
