"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, X, LogIn } from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Session Timeout Warning
//
// Shows a non-intrusive banner when the user's session is about to expire.
// - Appears with 5 minutes remaining
// - Shows a countdown timer
// - When expired, shows an "expired" state with a login link
// ---------------------------------------------------------------------------

interface SessionTimeoutWarningProps {
  /** When the session expires (Unix ms) */
  expiresAt: number;
  /** Path to redirect to for re-login */
  loginPath: string;
  /** Label for the session duration (e.g., "24 hours") */
  sessionDurationLabel: string;
}

/** Show warning when this many ms remain */
const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function SessionTimeoutWarning({
  expiresAt,
  loginPath,
  sessionDurationLabel,
}: SessionTimeoutWarningProps) {
  const [state, setState] = useState<"ok" | "warning" | "expired">("ok");
  const [remainingMs, setRemainingMs] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(() => {
    const now = Date.now();
    const remaining = expiresAt - now;

    if (remaining <= 0) {
      setState("expired");
      setRemainingMs(0);
    } else if (remaining <= WARNING_THRESHOLD_MS) {
      setState("warning");
      setRemainingMs(remaining);
    } else {
      setState("ok");
      setRemainingMs(remaining);
    }
  }, [expiresAt]);

  useEffect(() => {
    // Initial check via setTimeout to avoid synchronous setState in effect
    const timeout = setTimeout(check, 0);

    // Check every 30 seconds (good balance of responsiveness vs perf)
    const interval = setInterval(check, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [check]);

  // Update countdown more frequently once warning is shown
  useEffect(() => {
    if (state !== "warning") return;
    const interval = setInterval(check, 1_000);
    return () => clearInterval(interval);
  }, [state, check]);

  // Don't show anything if OK or dismissed (and not expired)
  if (state === "ok") return null;
  if (state === "warning" && dismissed) return null;

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1_000);

  if (state === "expired") {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Session Expired</p>
              <p className="text-xs text-red-600 mt-1">
                Your {sessionDurationLabel} session has expired. Please log in again to continue.
              </p>
              <Link
                href={loginPath}
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2"
              >
                <LogIn className="h-3.5 w-3.5" />
                Log in again
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Warning state
  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Session Expiring Soon</p>
            <p className="text-xs text-amber-600 mt-1">
              Your session expires in{" "}
              <span className="font-mono font-medium">
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>
              . Save your work to avoid losing changes.
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-400 hover:text-amber-600 transition-colors"
            aria-label="Dismiss warning"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
