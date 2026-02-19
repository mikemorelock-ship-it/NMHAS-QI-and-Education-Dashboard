"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { reviewAssignmentRequest } from "@/actions/field-training";

interface PendingRequest {
  id: string;
  requesterName: string;
  traineeName: string;
  traineeEmployeeId: string | null;
  reason: string | null;
  createdAt: string;
}

interface PendingRequestsCardProps {
  requests: PendingRequest[];
}

export function PendingRequestsCard({ requests }: PendingRequestsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  function handleReview(requestId: string, decision: "approved" | "denied") {
    setError(null);
    startTransition(async () => {
      const result = await reviewAssignmentRequest(requestId, decision, reviewNotes || undefined);
      if (result.success) {
        setProcessedIds((prev) => new Set(prev).add(requestId));
        setReviewingId(null);
        setReviewNotes("");
      } else {
        setError(result.error ?? "Failed to process request.");
      }
    });
  }

  const visibleRequests = requests.filter((r) => !processedIds.has(r.id));

  if (visibleRequests.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-base text-amber-800">Pending Assignment Requests</CardTitle>
          <Badge variant="outline" className="text-amber-700 border-amber-300 ml-auto">
            {visibleRequests.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <Card className="border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        {visibleRequests.map((req) => (
          <div key={req.id} className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">
                  {req.requesterName}{" "}
                  <span className="text-muted-foreground font-normal">requests</span>{" "}
                  {req.traineeName}
                  {req.traineeEmployeeId && (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({req.traineeEmployeeId})
                    </span>
                  )}
                </p>
                {req.reason && (
                  <p className="text-sm text-muted-foreground mt-1">&ldquo;{req.reason}&rdquo;</p>
                )}
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(req.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {reviewingId === req.id ? (
              <div className="space-y-3 pt-2 border-t">
                <div>
                  <Label htmlFor={`notes-${req.id}`} className="text-xs">
                    Review Notes (optional)
                  </Label>
                  <Textarea
                    id={`notes-${req.id}`}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    rows={2}
                    maxLength={500}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleReview(req.id, "approved")}
                    disabled={isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    {isPending ? "Processing..." : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReview(req.id, "denied")}
                    disabled={isPending}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    {isPending ? "Processing..." : "Deny"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReviewingId(null);
                      setReviewNotes("");
                      setError(null);
                    }}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setReviewingId(req.id);
                    setReviewNotes("");
                    setError(null);
                  }}
                >
                  Review
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
