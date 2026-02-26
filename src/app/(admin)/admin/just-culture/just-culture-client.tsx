"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  X,
  Shield,
  Heart,
  MessageCircle,
  Settings,
  Clock,
  FileText,
  HelpCircle,
  RotateCcw,
  Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALGORITHM_STEPS,
  JUST_CULTURE_PRINCIPLES,
  type AlgorithmStep,
  type AlgorithmResult,
} from "@/lib/just-culture-content";
import { createJca, updateJca, deleteJca } from "@/actions/just-culture";
import type { JcaSummary, CampaignOption } from "./page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RECOMMENDATION_STYLES: Record<string, string> = {
  system_fix: "bg-blue-100 text-blue-700",
  console: "bg-green-100 text-green-700",
  coach: "bg-amber-100 text-amber-700",
  discipline: "bg-red-100 text-red-700",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  system_fix: "System Fix",
  console: "Console",
  coach: "Coach",
  discipline: "Discipline",
};

const BEHAVIOR_LABELS: Record<string, string> = {
  system_issue: "System Issue",
  human_error: "Human Error",
  at_risk: "At-Risk Behavior",
  reckless: "Reckless Behavior",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

const RESULT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Settings,
  Heart,
  MessageCircle,
  AlertTriangle,
  ShieldAlert: Shield,
  AlertOctagon: AlertTriangle,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepResponse {
  stepId: string;
  question: string;
  answer: string;
  answerLabel: string;
}

interface JcaFormState {
  title: string;
  description: string;
  status: string;
  incidentDate: string;
  involvedPerson: string;
  involvedRole: string;
  supervisorNotes: string;
  campaignId: string;
  responses: StepResponse[];
  behaviorType: string;
  recommendation: string;
}

function emptyForm(): JcaFormState {
  return {
    title: "",
    description: "",
    status: "draft",
    incidentDate: "",
    involvedPerson: "",
    involvedRole: "",
    supervisorNotes: "",
    campaignId: "",
    responses: [],
    behaviorType: "",
    recommendation: "",
  };
}

function jcaToForm(jca: JcaSummary): JcaFormState {
  const responses: StepResponse[] = [];

  return {
    title: jca.title,
    description: jca.description ?? "",
    status: jca.status,
    incidentDate: jca.incidentDate ?? "",
    involvedPerson: jca.involvedPerson ?? "",
    involvedRole: jca.involvedRole ?? "",
    supervisorNotes: "",
    campaignId: jca.campaignId ?? "",
    responses,
    behaviorType: jca.behaviorType ?? "",
    recommendation: jca.recommendation ?? "",
  };
}

function formToData(form: JcaFormState): Record<string, unknown> {
  return {
    title: form.title,
    description: form.description || null,
    status: form.status,
    incidentDate: form.incidentDate || null,
    involvedPerson: form.involvedPerson || null,
    involvedRole: form.involvedRole || null,
    supervisorNotes: form.supervisorNotes || null,
    campaignId: form.campaignId || null,
    responses: form.responses.length > 0 ? JSON.stringify(form.responses) : null,
    behaviorType: form.behaviorType || null,
    recommendation: form.recommendation || null,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface JustCulturePageClientProps {
  assessments: JcaSummary[];
  campaigns: CampaignOption[];
}

export function JustCulturePageClient({ assessments, campaigns }: JustCulturePageClientProps) {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<JcaFormState>(emptyForm());
  const [currentStepId, setCurrentStepId] = useState<string>("setup");
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleNew = () => {
    setForm(emptyForm());
    setCurrentStepId("setup");
    setResult(null);
    setEditingId(null);
    setError(null);
    setView("new");
  };

  const handleEdit = (jca: JcaSummary) => {
    setForm(jcaToForm(jca));
    setEditingId(jca.id);
    setCurrentStepId("setup");
    setResult(null);
    setError(null);
    setView("edit");
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setError(null);

    const saveData = {
      ...formToData(form),
      status: result ? "completed" : form.responses.length > 0 ? "in_progress" : "draft",
    };

    startTransition(async () => {
      const res = editingId ? await updateJca(editingId, saveData) : await createJca(saveData);
      if (!res.success) {
        setError(res.error ?? "Save failed");
      } else {
        setView("list");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const res = await deleteJca(id);
      if (!res.success) {
        setError(res.error ?? "Delete failed");
      }
      setDeleteConfirm(null);
    });
  };

  const handleAnswer = (step: AlgorithmStep, optionValue: string) => {
    const option = step.options.find((o) => o.value === optionValue);
    if (!option) return;

    const newResponse: StepResponse = {
      stepId: step.id,
      question: step.question,
      answer: optionValue,
      answerLabel: option.label,
    };

    // Replace existing response for this step or add new
    const updatedResponses = [...form.responses.filter((r) => r.stepId !== step.id), newResponse];

    const updatedForm = { ...form, responses: updatedResponses };

    if (option.result) {
      // Terminal result
      updatedForm.behaviorType = option.result.behaviorType;
      updatedForm.recommendation = option.result.recommendation;
      setResult(option.result);
    } else if (option.nextStepId) {
      setCurrentStepId(option.nextStepId);
    }

    setForm(updatedForm);
  };

  const handleRestart = () => {
    setForm((prev) => ({
      ...prev,
      responses: [],
      behaviorType: "",
      recommendation: "",
    }));
    setCurrentStepId("setup");
    setResult(null);
  };

  const updateField = <K extends keyof JcaFormState>(key: K, value: JcaFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Filtered assessments
  const filtered = assessments.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.involvedPerson ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Render: List view
  // ---------------------------------------------------------------------------

  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Just Culture Algorithm</h1>
            <p className="text-muted-foreground mt-1">
              Evaluate behavior fairly and consistently using the Just Culture framework
            </p>
          </div>
          <Button onClick={handleNew} className="bg-nmh-teal hover:bg-nmh-teal/90">
            <Plus className="h-4 w-4 mr-2" />
            New Assessment
          </Button>
        </div>

        {/* Principles overview */}
        <Card className="border-nmh-teal/30 bg-nmh-teal/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Scale className="h-5 w-5 text-nmh-teal shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-nmh-teal">What is Just Culture?</p>
                <p className="text-muted-foreground mt-1">
                  Just Culture provides a fair, consistent framework for evaluating individual
                  behavior in the context of adverse events. It distinguishes between human error
                  (console), at-risk behavior (coach), and reckless behavior (discipline) — ensuring
                  proportional, system-aware responses.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assessments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Assessment list */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Scale className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {search ? "No assessments match your search" : "No assessments yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start a new assessment to evaluate behavior using the Just Culture framework.
              </p>
              {!search && (
                <Button onClick={handleNew} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Start Assessment
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((jca) => (
              <Card
                key={jca.id}
                className="hover:border-nmh-teal/40 cursor-pointer transition-colors"
                onClick={() => handleEdit(jca)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium truncate">{jca.title}</h3>
                          <Badge className={STATUS_STYLES[jca.status] ?? ""}>
                            {jca.status === "in_progress"
                              ? "In Progress"
                              : jca.status.charAt(0).toUpperCase() + jca.status.slice(1)}
                          </Badge>
                          {jca.recommendation && (
                            <Badge className={RECOMMENDATION_STYLES[jca.recommendation] ?? ""}>
                              {RECOMMENDATION_LABELS[jca.recommendation] ?? jca.recommendation}
                            </Badge>
                          )}
                          {jca.behaviorType && (
                            <Badge variant="outline" className="text-xs">
                              {BEHAVIOR_LABELS[jca.behaviorType] ?? jca.behaviorType}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          {jca.involvedPerson && (
                            <span>
                              {jca.involvedPerson}
                              {jca.involvedRole ? ` (${jca.involvedRole})` : ""}
                            </span>
                          )}
                          {jca.incidentDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {jca.incidentDate}
                            </span>
                          )}
                          {jca.campaignName && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {jca.campaignName}
                            </span>
                          )}
                          {jca.createdByName && <span>By {jca.createdByName}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(jca.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Assessment</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this assessment? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Algorithm wizard view
  // ---------------------------------------------------------------------------

  const currentStep = ALGORITHM_STEPS.find((s) => s.id === currentStepId);
  const isSetup = currentStepId === "setup";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {editingId ? "Edit Assessment" : "New Assessment"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {result
                ? "Assessment Complete"
                : isSetup
                  ? "Step 1: Describe the event"
                  : `Step ${currentStep?.stepNumber ?? 0 + 1}: ${currentStep?.title ?? ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(form.responses.length > 0 || result) && (
            <Button variant="outline" onClick={handleRestart}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Start Over
            </Button>
          )}
          <Button variant="outline" onClick={() => setView("list")}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-nmh-teal hover:bg-nmh-teal/90"
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        <ProgressStep
          label="Setup"
          isActive={isSetup}
          isCompleted={!isSetup}
          onClick={() => {
            setCurrentStepId("setup");
            setResult(null);
          }}
        />
        {ALGORITHM_STEPS.map((s) => {
          const response = form.responses.find((r) => r.stepId === s.id);
          const isActive = currentStepId === s.id;
          const isCompleted = !!response;
          return (
            <ProgressStep
              key={s.id}
              label={s.title}
              isActive={isActive}
              isCompleted={isCompleted}
              onClick={() => {
                if (isCompleted || isActive) {
                  setCurrentStepId(s.id);
                  setResult(null);
                }
              }}
              disabled={!isCompleted && !isActive}
            />
          );
        })}
        {result && <ProgressStep label="Result" isActive={true} isCompleted={true} />}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {result ? (
            <ResultCard result={result} responses={form.responses} />
          ) : isSetup ? (
            <SetupForm
              form={form}
              updateField={updateField}
              campaigns={campaigns}
              onContinue={() => setCurrentStepId("step_1")}
            />
          ) : currentStep ? (
            <AlgorithmStepCard
              step={currentStep}
              existingResponse={form.responses.find((r) => r.stepId === currentStep.id)}
              onAnswer={(value) => handleAnswer(currentStep, value)}
            />
          ) : null}

          {/* Response trail */}
          {form.responses.length > 0 && !result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Decision Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {form.responses.map((r, i) => {
                    const step = ALGORITHM_STEPS.find((s) => s.id === r.stepId);
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-nmh-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-nmh-teal" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{step?.title ?? r.stepId}</p>
                          <p className="text-sm">{r.answerLabel}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coaching sidebar */}
        <div>
          <JustCultureCoachingPanel currentStepId={currentStepId} result={result} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress step
// ---------------------------------------------------------------------------

function ProgressStep({
  label,
  isActive,
  isCompleted,
  onClick,
  disabled,
}: {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
        isActive
          ? "bg-nmh-teal text-white"
          : isCompleted
            ? "bg-nmh-teal/10 text-nmh-teal cursor-pointer"
            : "bg-muted text-muted-foreground"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {isCompleted && !isActive ? <CheckCircle2 className="h-3 w-3" /> : null}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Setup form
// ---------------------------------------------------------------------------

function SetupForm({
  form,
  updateField,
  campaigns,
  onContinue,
}: {
  form: JcaFormState;
  updateField: <K extends keyof JcaFormState>(key: K, value: JcaFormState[K]) => void;
  campaigns: CampaignOption[];
  onContinue: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Assessment Setup</CardTitle>
        <p className="text-sm text-muted-foreground">
          Describe the event and provide context before beginning the algorithm.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title">Assessment Title *</Label>
          <Input
            id="title"
            placeholder="Brief title for this assessment"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="description">Event Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the event objectively. Focus on what happened, not who is at fault..."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={4}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="incidentDate">Incident Date</Label>
            <Input
              id="incidentDate"
              type="date"
              value={form.incidentDate}
              onChange={(e) => updateField("incidentDate", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="campaign">Link to Campaign (optional)</Label>
            <Select
              value={form.campaignId || "none"}
              onValueChange={(v) => updateField("campaignId", v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No campaign</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="involvedPerson">Individual Being Evaluated</Label>
            <Input
              id="involvedPerson"
              placeholder="Name (optional)"
              value={form.involvedPerson}
              onChange={(e) => updateField("involvedPerson", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="involvedRole">Role</Label>
            <Input
              id="involvedRole"
              placeholder="e.g., Paramedic, EMT, Dispatcher"
              value={form.involvedRole}
              onChange={(e) => updateField("involvedRole", e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Supervisor Notes</Label>
          <Textarea
            id="notes"
            placeholder="Private notes about this assessment..."
            value={form.supervisorNotes}
            onChange={(e) => updateField("supervisorNotes", e.target.value)}
            rows={3}
          />
        </div>

        <div className="pt-4 border-t flex justify-end">
          <Button
            onClick={onContinue}
            disabled={!form.title.trim()}
            className="bg-nmh-teal hover:bg-nmh-teal/90"
          >
            Begin Algorithm
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Algorithm step card
// ---------------------------------------------------------------------------

function AlgorithmStepCard({
  step,
  existingResponse,
  onAnswer,
}: {
  step: AlgorithmStep;
  existingResponse?: StepResponse;
  onAnswer: (value: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Badge className="bg-nmh-teal text-white">Step {step.stepNumber}</Badge>
          <CardTitle className="text-lg">{step.title}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-2">{step.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* The question */}
        <div className="bg-muted/50 rounded-lg p-4">
          <p className="font-medium text-base">{step.question}</p>
        </div>

        {/* Guidance */}
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            Guidance
          </p>
          <ul className="space-y-1">
            {step.guidance.map((g, i) => (
              <li key={i} className="text-xs text-amber-700 flex gap-2">
                <span className="shrink-0">&#8226;</span>
                {g}
              </li>
            ))}
          </ul>
        </div>

        {/* Educational note */}
        {step.educationalNote && (
          <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-800 mb-1 flex items-center gap-1">
              <Lightbulb className="h-3.5 w-3.5" />
              Key Concept
            </p>
            <p className="text-xs text-blue-700">{step.educationalNote}</p>
          </div>
        )}

        {/* Answer options */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Select your answer:</p>
          {step.options.map((option) => (
            <button
              key={option.value}
              onClick={() => onAnswer(option.value)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                existingResponse?.answer === option.value
                  ? "border-nmh-teal bg-nmh-teal/5"
                  : "border-border hover:border-nmh-teal/40"
              }`}
            >
              <p className="text-sm font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({ result, responses }: { result: AlgorithmResult; responses: StepResponse[] }) {
  const IconComp = RESULT_ICONS[result.icon] ?? Shield;

  return (
    <div className="space-y-6">
      {/* Main result */}
      <Card className={`border-2 ${result.color}`}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center">
              <IconComp className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{result.label}</CardTitle>
              <Badge className="mt-1">
                {BEHAVIOR_LABELS[result.behaviorType] ?? result.behaviorType}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed">{result.description}</p>

          <div>
            <p className="text-sm font-medium mb-2">Recommended Actions:</p>
            <ul className="space-y-2">
              {result.actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-current opacity-60" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Decision trail summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Decision Trail</CardTitle>
          <p className="text-xs text-muted-foreground">
            The path through the algorithm that led to this recommendation
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {responses.map((r, i) => {
              const step = ALGORITHM_STEPS.find((s) => s.id === r.stepId);
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-nmh-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-nmh-teal">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {step?.title ?? r.stepId}
                    </p>
                    <p className="text-sm">{r.answerLabel}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-nmh-teal flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Result</p>
                <p className="text-sm font-medium">{result.label}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coaching sidebar
// ---------------------------------------------------------------------------

function JustCultureCoachingPanel({
  currentStepId,
  result,
}: {
  currentStepId: string;
  result: AlgorithmResult | null;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-4 sticky top-4">
      <Card className="border-nmh-teal/30 bg-nmh-teal/5">
        <CardHeader
          className="cursor-pointer select-none pb-2"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-nmh-teal shrink-0" />
            <CardTitle className="text-sm font-semibold text-nmh-teal flex-1">
              Just Culture Guide
            </CardTitle>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-4 pt-0 text-sm">
            {/* Key principles */}
            <div>
              <p className="text-xs font-medium text-foreground/80 mb-2">Key Principles</p>
              <div className="space-y-2">
                {JUST_CULTURE_PRINCIPLES.map((p, i) => (
                  <details key={i} className="text-xs">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                      {p.title}
                    </summary>
                    <p className="mt-1 text-muted-foreground pl-4">{p.description}</p>
                  </details>
                ))}
              </div>
            </div>

            {/* Behavior types reference */}
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-foreground/80 mb-2">Behavior Types</p>
              <div className="space-y-2">
                <div className="bg-green-50/50 rounded p-2">
                  <p className="text-xs font-medium text-green-800">Human Error → Console</p>
                  <p className="text-xs text-green-700">
                    Inadvertent action — the person intended to do the right thing
                  </p>
                </div>
                <div className="bg-amber-50/50 rounded p-2">
                  <p className="text-xs font-medium text-amber-800">At-Risk Behavior → Coach</p>
                  <p className="text-xs text-amber-700">
                    Conscious choice where the risk was not appreciated or believed justified
                  </p>
                </div>
                <div className="bg-red-50/50 rounded p-2">
                  <p className="text-xs font-medium text-red-800">Reckless Behavior → Discipline</p>
                  <p className="text-xs text-red-700">
                    Conscious disregard of a substantial and unjustifiable risk
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Algorithm flow diagram */}
      {!result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">Algorithm Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-xs">
              {ALGORITHM_STEPS.map((s) => {
                const isActive = currentStepId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded ${
                      isActive
                        ? "bg-nmh-teal/10 text-nmh-teal font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span className="w-4 text-center">{s.stepNumber}</span>
                    <span>{s.title}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
