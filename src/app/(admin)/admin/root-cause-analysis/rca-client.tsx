"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Plus,
  Trash2,
  Search,
  GitBranchPlus,
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Clock,
  Users,
  ClipboardList,
  Wrench,
  Cloud,
  Building2,
  Package,
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
  FISHBONE_CATEGORIES,
  FIVE_WHYS_GUIDANCE,
  RCA_METHODS,
  SEVERITY_LEVELS,
  RCA_COACHING,
  type FishboneCategory,
} from "@/lib/rca-content";
import { createRca, updateRca, deleteRca } from "@/actions/root-cause-analysis";
import type { RcaSummary, CampaignOption } from "./page";

// ---------------------------------------------------------------------------
// Icon mapper for fishbone categories
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  Users,
  ClipboardList,
  Wrench,
  Cloud,
  Building2,
  Package,
};

const CATEGORY_COLOR_CLASSES: Record<string, string> = {
  "#3b82f6": "text-blue-500",
  "#8b5cf6": "text-violet-500",
  "#f59e0b": "text-amber-500",
  "#10b981": "text-emerald-500",
  "#ef4444": "text-red-500",
  "#ec4899": "text-pink-500",
};

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  archived: "bg-slate-100 text-slate-600",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  archived: "Archived",
};

const METHOD_LABELS: Record<string, string> = {
  fishbone: "Fishbone",
  five_whys: "5 Whys",
  combined: "Combined",
};

// ---------------------------------------------------------------------------
// Types for internal state
// ---------------------------------------------------------------------------

interface WhyEntry {
  question: string;
  answer: string;
}

interface ActionPlanEntry {
  action: string;
  owner: string;
  dueDate: string;
  status: string;
}

interface RcaFormState {
  title: string;
  description: string;
  method: string;
  status: string;
  severity: string;
  incidentDate: string;
  campaignId: string;
  // Fishbone
  people: string[];
  process: string[];
  equipment: string[];
  environment: string[];
  management: string[];
  materials: string[];
  // 5 Whys
  whyChain: WhyEntry[];
  // Results
  rootCauses: string[];
  contributingFactors: string[];
  correctiveActions: ActionPlanEntry[];
  preventiveActions: ActionPlanEntry[];
  summary: string;
  recommendations: string;
  lessonsLearned: string;
}

function emptyForm(): RcaFormState {
  return {
    title: "",
    description: "",
    method: "fishbone",
    status: "draft",
    severity: "",
    incidentDate: "",
    campaignId: "",
    people: [],
    process: [],
    equipment: [],
    environment: [],
    management: [],
    materials: [],
    whyChain: [{ question: "Why did this happen?", answer: "" }],
    rootCauses: [],
    contributingFactors: [],
    correctiveActions: [],
    preventiveActions: [],
    summary: "",
    recommendations: "",
    lessonsLearned: "",
  };
}

function rcaToForm(rca: RcaSummary, fullData?: Record<string, unknown>): RcaFormState {
  const parse = (val: unknown): string[] => {
    if (!val) return [];
    try {
      return JSON.parse(val as string);
    } catch {
      return [];
    }
  };
  const parseWhys = (val: unknown): WhyEntry[] => {
    if (!val) return [{ question: "Why did this happen?", answer: "" }];
    try {
      const arr = JSON.parse(val as string);
      return arr.length > 0 ? arr : [{ question: "Why did this happen?", answer: "" }];
    } catch {
      return [{ question: "Why did this happen?", answer: "" }];
    }
  };
  const parseActions = (val: unknown): ActionPlanEntry[] => {
    if (!val) return [];
    try {
      return JSON.parse(val as string);
    } catch {
      return [];
    }
  };

  return {
    title: rca.title,
    description: rca.description ?? "",
    method: rca.method,
    status: rca.status,
    severity: rca.severity ?? "",
    incidentDate: rca.incidentDate ?? "",
    campaignId: rca.campaignId ?? "",
    people: parse(fullData?.people),
    process: parse(fullData?.process),
    equipment: parse(fullData?.equipment),
    environment: parse(fullData?.environment),
    management: parse(fullData?.management),
    materials: parse(fullData?.materials),
    whyChain: parseWhys(fullData?.whyChain),
    rootCauses: parse(fullData?.rootCauses),
    contributingFactors: parse(fullData?.contributingFactors),
    correctiveActions: parseActions(fullData?.correctiveActions),
    preventiveActions: parseActions(fullData?.preventiveActions),
    summary: (fullData?.summary as string) ?? "",
    recommendations: (fullData?.recommendations as string) ?? "",
    lessonsLearned: (fullData?.lessonsLearned as string) ?? "",
  };
}

