"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  X,
  Shield,
  Heart,
  HeartPulse,
  MessageCircle,
  Settings,
  HelpCircle,
  RotateCcw,
  Scale,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  ALGORITHM_STEPS,
  JUST_CULTURE_PRINCIPLES,
  THREE_DUTIES,
  type AlgorithmStep,
  type AlgorithmResult,
} from "@/lib/just-culture-content";
import { createPublicJca } from "@/actions/just-culture";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BEHAVIOR_LABELS: Record<string, string> = {
  system_issue: "System Issue",
  human_error: "Human Error",
  at_risk: "At-Risk Behavior",
  reckless: "Reckless Behavior",
  intentional_harm: "Intentional Harm",
  incapacity: "Incapacity",
};

const RESULT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Settings,
  Heart,
  HeartPulse,
  MessageCircle,
  AlertTriangle,
  ShieldAlert: Shield,
  AlertOctagon: AlertTriangle,
};

interface StepResponse {
  stepId: string;
  question: string;
  answer: string;
  answerLabel: string;
}

interface PublicFormState {
  title: string;
  description: string;
  incidentDate: string;
  involvedPerson: string;
  involvedRole: string;
  submitterName: string;
  submitterEmail: string;
  responses: StepResponse[];
  behaviorType: string;
  recommendation: string;
}

