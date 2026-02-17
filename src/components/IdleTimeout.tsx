"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * IdleTimeout — logs users out after a period of inactivity.
 *
 * Tracks mouse, keyboard, scroll, and touch events. If no activity is
 * detected for `timeoutMinutes`, shows a warning dialog. If the user
 * doesn't respond within `warningSeconds`, they're logged out.
 *
 * Uses localStorage to sync activity across tabs so one active tab
 * keeps all tabs alive.
 */

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

const STORAGE_KEY = "ems-last-activity";

interface IdleTimeoutProps {
  /** Minutes of inactivity before showing warning (default: 30) */
  timeoutMinutes?: number;
  /** Seconds to show warning before auto-logout (default: 60) */
  warningSeconds?: number;
  /** Logout URL to redirect to (default: /login) */
  logoutUrl?: string;
}

export function IdleTimeout({
  timeoutMinutes = 30,
  warningSeconds = 60,
  logoutUrl = "/login?reason=idle",
}: IdleTimeoutProps) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(warningSeconds);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const timeoutMs = timeoutMinutes * 60 * 1000;

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const doLogout = useCallback(async () => {
    clearAllTimers();
    setShowWarning(false);
    // Clear session cookie via server action
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        // If the API call fails, redirect anyway
      }
    } catch {
      // Network error — redirect anyway
    }
    router.push(logoutUrl);
  }, [clearAllTimers, logoutUrl, router]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setCountdown(warningSeconds);

    let remaining = warningSeconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        doLogout();
      }
    }, 1000);

    warningRef.current = setTimeout(() => {
      doLogout();
    }, warningSeconds * 1000);
  }, [warningSeconds, doLogout]);

  const resetTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setCountdown(warningSeconds);

    // Update cross-tab activity timestamp
    try {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      // localStorage may be unavailable
    }

    timeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, timeoutMs);
  }, [clearAllTimers, timeoutMs, warningSeconds, startWarningCountdown]);

  // Listen for activity from other tabs
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        // Another tab had activity — reset our timer too
        resetTimer();
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [resetTimer]);

  // Attach activity listeners
  useEffect(() => {
    // Throttle: only reset every 30 seconds to avoid excessive timer resets
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 30_000) {
        lastReset = now;
        resetTimer();
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, throttledReset, { passive: true });
    }

    // Start initial timer
    resetTimer();

    return () => {
      clearAllTimers();
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, throttledReset);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 text-center">
        <div className="text-amber-500 text-4xl mb-3">⏱</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Session Timeout Warning
        </h2>
        <p className="text-gray-600 mb-4">
          You&apos;ve been inactive for {timeoutMinutes} minutes. You&apos;ll be
          logged out in{" "}
          <span className="font-bold text-red-600">{countdown}</span> seconds.
        </p>
        <button
          onClick={resetTimer}
          className="px-6 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors font-medium"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  );
}
