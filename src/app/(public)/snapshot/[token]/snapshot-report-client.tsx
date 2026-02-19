"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Award,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BookOpen,
  Shield,
  Target,
} from "lucide-react";
import type { SnapshotData } from "@/lib/snapshot-builder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const RECOMMEND_LABELS: Record<string, string> = {
  continue: "Continue",
  advance: "Advance",
  extend: "Extend",
  remediate: "Remediate",
  nrt: "NRT",
  release: "Release",
  terminate: "Terminate",
};

const PHASE_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  in_progress: "bg-blue-500",
  not_started: "bg-gray-300",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ratingColor(avg: number): string {
  const rounded = Math.round(avg);
  return RATING_COLORS[Math.min(7, Math.max(1, rounded))] || "bg-gray-500";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SnapshotReportClientProps {
  data: SnapshotData;
  token: string;
}

export function SnapshotReportClient({ data, token }: SnapshotReportClientProps) {
  const { profile, dorSummary, phaseProgress, skillProgress, coachingProgress } = data;
  const currentUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <div className="max-w-4xl mx-auto p-6 space-y-6 print:p-4 print:space-y-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-6 text-white print:rounded-none print:bg-teal-600">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">
                North Memorial Health — EMS Field Training
              </p>
              <h1 className="text-3xl font-bold mt-1">{profile.name}</h1>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-teal-100">
                {profile.employeeId && <span>ID: {profile.employeeId}</span>}
                {profile.division && <span>Division: {profile.division}</span>}
                {profile.currentPhase && (
                  <span className="bg-white/20 px-2 py-0.5 rounded">
                    Phase: {profile.currentPhase}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-sm text-teal-100 print:hidden">
              <p>Progress Report</p>
              <p>{formatDate(data.generatedAt)}</p>
              <p className="text-xs mt-1">By {data.creatorName}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold">{dorSummary.totalCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Total DORs</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold">{dorSummary.averageOverall}</span>
                <span className="text-lg text-muted-foreground">/7</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Avg Rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold">
                {skillProgress.completedCount}/{skillProgress.totalCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Skills Signed Off</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-3xl font-bold">
                {phaseProgress.completedCount}/{phaseProgress.totalCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Phases Complete</p>
            </CardContent>
          </Card>
        </div>

        {/* Flags */}
        {(dorSummary.nrtCount > 0 || dorSummary.remCount > 0) && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div className="flex gap-4 text-sm">
                  {dorSummary.nrtCount > 0 && (
                    <span className="text-red-800 font-medium">
                      NRT Flags: {dorSummary.nrtCount}
                    </span>
                  )}
                  {dorSummary.remCount > 0 && (
                    <span className="text-orange-800 font-medium">
                      REM Flags: {dorSummary.remCount}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
          <Card className="border-green-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Top Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dorSummary.bestCategories.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{c.name}</span>
                    <Badge className={`${ratingColor(c.average)} text-white`}>{c.average}</Badge>
                  </div>
                ))}
                {dorSummary.bestCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-orange-600" />
                Areas for Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dorSummary.worstCategories.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{c.name}</span>
                    <Badge className={`${ratingColor(c.average)} text-white`}>{c.average}</Badge>
                  </div>
                ))}
                {dorSummary.worstCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rating Trend */}
        {dorSummary.ratingTrend.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-teal-600" />
                Rating Trend (Last {dorSummary.ratingTrend.length} DORs)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-20">
                {dorSummary.ratingTrend.map((t, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center"
                    title={`${formatDate(t.date)}: ${t.rating}/7`}
                  >
                    <div
                      className={`w-full rounded-t ${ratingColor(t.rating)} text-white`}
                      style={{ height: `${(t.rating / 7) * 100}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5">{t.rating}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Category Averages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4 text-teal-600" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dorSummary.categoryAverages
                .sort((a, b) => b.average - a.average)
                .map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                    <div className="w-32 shrink-0">
                      <Progress value={(c.average / 7) * 100} className="h-2" />
                    </div>
                    <Badge
                      className={`${ratingColor(c.average)} text-white shrink-0 w-12 justify-center`}
                    >
                      {c.average}
                    </Badge>
                  </div>
                ))}
              {dorSummary.categoryAverages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No DOR data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Phase Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              Phase Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {phaseProgress.phases.map((p, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${PHASE_COLORS[p.status] || "bg-gray-300"}`}
                  />
                  <span className="flex-1">{p.name}</span>
                  <Badge
                    variant="outline"
                    className={
                      p.status === "completed"
                        ? "text-green-700 border-green-300"
                        : p.status === "in_progress"
                          ? "text-blue-700 border-blue-300"
                          : "text-gray-500 border-gray-300"
                    }
                  >
                    {p.status === "completed"
                      ? "Completed"
                      : p.status === "in_progress"
                        ? "In Progress"
                        : "Not Started"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Skill Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
              Skill Completion ({skillProgress.completedCount}/{skillProgress.totalCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {skillProgress.categories.map((c, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {c.completed}/{c.total}
                    </span>
                  </div>
                  <Progress
                    value={c.total > 0 ? (c.completed / c.total) * 100 : 0}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Coaching Activities */}
        {coachingProgress.total > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal-600" />
                Coaching Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{coachingProgress.assigned}</p>
                  <p className="text-xs text-muted-foreground">Assigned</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{coachingProgress.inProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{coachingProgress.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>Completion Rate</span>
                  <span className="font-medium">{coachingProgress.completionRate}%</span>
                </div>
                <Progress value={coachingProgress.completionRate} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations Summary */}
        {dorSummary.recentRecommendations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-600" />
                FTO Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {dorSummary.recentRecommendations.map((r, i) => (
                  <Badge key={i} variant="outline" className="text-sm">
                    {RECOMMEND_LABELS[r.action] || r.action}: {r.count}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8 border-t print:pt-2 print:pb-2">
          <p>
            Report generated {formatDate(data.generatedAt)} by {data.creatorName}.
          </p>
          <p>This is a point-in-time snapshot. Data may have changed since generation.</p>
          <p className="mt-1 print:hidden">North Memorial Health — EMS Operations Dashboard</p>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:bg-white {
            background-color: white !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:bg-teal-600 {
            background-color: #0d9488 !important;
          }
          .print\\:p-4 {
            padding: 1rem !important;
          }
          .print\\:space-y-4 > * + * {
            margin-top: 1rem !important;
          }
          .print\\:grid-cols-4 {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          .print\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .print\\:pt-2 {
            padding-top: 0.5rem !important;
          }
          .print\\:pb-2 {
            padding-bottom: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}
