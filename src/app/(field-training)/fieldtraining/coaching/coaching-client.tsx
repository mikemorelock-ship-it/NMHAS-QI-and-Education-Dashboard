"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Markdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Gamepad2,
  HelpCircle,
  Clock,
  CheckCircle2,
  Play,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { startCoachingActivity, completeCoachingActivity } from "@/actions/coaching";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CoachingAssignment {
  id: string;
  status: string;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  score: number | null;
  response: string | null;
  createdAt: string;
  activity: {
    id: string;
    title: string;
    description: string | null;
    type: string;
    content: string | null;
    difficulty: string;
    estimatedMins: number;
    categoryName: string;
    categorySlug: string;
    generationStatus: string;
  };
  dor: { id: string; date: string; overallRating: number } | null;
}

interface CoachingDashboardClientProps {
  activities: CoachingAssignment[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<string, typeof BookOpen> = {
  reading: BookOpen,
  reflection: MessageSquare,
  scenario: Gamepad2,
  quiz: HelpCircle,
};

const TYPE_LABELS: Record<string, string> = {
  reading: "Reading",
  reflection: "Reflection",
  scenario: "Scenario",
  quiz: "Quiz",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  basic: "bg-green-100 text-green-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-red-100 text-red-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoachingDashboardClient({ activities }: CoachingDashboardClientProps) {
  const assigned = activities.filter((a) => a.status === "assigned");
  const inProgress = activities.filter((a) => a.status === "in_progress");
  const completed = activities.filter((a) => a.status === "completed");
  const activeItems = [...inProgress, ...assigned];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Go back">
          <Link href="/fieldtraining">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coaching Activities</h1>
          <p className="text-muted-foreground">
            Complete these activities to strengthen areas identified in your DORs.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-amber-600">{activeItems.length}</p>
            <p className="text-sm text-muted-foreground">To Do</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-blue-600">{inProgress.length}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-600">{completed.length}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Activities */}
      {activeItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Active Activities</h2>
          {activeItems.map((a) => (
            <ActivityCard key={a.id} assignment={a} />
          ))}
        </div>
      )}

