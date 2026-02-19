"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DorDraftData {
  traineeId?: string;
  date?: string;
  phaseId?: string;
  overallRating: number | null;
  categoryRatings: Record<string, { rating: number | null; comments: string }>;
  narrative?: string;
  mostSatisfactory?: string;
  leastSatisfactory?: string;
  recommendAction?: string;
  nrtFlag: boolean;
  remFlag: boolean;
  savedAt: string;
}

interface UseDorAutosaveOptions {
  /** For new DORs: the FTO's user ID (key = ems-dor-draft:{ftoId}) */
  ftoId?: string;
  /** For editing existing DORs: the DOR ID (key = ems-dor-edit:{dorId}) */
  dorId?: string;
}

interface UseDorAutosaveReturn {
  restoredDraft: DorDraftData | null;
  saveDraft: (data: DorDraftData) => void;
  clearDraft: () => void;
  lastSavedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 2000;

function buildKey(opts: UseDorAutosaveOptions): string | null {
  if (opts.dorId) return `ems-dor-edit:${opts.dorId}`;
  if (opts.ftoId) return `ems-dor-draft:${opts.ftoId}`;
  return null;
}

function readFromStorage(key: string): DorDraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DorDraftData;
  } catch {
    return null;
  }
}

function writeToStorage(key: string, data: DorDraftData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage full or unavailable - silently fail
  }
}

function removeFromStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Silently fail
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDorAutosave(opts: UseDorAutosaveOptions): UseDorAutosaveReturn {
  const storageKey = buildKey(opts);

  const [restoredDraft, setRestoredDraft] = useState<DorDraftData | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Refs for debounce
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDataRef = useRef<DorDraftData | null>(null);

  // ---- Restore on mount ----
  useEffect(() => {
    if (!storageKey) return;
    const existing = readFromStorage(storageKey);
    if (existing) {
      setRestoredDraft(existing);
      setLastSavedAt(existing.savedAt ?? null);
    }
  }, [storageKey]);

  // ---- Flush pending write on unmount ----
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Flush any pending save immediately on unmount
      if (pendingDataRef.current && storageKey) {
        writeToStorage(storageKey, pendingDataRef.current);
        pendingDataRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ---- Debounced save ----
  const saveDraft = useCallback(
    (data: DorDraftData) => {
      if (!storageKey) return;

      const stamped: DorDraftData = {
        ...data,
        savedAt: new Date().toISOString(),
      };

      pendingDataRef.current = stamped;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        if (pendingDataRef.current) {
          writeToStorage(storageKey, pendingDataRef.current);
          setLastSavedAt(pendingDataRef.current.savedAt);
          pendingDataRef.current = null;
        }
        timerRef.current = null;
      }, DEBOUNCE_MS);
    },
    [storageKey]
  );

  // ---- Clear draft ----
  const clearDraft = useCallback(() => {
    if (!storageKey) return;

    // Cancel any pending debounce
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingDataRef.current = null;

    removeFromStorage(storageKey);
    setRestoredDraft(null);
    setLastSavedAt(null);
  }, [storageKey]);

  return { restoredDraft, saveDraft, clearDraft, lastSavedAt };
}
