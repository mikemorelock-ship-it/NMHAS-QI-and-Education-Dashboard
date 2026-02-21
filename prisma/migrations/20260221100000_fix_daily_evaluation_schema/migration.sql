-- Fix DailyEvaluation table: add missing supervisorNotes column
-- The 20260221000000_overall_rating_to_float migration incorrectly replaced
-- the supervisorNotes TEXT column with supervisorReviewedAt DATETIME when
-- recreating the table to convert overallRating to REAL.
-- This corrective migration adds the missing column back.

ALTER TABLE "DailyEvaluation" ADD COLUMN "supervisorNotes" TEXT;

-- Add missing indexes that were dropped by the table recreation
CREATE INDEX IF NOT EXISTS "DailyEvaluation_phaseId_idx" ON "DailyEvaluation"("phaseId");
CREATE INDEX IF NOT EXISTS "DailyEvaluation_status_idx" ON "DailyEvaluation"("status");