function emptyForm(): PublicFormState {
  return {
    title: "",
    description: "",
    incidentDate: "",
    involvedPerson: "",
    involvedRole: "",
    submitterName: "",
    submitterEmail: "",
    responses: [],
    behaviorType: "",
    recommendation: "",
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PublicJcaClient({ token, linkLabel }: { token: string; linkLabel: string | null }) {
  const [form, setForm] = useState<PublicFormState>(emptyForm());
  const [currentStepId, setCurrentStepId] = useState<string>("setup");
  const [result, setResult] = useState<AlgorithmResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isSetup = currentStepId === "setup";
  const currentStep = ALGORITHM_STEPS.find((s) => s.id === currentStepId);

  const updateField = <K extends keyof PublicFormState>(key: K, value: PublicFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

    const updatedResponses = [...form.responses.filter((r) => r.stepId !== step.id), newResponse];
    const updatedForm = { ...form, responses: updatedResponses };

    if (option.result) {
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

  const handleSave = () => {
    if (!form.title.trim()) {
      setError("Please provide a title for this assessment");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await createPublicJca({
        title: form.title,
        description: form.description || null,
        incidentDate: form.incidentDate || null,
        involvedPerson: form.involvedPerson || null,
        involvedRole: form.involvedRole || null,
        submitterName: form.submitterName || null,
        submitterEmail: form.submitterEmail || null,
        responses: form.responses.length > 0 ? JSON.stringify(form.responses) : null,
        behaviorType: form.behaviorType || null,
        recommendation: form.recommendation || null,
        shareToken: token,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to save");
      } else {
        setSubmitted(true);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Thank you screen
  // ---------------------------------------------------------------------------

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Assessment Submitted</h1>
          <p className="text-gray-600 text-sm mb-6">
            Your Just Culture assessment has been saved successfully. Thank you for taking the time
            to evaluate this event thoughtfully.
          </p>
          <button
            onClick={() => {
              setForm(emptyForm());
              setCurrentStepId("setup");
              setResult(null);
              setSubmitted(false);
            }}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            Start a new assessment
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main layout
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-teal-600" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Just Culture Algorithm</h1>
              {linkLabel && <p className="text-xs text-gray-500">{linkLabel}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(form.responses.length > 0 || result) && (
              <button
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
          <ProgressPill label="Setup" isActive={isSetup} isCompleted={!isSetup} />
          {ALGORITHM_STEPS.map((s) => {
            const response = form.responses.find((r) => r.stepId === s.id);
            return (
              <ProgressPill
                key={s.id}
                label={s.title}
                isActive={currentStepId === s.id}
                isCompleted={!!response}
              />
            );
          })}
          {result && <ProgressPill label="Result" isActive isCompleted />}
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {result ? (
              <>
                <PublicResultCard result={result} responses={form.responses} />
                <div className="bg-white border rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-600 mb-4">
                    Save this assessment to record your evaluation.
                  </p>
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    {isPending ? "Saving..." : "Save Assessment"}
                  </button>
                </div>
              </>
            ) : isSetup ? (
              <PublicSetupForm
                form={form}
                updateField={updateField}
                onContinue={() => setCurrentStepId("step_1")}
              />
            ) : currentStep ? (
              <PublicStepCard
                step={currentStep}
                existingResponse={form.responses.find((r) => r.stepId === currentStep.id)}
                onAnswer={(v) => handleAnswer(currentStep, v)}
              />
            ) : null}

            {/* Decision trail */}
            {form.responses.length > 0 && !result && (
              <div className="bg-white border rounded-xl p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Decision Trail</h3>
                <div className="space-y-3">
                  {form.responses.map((r, i) => {
                    const step = ALGORITHM_STEPS.find((s) => s.id === r.stepId);
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">{step?.title ?? r.stepId}</p>
                          <p className="text-sm text-gray-900">{r.answerLabel}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <PublicCoachingPanel currentStepId={currentStepId} result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressPill({
  label,
  isActive,
  isCompleted,
}: {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        isActive
          ? "bg-teal-600 text-white"
          : isCompleted
            ? "bg-teal-50 text-teal-700"
            : "bg-gray-100 text-gray-400"
      }`}
    >
      {isCompleted && !isActive && <CheckCircle2 className="h-3 w-3" />}
      {label}
    </span>
  );
}

function PublicSetupForm({
  form,
  updateField,
  onContinue,
}: {
  form: PublicFormState;
  updateField: <K extends keyof PublicFormState>(key: K, value: PublicFormState[K]) => void;
  onContinue: () => void;
}) {
  return (
    <div className="bg-white border rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Assessment Setup</h2>
        <p className="text-sm text-gray-500 mt-1">
          Describe the event and provide context before beginning the algorithm.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={form.submitterName}
              onChange={(e) => updateField("submitterName", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
            <input
              type="email"
              placeholder="your.email@example.com"
              value={form.submitterEmail}
              onChange={(e) => updateField("submitterEmail", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assessment Title *</label>
          <input
            type="text"
            placeholder="Brief title for this assessment"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Event Description</label>
          <textarea
            placeholder="Describe the event objectively. Focus on what happened, not who is at fault..."
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Incident Date</label>
            <input
              type="date"
              value={form.incidentDate}
              onChange={(e) => updateField("incidentDate", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Individual Being Evaluated
            </label>
            <input
              type="text"
              placeholder="Name (optional)"
              value={form.involvedPerson}
              onChange={(e) => updateField("involvedPerson", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              type="text"
              placeholder="e.g., Paramedic"
              value={form.involvedRole}
              onChange={(e) => updateField("involvedRole", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t flex justify-end">
        <button
          onClick={onContinue}
          disabled={!form.title.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          Begin Algorithm
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PublicStepCard({
  step,
  existingResponse,
  onAnswer,
}: {
  step: AlgorithmStep;
  existingResponse?: StepResponse;
  onAnswer: (value: string) => void;
}) {
  return (
    <div className="bg-white border rounded-xl p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-600 text-white">
            Step {step.stepNumber}
          </span>
          <h2 className="text-lg font-semibold text-gray-900">{step.title}</h2>
        </div>
        <p className="text-sm text-gray-500">{step.description}</p>
      </div>

      {/* Question */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="font-medium text-gray-900">{step.question}</p>
      </div>

      {/* Guidance */}
      <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-3">
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

      {/* Interview questions */}
      {step.interviewQuestions && step.interviewQuestions.length > 0 && (
        <div className="bg-teal-50 border border-teal-200/60 rounded-lg p-3">
          <p className="text-xs font-medium text-teal-800 mb-2 flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            Sample Interview Questions
          </p>
          <ul className="space-y-1">
            {step.interviewQuestions.map((q, i) => (
              <li key={i} className="text-xs text-teal-700 flex gap-2">
                <span className="shrink-0">&#8226;</span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Educational note */}
      {step.educationalNote && (
        <div className="bg-blue-50 border border-blue-200/60 rounded-lg p-3">
          <p className="text-xs font-medium text-blue-800 mb-1 flex items-center gap-1">
            <Lightbulb className="h-3.5 w-3.5" />
            Key Concept
          </p>
          <p className="text-xs text-blue-700">{step.educationalNote}</p>
        </div>
      )}

      {/* Answer options */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Select your answer:</p>
        {step.options.map((option) => (
          <button
            key={option.value}
            onClick={() => onAnswer(option.value)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              existingResponse?.answer === option.value
                ? "border-teal-500 bg-teal-50/50"
                : "border-gray-200 hover:border-teal-300"
            }`}
          >
            <p className="text-sm font-medium text-gray-900">{option.label}</p>
            <p className="text-xs text-gray-500 mt-1">{option.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function PublicResultCard({
  result,
  responses,
}: {
  result: AlgorithmResult;
  responses: StepResponse[];
}) {
  const IconComp = RESULT_ICONS[result.icon] ?? Shield;

  return (
    <div className="space-y-6">
      <div className={`border-2 rounded-xl p-6 ${result.color}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center">
            <IconComp className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{result.label}</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/50 mt-1">
              {BEHAVIOR_LABELS[result.behaviorType] ?? result.behaviorType}
            </span>
          </div>
        </div>

        <p className="text-sm leading-relaxed mb-4">{result.description}</p>

        <div>
          <p className="text-sm font-medium mb-2">Recommended Actions:</p>
          <ul className="space-y-2">
            {result.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 opacity-60" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Decision trail */}
      <div className="bg-white border rounded-xl p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-1">Decision Trail</h3>
        <p className="text-xs text-gray-400 mb-3">
          The path through the algorithm that led to this recommendation
        </p>
        <div className="space-y-3">
          {responses.map((r, i) => {
            const step = ALGORITHM_STEPS.find((s) => s.id === r.stepId);
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-teal-600">{i + 1}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{step?.title ?? r.stepId}</p>
                  <p className="text-sm text-gray-900">{r.answerLabel}</p>
                </div>
              </div>
            );
          })}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Result</p>
              <p className="text-sm font-medium text-gray-900">{result.label}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicCoachingPanel({
  currentStepId,
  result,
}: {
  currentStepId: string;
  result: AlgorithmResult | null;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-4 sticky top-16">
      <div className="bg-teal-50/50 border border-teal-200/60 rounded-xl">
        <button
          className="w-full flex items-center gap-2 p-4 text-left"
          onClick={() => setExpanded(!expanded)}
        >
          <Scale className="h-4 w-4 text-teal-600 shrink-0" />
          <span className="text-sm font-semibold text-teal-800 flex-1">Just Culture Guide</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Key Principles</p>
              <div className="space-y-2">
                {JUST_CULTURE_PRINCIPLES.map((p, i) => (
                  <details key={i} className="text-xs">
                    <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-700">
                      {p.title}
                    </summary>
                    <p className="mt-1 text-gray-500 pl-4">{p.description}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Three Duties (David Marx)</p>
              <div className="space-y-2">
                {THREE_DUTIES.map((d, i) => (
                  <details key={i} className="text-xs">
                    <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-700">
                      {d.title}
                    </summary>
                    <p className="mt-1 text-gray-500 pl-4">{d.description}</p>
                  </details>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs font-medium text-gray-600 mb-2">Behavior Types</p>
              <div className="space-y-2">
                <div className="bg-green-50 rounded p-2">
                  <p className="text-xs font-medium text-green-800">Human Error &#8594; Console</p>
                  <p className="text-xs text-green-700">
                    Inadvertent action — the person intended to do the right thing
                  </p>
                </div>
                <div className="bg-amber-50 rounded p-2">
                  <p className="text-xs font-medium text-amber-800">
                    At-Risk Behavior &#8594; Coach
                  </p>
                  <p className="text-xs text-amber-700">
                    Conscious choice where the risk was not appreciated
                  </p>
                </div>
                <div className="bg-red-50 rounded p-2">
                  <p className="text-xs font-medium text-red-800">
                    Reckless Behavior &#8594; Discipline
                  </p>
                  <p className="text-xs text-red-700">
                    Conscious disregard of a substantial and unjustifiable risk
                  </p>
                </div>
                <div className="bg-purple-50 rounded p-2">
                  <p className="text-xs font-medium text-purple-800">
                    Incapacity &#8594; Health Pathway
                  </p>
                  <p className="text-xs text-purple-700">
                    Impairment by illness, substance use, or mental health condition
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Algorithm flow */}
      {!result && (
        <div className="bg-white border rounded-xl p-4">
          <p className="text-xs font-medium text-gray-400 mb-2">Algorithm Flow</p>
          <div className="space-y-1.5 text-xs">
            {ALGORITHM_STEPS.map((s) => {
              const isActive = currentStepId === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded ${
                    isActive ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-400"
                  }`}
                >
                  <span className="w-4 text-center">{s.stepNumber}</span>
                  <span>{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
