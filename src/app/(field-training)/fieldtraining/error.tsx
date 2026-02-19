"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for the field training portal.
 *
 * Catches rendering errors in any field training page and shows a
 * recovery UI. The navbar/layout remains intact.
 */
export default function FieldTrainingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Field training error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md">
          An unexpected error occurred. Your data is safe — try refreshing or navigating to a
          different page.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
        <Button variant="outline" onClick={() => (window.location.href = "/fieldtraining")}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