function formToData(form: RcaFormState): Record<string, unknown> {
  return {
    title: form.title,
    description: form.description || null,
    method: form.method,
    status: form.status,
    severity: form.severity || null,
    incidentDate: form.incidentDate || null,
    campaignId: form.campaignId || null,
    people: form.people.length > 0 ? JSON.stringify(form.people) : null,
    process: form.process.length > 0 ? JSON.stringify(form.process) : null,
    equipment: form.equipment.length > 0 ? JSON.stringify(form.equipment) : null,
    environment: form.environment.length > 0 ? JSON.stringify(form.environment) : null,
    management: form.management.length > 0 ? JSON.stringify(form.management) : null,
    materials: form.materials.length > 0 ? JSON.stringify(form.materials) : null,
    whyChain: form.whyChain.some((w) => w.answer)
      ? JSON.stringify(form.whyChain.filter((w) => w.answer))
      : null,
    rootCauses: form.rootCauses.length > 0 ? JSON.stringify(form.rootCauses) : null,
    contributingFactors:
      form.contributingFactors.length > 0 ? JSON.stringify(form.contributingFactors) : null,
    correctiveActions:
      form.correctiveActions.length > 0 ? JSON.stringify(form.correctiveActions) : null,
    preventiveActions:
      form.preventiveActions.length > 0 ? JSON.stringify(form.preventiveActions) : null,
    summary: form.summary || null,
    recommendations: form.recommendations || null,
    lessonsLearned: form.lessonsLearned || null,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RcaPageClientProps {
  rcas: RcaSummary[];
  campaigns: CampaignOption[];
}

export function RcaPageClient({ rcas, campaigns }: RcaPageClientProps) {
  const [view, setView] = useState<"list" | "new" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RcaFormState>(emptyForm());
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Wizard steps based on method
  const getSteps = useCallback(() => {
    if (form.method === "fishbone") {
      return [
        "Setup",
        "People",
        "Process",
        "Equipment",
        "Environment",
        "Management",
        "Materials",
        "Root Causes",
        "Action Plan",
        "Summary",
      ];
    }
    if (form.method === "five_whys") {
      return ["Setup", "5 Whys", "Root Causes", "Action Plan", "Summary"];
    }
    // combined
    return [
      "Setup",
      "People",
      "Process",
      "Equipment",
      "Environment",
      "Management",
      "Materials",
      "Deep Dive (5 Whys)",
      "Root Causes",
      "Action Plan",
      "Summary",
    ];
  }, [form.method]);

  const steps = getSteps();

  const handleNew = () => {
    setForm(emptyForm());
    setStep(0);
    setEditingId(null);
    setError(null);
    setView("new");
  };

  const handleEdit = (rca: RcaSummary) => {
    // We don't have the full data (JSON fields) from the list view, so initialize from what we have
    setForm(rcaToForm(rca));
    setEditingId(rca.id);
    setStep(0);
    setError(null);
    setView("edit");
  };

  const handleSave = () => {
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const data = formToData(form);
      const result = editingId ? await updateRca(editingId, data) : await createRca(data);
      if (!result.success) {
        setError(result.error ?? "Save failed");
      } else {
        setView("list");
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteRca(id);
      if (!result.success) {
        setError(result.error ?? "Delete failed");
      }
      setDeleteConfirm(null);
    });
  };

  const updateField = <K extends keyof RcaFormState>(key: K, value: RcaFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Filtered RCAs
  const filtered = rcas.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // ---------------------------------------------------------------------------
  // Render: List view
  // ---------------------------------------------------------------------------

  if (view === "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Root Cause Analysis</h1>
            <p className="text-muted-foreground mt-1">
              Investigate adverse events and identify systemic improvements
            </p>
          </div>
          <Button onClick={handleNew} className="bg-nmh-teal hover:bg-nmh-teal/90">
            <Plus className="h-4 w-4 mr-2" />
            New Investigation
          </Button>
        </div>

        {/* Coaching overview card */}
        <Card className="border-nmh-teal/30 bg-nmh-teal/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-nmh-teal shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-nmh-teal">What is Root Cause Analysis?</p>
                <p className="text-muted-foreground">{RCA_COACHING.general.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search investigations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Investigation list */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GitBranchPlus className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                {search ? "No investigations match your search" : "No investigations yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start your first root cause analysis to identify systemic improvements.
              </p>
              {!search && (
                <Button onClick={handleNew} variant="outline" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Start Investigation
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((rca) => (
              <Card
                key={rca.id}
                className="hover:border-nmh-teal/40 cursor-pointer transition-colors"
                onClick={() => handleEdit(rca)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{rca.title}</h3>
                          <Badge className={STATUS_STYLES[rca.status] ?? ""}>
                            {STATUS_LABELS[rca.status] ?? rca.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {METHOD_LABELS[rca.method] ?? rca.method}
                          </Badge>
                          {rca.severity && (
                            <Badge
                              className={
                                SEVERITY_LEVELS.find((s) => s.value === rca.severity)?.color ?? ""
                              }
                            >
                              {rca.severity}
                            </Badge>
                          )}
                        </div>
                        {rca.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {rca.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                          {rca.incidentDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Incident: {rca.incidentDate}
                            </span>
                          )}
                          {rca.campaignName && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {rca.campaignName}
                            </span>
                          )}
                          {rca.createdByName && <span>By {rca.createdByName}</span>}
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
                          setDeleteConfirm(rca.id);
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

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Investigation</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this investigation? This action cannot be undone.
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
  // Render: Wizard view (new/edit)
  // ---------------------------------------------------------------------------

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
              {editingId ? "Edit Investigation" : "New Investigation"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Step {step + 1} of {steps.length}: {steps[step]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Progress stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              i === step
                ? "bg-nmh-teal text-white"
                : i < step
                  ? "bg-nmh-teal/10 text-nmh-teal"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {i < step ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <span className="w-4 text-center">{i + 1}</span>
            )}
            {label}
          </button>
        ))}
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

      {/* Step content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RcaStepContent
            step={step}
            steps={steps}
            form={form}
            updateField={updateField}
            campaigns={campaigns}
          />
        </div>
        <div>
          <RcaCoachingPanel step={step} steps={steps} method={form.method} />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)} className="bg-nmh-teal hover:bg-nmh-teal/90">
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-nmh-teal hover:bg-nmh-teal/90"
          >
            {isPending ? "Saving..." : "Save Investigation"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step content renderer
// ---------------------------------------------------------------------------

function RcaStepContent({
  step,
  steps,
  form,
  updateField,
  campaigns,
}: {
  step: number;
  steps: string[];
  form: RcaFormState;
  updateField: <K extends keyof RcaFormState>(key: K, value: RcaFormState[K]) => void;
  campaigns: CampaignOption[];
}) {
  const stepName = steps[step];

  // Setup step
  if (stepName === "Setup") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Investigation Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of the event being investigated"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="description">Event Description</Label>
            <Textarea
              id="description"
              placeholder="What happened? Describe the event objectively..."
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
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={form.severity || "placeholder"}
                onValueChange={(v) => updateField("severity", v === "placeholder" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="placeholder" disabled>
                    Select severity
                  </SelectItem>
                  {SEVERITY_LEVELS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} — {s.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Analysis Method</Label>
            <div className="grid sm:grid-cols-3 gap-3 mt-2">
              {RCA_METHODS.map((m) => {
                const MethodIcon =
                  m.icon === "GitBranchPlus"
                    ? GitBranchPlus
                    : m.icon === "HelpCircle"
                      ? HelpCircle
                      : Layers;
                return (
                  <button
                    key={m.id}
                    onClick={() => updateField("method", m.id)}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      form.method === m.id
                        ? "border-nmh-teal bg-nmh-teal/5"
                        : "border-border hover:border-nmh-teal/40"
                    }`}
                  >
                    <MethodIcon className="h-5 w-5 text-nmh-teal mb-2" />
                    <p className="font-medium text-sm">{m.shortName}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {m.bestFor.substring(0, 80)}...
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
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
        </CardContent>
      </Card>
    );
  }

  // Fishbone category steps
  const categoryMap: Record<string, keyof RcaFormState> = {
    People: "people",
    Process: "process",
    Equipment: "equipment",
    Environment: "environment",
    Management: "management",
    Materials: "materials",
  };
  if (stepName in categoryMap) {
    const fieldKey = categoryMap[stepName] as keyof Pick<
      RcaFormState,
      "people" | "process" | "equipment" | "environment" | "management" | "materials"
    >;
    const category = FISHBONE_CATEGORIES.find((c) => c.id === fieldKey) as FishboneCategory;
    const items = form[fieldKey] as string[];
    const IconComp = CATEGORY_ICONS[category.icon] ?? Users;

    return (
      <FishboneCategoryEditor
        category={category}
        icon={
          <IconComp
            className={`h-5 w-5 ${CATEGORY_COLOR_CLASSES[category.color] ?? "text-nmh-teal"}`}
          />
        }
        items={items}
        onChange={(newItems) => updateField(fieldKey, newItems)}
      />
    );
  }

  // 5 Whys step
  if (stepName === "5 Whys" || stepName === "Deep Dive (5 Whys)") {
    return (
      <FiveWhysEditor
        whyChain={form.whyChain}
        onChange={(chain) => updateField("whyChain", chain)}
        problemStatement={form.title}
      />
    );
  }

  // Root Causes step
  if (stepName === "Root Causes") {
    return (
      <RootCausesEditor
        rootCauses={form.rootCauses}
        contributingFactors={form.contributingFactors}
        onRootCausesChange={(v) => updateField("rootCauses", v)}
        onContributingChange={(v) => updateField("contributingFactors", v)}
      />
    );
  }

  // Action Plan step
  if (stepName === "Action Plan") {
    return (
      <ActionPlanEditor
        correctiveActions={form.correctiveActions}
        preventiveActions={form.preventiveActions}
        onCorrectiveChange={(v) => updateField("correctiveActions", v)}
        onPreventiveChange={(v) => updateField("preventiveActions", v)}
      />
    );
  }

  // Summary step
  if (stepName === "Summary") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary & Lessons Learned</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="summary">Investigation Summary</Label>
            <Textarea
              id="summary"
              placeholder="Summarize the findings of this investigation..."
              value={form.summary}
              onChange={(e) => updateField("summary", e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="recommendations">Recommendations</Label>
            <Textarea
              id="recommendations"
              placeholder="What do you recommend based on this analysis?"
              value={form.recommendations}
              onChange={(e) => updateField("recommendations", e.target.value)}
              rows={4}
            />
          </div>
          <div>
            <Label htmlFor="lessons">Lessons Learned</Label>
            <Textarea
              id="lessons"
              placeholder="What lessons can be shared with the organization?"
              value={form.lessonsLearned}
              onChange={(e) => updateField("lessonsLearned", e.target.value)}
              rows={4}
            />
          </div>

          {/* Quick summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
            <SummaryStat
              label="Fishbone Factors"
              value={
                form.people.length +
                form.process.length +
                form.equipment.length +
                form.environment.length +
                form.management.length +
                form.materials.length
              }
            />
            <SummaryStat
              label="Why Chain Depth"
              value={form.whyChain.filter((w) => w.answer).length}
            />
            <SummaryStat label="Root Causes" value={form.rootCauses.length} />
            <SummaryStat
              label="Actions Planned"
              value={form.correctiveActions.length + form.preventiveActions.length}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-2xl font-bold text-nmh-teal">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fishbone category editor
// ---------------------------------------------------------------------------

function FishboneCategoryEditor({
  category,
  icon,
  items,
  onChange,
}: {
  category: FishboneCategory;
  icon: React.ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <CardTitle className="text-lg">{category.label}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{category.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prompt questions */}
        <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            Consider these questions:
          </p>
          <ul className="space-y-1">
            {category.promptQuestions.map((q, i) => (
              <li key={i} className="text-xs text-amber-700 flex gap-2">
                <span className="shrink-0">&#8226;</span>
                {q}
              </li>
            ))}
          </ul>
        </div>

        {/* Add new factor */}
        <div className="flex gap-2">
          <Input
            placeholder="Add a contributing factor..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button onClick={addItem} variant="outline" disabled={!newItem.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Items list */}
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <span className="text-sm flex-1">{item}</span>
                <button
                  onClick={() => removeItem(i)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No contributing factors identified in this category yet.
          </p>
        )}

        {/* Examples */}
        {category.examples.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show examples
            </summary>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {category.examples.map((ex, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-nmh-teal shrink-0">&#8226;</span>
                  {ex}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 5 Whys editor
// ---------------------------------------------------------------------------

function FiveWhysEditor({
  whyChain,
  onChange,
  problemStatement,
}: {
  whyChain: WhyEntry[];
  onChange: (chain: WhyEntry[]) => void;
  problemStatement: string;
}) {
  const guidance = FIVE_WHYS_GUIDANCE;

  const updateEntry = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...whyChain];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const addWhy = () => {
    const level = whyChain.length;
    const g = guidance[level] ?? guidance[guidance.length - 1];
    onChange([...whyChain, { question: g.prompt, answer: "" }]);
  };

  const removeLastWhy = () => {
    if (whyChain.length > 1) {
      onChange(whyChain.slice(0, -1));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">5 Whys Analysis</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ask &quot;Why?&quot; repeatedly to drill from symptoms to root causes. Stop when you reach
          something your organization can change.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Problem statement */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground">Problem Statement</p>
          <p className="text-sm font-medium mt-1">
            {problemStatement || "Define your problem in the Setup step"}
          </p>
        </div>

        {/* Why chain */}
        <div className="space-y-4">
          {whyChain.map((entry, i) => {
            const g = guidance[i] ?? guidance[guidance.length - 1];
            return (
              <div key={i} className="relative">
                {/* Connecting line */}
                {i > 0 && <div className="absolute -top-4 left-6 w-0.5 h-4 bg-nmh-teal/30" />}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-nmh-teal text-white">Why {i + 1}</Badge>
                    <span className="text-xs text-muted-foreground">{g.tip}</span>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Question</Label>
                    <Input
                      value={entry.question}
                      onChange={(e) => updateEntry(i, "question", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Answer</Label>
                    <Textarea
                      placeholder="What is the answer to this 'Why?'..."
                      value={entry.answer}
                      onChange={(e) => updateEntry(i, "answer", e.target.value)}
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                  <p className="text-xs text-amber-700 italic flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    {g.checkQuestion}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add/remove controls */}
        <div className="flex gap-2">
          <Button onClick={addWhy} variant="outline" className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Add Another &quot;Why?&quot;
          </Button>
          {whyChain.length > 1 && (
            <Button onClick={removeLastWhy} variant="outline">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {whyChain.filter((w) => w.answer).length >= 3 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <div className="text-xs text-green-700">
              <p className="font-medium">Getting closer to root causes</p>
              <p>
                Ask yourself: if you fixed the last answer, would it significantly reduce the chance
                of this event happening again? If yes, you may have found a root cause.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Root causes editor
// ---------------------------------------------------------------------------

function RootCausesEditor({
  rootCauses,
  contributingFactors,
  onRootCausesChange,
  onContributingChange,
}: {
  rootCauses: string[];
  contributingFactors: string[];
  onRootCausesChange: (v: string[]) => void;
  onContributingChange: (v: string[]) => void;
}) {
  const [newRootCause, setNewRootCause] = useState("");
  const [newFactor, setNewFactor] = useState("");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Root Causes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Based on your analysis, what are the fundamental systemic causes? A root cause is
            something that, if fixed, would prevent or significantly reduce the chance of
            recurrence.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add a root cause..."
              value={newRootCause}
              onChange={(e) => setNewRootCause(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newRootCause.trim()) {
                  onRootCausesChange([...rootCauses, newRootCause.trim()]);
                  setNewRootCause("");
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newRootCause.trim()) {
                  onRootCausesChange([...rootCauses, newRootCause.trim()]);
                  setNewRootCause("");
                }
              }}
              disabled={!newRootCause.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {rootCauses.map((cause, i) => (
            <div key={i} className="flex items-center gap-2 bg-red-50/50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm flex-1">{cause}</span>
              <button
                onClick={() => onRootCausesChange(rootCauses.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contributing Factors</CardTitle>
          <p className="text-sm text-muted-foreground">
            What other factors contributed to the event but may not be root causes on their own?
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add a contributing factor..."
              value={newFactor}
              onChange={(e) => setNewFactor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFactor.trim()) {
                  onContributingChange([...contributingFactors, newFactor.trim()]);
                  setNewFactor("");
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (newFactor.trim()) {
                  onContributingChange([...contributingFactors, newFactor.trim()]);
                  setNewFactor("");
                }
              }}
              disabled={!newFactor.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {contributingFactors.map((factor, i) => (
            <div key={i} className="flex items-center gap-2 bg-amber-50/50 rounded-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-sm flex-1">{factor}</span>
              <button
                onClick={() =>
                  onContributingChange(contributingFactors.filter((_, idx) => idx !== i))
                }
                className="text-muted-foreground hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Action plan editor
// ---------------------------------------------------------------------------

function ActionPlanEditor({
  correctiveActions,
  preventiveActions,
  onCorrectiveChange,
  onPreventiveChange,
}: {
  correctiveActions: ActionPlanEntry[];
  preventiveActions: ActionPlanEntry[];
  onCorrectiveChange: (v: ActionPlanEntry[]) => void;
  onPreventiveChange: (v: ActionPlanEntry[]) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Corrective Actions */}
      <ActionListEditor
        title="Corrective Actions"
        description="What immediate actions will address the root causes?"
        items={correctiveActions}
        onChange={onCorrectiveChange}
        color="red"
      />

      {/* Preventive Actions */}
      <ActionListEditor
        title="Preventive Actions"
        description="What systemic changes will prevent recurrence?"
        items={preventiveActions}
        onChange={onPreventiveChange}
        color="blue"
      />

      {/* Action hierarchy coaching */}
      <Card className="border-nmh-teal/30 bg-nmh-teal/5">
        <CardContent className="pt-4">
          <p className="text-xs font-medium text-nmh-teal mb-3 flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5" />
            Action Effectiveness Hierarchy
          </p>
          <div className="space-y-3">
            {RCA_COACHING.actionHierarchy.map((tier) => (
              <div key={tier.level}>
                <Badge
                  variant="outline"
                  className={`text-xs mb-1 ${
                    tier.level === "Strongest"
                      ? "border-green-300 text-green-700"
                      : tier.level === "Moderate"
                        ? "border-amber-300 text-amber-700"
                        : "border-red-300 text-red-700"
                  }`}
                >
                  {tier.level}
                </Badge>
                <ul className="text-xs text-muted-foreground ml-4 space-y-0.5">
                  {tier.actions.map((a, i) => (
                    <li key={i}>&#8226; {a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionListEditor({
  title,
  description,
  items,
  onChange,
  color,
}: {
  title: string;
  description: string;
  items: ActionPlanEntry[];
  onChange: (items: ActionPlanEntry[]) => void;
  color: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newAction, setNewAction] = useState<ActionPlanEntry>({
    action: "",
    owner: "",
    dueDate: "",
    status: "open",
  });

  const addAction = () => {
    if (newAction.action.trim()) {
      onChange([...items, { ...newAction, action: newAction.action.trim() }]);
      setNewAction({ action: "", owner: "", dueDate: "", status: "open" });
      setShowAdd(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAdd && (
          <div
            className={`border-2 rounded-lg p-3 space-y-3 ${
              color === "red" ? "border-red-200" : "border-blue-200"
            }`}
          >
            <div>
              <Label className="text-xs">Action</Label>
              <Textarea
                placeholder="Describe the action..."
                value={newAction.action}
                onChange={(e) => setNewAction({ ...newAction, action: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Owner</Label>
                <Input
                  placeholder="Responsible person"
                  value={newAction.owner}
                  onChange={(e) => setNewAction({ ...newAction, owner: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={newAction.dueDate}
                  onChange={(e) => setNewAction({ ...newAction, dueDate: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={newAction.status}
                  onValueChange={(v) => setNewAction({ ...newAction, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addAction} size="sm" className="bg-nmh-teal hover:bg-nmh-teal/90">
                Add Action
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-muted/50 rounded-lg p-3">
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    item.status === "completed" ? "text-green-500" : "text-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.action}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {item.owner && <span>Owner: {item.owner}</span>}
                    {item.dueDate && <span>Due: {item.dueDate}</span>}
                    <Badge variant="outline" className="text-xs">
                      {item.status === "in_progress"
                        ? "In Progress"
                        : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-4">
            No actions added yet
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Coaching panel
// ---------------------------------------------------------------------------

function RcaCoachingPanel({
  step,
  steps,
  method,
}: {
  step: number;
  steps: string[];
  method: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const stepName = steps[step];

  const getCoachingContent = () => {
    if (stepName === "Setup") {
      return {
        title: "Getting Started",
        description:
          "Start by defining the event you are investigating. Be specific and objective — describe what happened, not who is to blame.",
        tips: RCA_COACHING.general.tips,
        questions: RCA_COACHING.general.guidingQuestions,
      };
    }

    const categoryMap: Record<string, FishboneCategory | undefined> = {};
    for (const cat of FISHBONE_CATEGORIES) {
      categoryMap[cat.label] = cat;
      if (cat.id === "process") categoryMap["Process"] = cat;
    }
    const category = categoryMap[stepName];
    if (category) {
      return {
        title: category.label,
        description: category.description,
        tips: [
          `Think about all ${category.label.toLowerCase()}-related factors that may have contributed`,
          "Include factors that were present even if you're not sure they contributed",
          "Consider both factors that were present and factors that were absent",
        ],
        questions: category.promptQuestions,
      };
    }

    if (stepName === "5 Whys" || stepName === "Deep Dive (5 Whys)") {
      return {
        title: "5 Whys Technique",
        description:
          "Ask 'Why?' repeatedly to peel back layers of symptoms and reach the root cause. Each answer should be factual and verified.",
        tips: [
          "Keep each answer focused on the system, not on blaming individuals",
          "If a 'Why' has multiple valid answers, explore each branch",
          "Stop when you reach something actionable that your organization can change",
          "The number 5 is a guideline — some chains are shorter or longer",
        ],
        questions: [
          "Is this answer factual, or am I making an assumption?",
          "Am I staying focused on the system, or am I blaming a person?",
          "If I fixed this cause, would it significantly reduce the chance of recurrence?",
          "Is there more than one valid answer to this 'Why?'",
        ],
      };
    }

    if (stepName === "Root Causes") {
      return {
        title: "Identifying Root Causes",
        description:
          "A root cause is the fundamental reason the event occurred. If the root cause were eliminated, the event would be prevented or significantly reduced.",
        tips: [
          "Test each root cause: 'If we fixed this, would the event have been prevented?'",
          "A root cause should be actionable — within your organization's ability to change",
          "Distinguish between root causes and contributing factors",
          "There are often multiple root causes for a single event",
        ],
        questions: [
          "If this root cause were eliminated, would the event still have occurred?",
          "Is this a root cause or a symptom of a deeper issue?",
          "Is this within our organization's ability to fix?",
          "Would fixing this prevent similar events in other contexts?",
        ],
      };
    }

    if (stepName === "Action Plan") {
      return {
        title: "Developing Your Action Plan",
        description:
          "Corrective actions fix the immediate issue. Preventive actions change the system to prevent recurrence. Prioritize stronger actions over weaker ones.",
        tips: [
          "Strongest actions change the system design, not just the person",
          "Avoid relying solely on training or policy — these are the weakest interventions",
          "Each action should have a clear owner, timeline, and success measure",
          "Consider whether your actions could create new risks",
        ],
        questions: [
          "Does this action address a root cause or just a symptom?",
          "Is this the strongest type of action available, or just the easiest?",
          "Could this action create unintended consequences?",
          "How will you know if this action is effective?",
        ],
      };
    }

    return {
      title: "Summary",
      description:
        "Review your investigation and document lessons learned. These findings can be shared across the organization to prevent similar events.",
      tips: [
        "Summarize for an audience that may not have been involved in the investigation",
        "Focus on system improvements, not individual performance",
        "Share lessons learned widely — others can benefit from your analysis",
      ],
      questions: [
        "Does your summary accurately reflect the findings?",
        "Are your recommendations actionable and specific?",
        "What lessons can be applied to other areas of the organization?",
      ],
    };
  };

  const content = getCoachingContent();

  return (
    <Card className="border-nmh-teal/30 bg-nmh-teal/5 sticky top-4">
      <CardHeader
        className="cursor-pointer select-none pb-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-nmh-teal shrink-0" />
          <CardTitle className="text-sm font-semibold text-nmh-teal flex-1">RCA Coaching</CardTitle>
          <Badge variant="outline" className="text-xs border-nmh-teal/30 text-nmh-teal">
            {METHOD_LABELS[method] ?? method}
          </Badge>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0 text-sm">
          <p className="font-medium text-nmh-teal">{content.title}</p>
          <p className="text-muted-foreground leading-relaxed">{content.description}</p>

          {content.tips.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground/80 mb-1.5 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5" />
                Tips
              </p>
              <ul className="space-y-1.5 pl-5">
                {content.tips.map((tip, i) => (
                  <li key={i} className="text-muted-foreground text-xs leading-snug flex gap-2">
                    <span className="text-nmh-teal shrink-0">&#8226;</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.questions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground/80 mb-1.5 flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                Guiding Questions
              </p>
              <ul className="space-y-1.5 pl-5">
                {content.questions.map((q, i) => (
                  <li key={i} className="text-muted-foreground text-xs leading-snug flex gap-2">
                    <span className="text-amber-600 shrink-0">?</span>
                    <span className="italic">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
