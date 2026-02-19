"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type DorData = {
  id: string;
  date: string;
  traineeName: string;
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
  ratings: { categoryName: string; rating: number; comments: string | null }[];
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
  1: "bg-red-700 text-white",
  2: "bg-red-500 text-white",
  3: "bg-orange-500 text-white",
  4: "bg-gray-500 text-white",
  5: "bg-green-500 text-white",
  6: "bg-green-600 text-white",
  7: "bg-emerald-700 text-white",
};

const RECOMMEND_LABELS: Record<string, string> = {
  continue: "Continue in Current Phase",
  advance: "Advance to Next Phase",
  extend: "Extend Current Phase",
  remediate: "Place on Remedial Training",
  nrt: "Not Responding to Training",
  release: "Recommend Release to Solo",
  terminate: "Recommend Termination",
};

export function FtoDorViewClient({ dor }: { dor: DorData }) {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Go back">
          <Link href="/fieldtraining/dors">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Observation Report</h1>
          <p className="text-muted-foreground">
            {new Date(dor.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Shift Details */}
      <Card>
        <CardHeader>
          <CardTitle>Shift Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Trainee:</span>{" "}
              <span className="font-medium">{dor.traineeName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">FTO:</span>{" "}
              <span className="font-medium">{dor.ftoName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Phase:</span>{" "}
              <span className="font-medium">{dor.phaseName || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recommendation:</span>{" "}
              <span className="font-medium">
                {RECOMMEND_LABELS[dor.recommendAction] || dor.recommendAction}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Overall Rating:</span>{" "}
              <Badge className={cn("ml-1", RATING_COLORS[dor.overallRating])}>
                {dor.overallRating}/7 — {RATING_LABELS[dor.overallRating]}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Acknowledged:</span>{" "}
              {dor.traineeAcknowledged ? (
                <Badge className="ml-1 bg-green-600 text-white">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="secondary" className="ml-1">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              )}
            </div>
          </div>
          {(dor.nrtFlag || dor.remFlag) && (
            <div className="flex gap-2 mt-3">
              {dor.nrtFlag && (
                <Badge className="bg-red-100 text-red-800">NRT — Not Responding to Training</Badge>
              )}
              {dor.remFlag && (
                <Badge className="bg-orange-100 text-orange-800">REM — Remedial Training</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Ratings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Daily Observation Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dor.ratings.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <span className="text-sm font-medium">{r.categoryName}</span>
                  {r.comments && (
                    <p className="text-xs text-muted-foreground mt-0.5">{r.comments}</p>
                  )}
                </div>
                <Badge className={RATING_COLORS[r.rating]}>{r.rating}/7</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {(dor.mostSatisfactory || dor.leastSatisfactory) && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {dor.mostSatisfactory && (
                <div>
                  <span className="text-muted-foreground">Most Satisfactory:</span>{" "}
                  <span className="font-medium">{dor.mostSatisfactory}</span>
                </div>
              )}
              {dor.leastSatisfactory && (
                <div>
                  <span className="text-muted-foreground">Least Satisfactory:</span>{" "}
                  <span className="font-medium">{dor.leastSatisfactory}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Narrative */}
      {dor.narrative && (
        <Card>
          <CardHeader>
            <CardTitle>Narrative / Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{dor.narrative}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