      {/* No Active */}
      {activeItems.length === 0 && completed.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">No coaching activities assigned</p>
            <p className="text-sm text-muted-foreground mt-1">
              Activities will appear here if any DOR categories need improvement.
            </p>
          </CardContent>
        </Card>
      )}

      {activeItems.length === 0 && completed.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-center py-8">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
            <p className="text-lg font-medium text-green-800">All caught up!</p>
            <p className="text-sm text-green-700 mt-1">
              You&apos;ve completed all your coaching activities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Completed Activities */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">
            Completed ({completed.length})
          </h2>
          {completed.map((a) => (
            <ActivityCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Card
// ---------------------------------------------------------------------------

function ActivityCard({ assignment }: { assignment: CoachingAssignment }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [response, setResponse] = useState(assignment.response || "");
  const [error, setError] = useState<string | null>(null);

  const { activity, status } = assignment;
  const Icon = TYPE_ICONS[activity.type] || BookOpen;
  const isCompleted = status === "completed";

  function handleStart() {
    setError(null);
    startTransition(async () => {
      const result = await startCoachingActivity(assignment.id);
      if (!result.success) setError(result.error || "Failed to start.");
    });
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeCoachingActivity(
        assignment.id,
        activity.type === "reflection" ? response : undefined
      );
      if (!result.success) setError(result.error || "Failed to complete.");
    });
  }

  return (
    <Card className={isCompleted ? "opacity-70" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5 p-2 rounded-lg bg-muted">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight">{activity.title}</CardTitle>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge variant="outline" className="text-xs">
                  {activity.categoryName}
                </Badge>
                <Badge className={`text-xs ${DIFFICULTY_COLORS[activity.difficulty]}`}>
                  {activity.difficulty}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {TYPE_LABELS[activity.type] || activity.type}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />~{activity.estimatedMins} min
                </span>
                {activity.generationStatus !== "manual" && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-purple-50 text-purple-700 border-purple-200"
                  >
                    <Sparkles className="h-2.5 w-2.5 mr-1" />
                    AI-Assisted
                  </Badge>
                )}
              </div>
              {activity.description && (
                <CardDescription className="mt-1.5 text-xs">{activity.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {isCompleted && (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Done
              </Badge>
            )}
            {status === "in_progress" && (
              <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
            )}
            {status === "assigned" && <Badge className="bg-amber-100 text-amber-700">New</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Progress bar for in-progress */}
        {status === "in_progress" && (
          <Progress value={assignment.progress} className="mt-2 h-1.5" />
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          {/* DOR reference */}
          {assignment.dor && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
              Triggered by DOR on {new Date(assignment.dor.date).toLocaleDateString()} (Rating:{" "}
              {assignment.dor.overallRating}/7)
            </div>
          )}

          {/* Content area */}
          {activity.type === "quiz" && activity.content ? (
            <QuizContent
              content={activity.content}
              isCompleted={isCompleted}
              onScore={(score) => {
                // Store score when completing quiz
                if (!isCompleted) {
                  startTransition(async () => {
                    const result = await completeCoachingActivity(assignment.id, undefined, score);
                    if (!result.success) setError(result.error || "Failed to complete.");
                  });
                }
              }}
            />
          ) : activity.type === "scenario" && activity.content ? (
            <div className="prose prose-sm max-w-none">
              <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                <Markdown>{activity.content}</Markdown>
              </div>
            </div>
          ) : activity.content ? (
            <div className="prose prose-sm max-w-none">
              <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
                <Markdown>{activity.content}</Markdown>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No content available for this activity yet.
            </p>
          )}

          {/* Reflection textarea */}
          {activity.type === "reflection" && !isCompleted && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Reflection</label>
              <Textarea
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Write your reflection here..."
                rows={4}
              />
            </div>
          )}

          {/* Completed reflection response */}
          {activity.type === "reflection" && isCompleted && assignment.response && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Your Response:</p>
              <div className="rounded-lg bg-green-50 p-3 text-sm whitespace-pre-wrap">
                {assignment.response}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isCompleted && (
            <div className="flex gap-2 pt-2 border-t">
              {status === "assigned" && (
                <Button size="sm" onClick={handleStart} disabled={isPending}>
                  <Play className="h-3.5 w-3.5 mr-1" />
                  {isPending ? "Starting..." : "Start Activity"}
                </Button>
              )}
              {status === "in_progress" && activity.type !== "quiz" && (
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={isPending || (activity.type === "reflection" && !response.trim())}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  {isPending ? "Completing..." : "Mark Complete"}
                </Button>
              )}
            </div>
          )}

          {/* Completion info */}
          {isCompleted && assignment.completedAt && (
            <p className="text-xs text-muted-foreground">
              Completed on{" "}
              {new Date(assignment.completedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {assignment.score !== null && ` — Score: ${assignment.score}%`}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Quiz Content Component
// ---------------------------------------------------------------------------

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function QuizContent({
  content,
  isCompleted,
  onScore,
}: {
  content: string;
  isCompleted: boolean;
  onScore: (score: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(isCompleted);

  // Try to parse quiz JSON — content might be JSON string or raw JSON
  let questions: QuizQuestion[] = [];
  try {
    const parsed = JSON.parse(content);
    questions = parsed.questions || parsed;
  } catch {
    // If parsing fails, show as markdown
    return (
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    );
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return (
      <div className="prose prose-sm max-w-none">
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">
          <Markdown>{content}</Markdown>
        </div>
      </div>
    );
  }

  const allAnswered = Object.keys(answers).length === questions.length;

  const handleSubmit = () => {
    if (!allAnswered) return;
    setSubmitted(true);
    const correct = questions.filter((q, i) => answers[i] === q.correctIndex).length;
    const score = Math.round((correct / questions.length) * 100);
    onScore(score);
  };

  const correctCount = submitted
    ? questions.filter((q, i) => answers[i] === q.correctIndex).length
    : 0;

  return (
    <div className="space-y-4">
      {submitted && (
        <div
          className={`rounded-lg p-3 text-sm font-medium ${
            correctCount === questions.length
              ? "bg-green-50 text-green-800"
              : correctCount >= questions.length * 0.7
                ? "bg-yellow-50 text-yellow-800"
                : "bg-red-50 text-red-800"
          }`}
        >
          Score: {correctCount}/{questions.length} (
          {Math.round((correctCount / questions.length) * 100)}%)
        </div>
      )}

      {questions.map((q, qi) => (
        <div key={qi} className="rounded-lg border p-4 space-y-2">
          <p className="font-medium text-sm">
            {qi + 1}. {q.question}
          </p>
          <div className="space-y-1.5">
            {q.options.map((opt, oi) => {
              const isSelected = answers[qi] === oi;
              const isCorrect = submitted && oi === q.correctIndex;
              const isWrong = submitted && isSelected && oi !== q.correctIndex;

              return (
                <button
                  key={oi}
                  onClick={() => {
                    if (submitted) return;
                    setAnswers((prev) => ({ ...prev, [qi]: oi }));
                  }}
                  disabled={submitted}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    isCorrect
                      ? "bg-green-100 border border-green-300 text-green-900"
                      : isWrong
                        ? "bg-red-100 border border-red-300 text-red-900"
                        : isSelected
                          ? "bg-nmh-teal/10 border border-nmh-teal text-nmh-teal"
                          : "bg-muted/50 hover:bg-muted border border-transparent"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && q.explanation && (
            <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-2">
              {q.explanation}
            </p>
          )}
        </div>
      ))}

      {!submitted && !isCompleted && (
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
          Submit Quiz ({Object.keys(answers).length}/{questions.length} answered)
        </Button>
      )}
    </div>
  );
}
