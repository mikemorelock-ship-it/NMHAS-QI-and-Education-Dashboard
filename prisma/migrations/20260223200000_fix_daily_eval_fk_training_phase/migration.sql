-- Fix DailyEvaluation FK constraint: phaseId should reference TrainingPhase, not FtoPhase
-- The 20260221000000_overall_rating_to_float migration incorrectly referenced "FtoPhase"
-- when recreating the table (FtoPhase was the old name; init migration used TrainingPhase).
-- Note: PRAGMA statements removed — Turso/libSQL HTTP API does not support them.

CREATE TABLE "new_DailyEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeId" TEXT NOT NULL,
    "ftoId" TEXT NOT NULL,
    "phaseId" TEXT,
    "date" DATETIME NOT NULL,
    "overallRating" REAL NOT NULL,
    "narrative" TEXT,
    "mostSatisfactory" TEXT,
    "leastSatisfactory" TEXT,
    "recommendAction" TEXT NOT NULL DEFAULT 'continue',
    "nrtFlag" BOOLEAN NOT NULL DEFAULT false,
    "remFlag" BOOLEAN NOT NULL DEFAULT false,
    "traineeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" DATETIME,
    "supervisorReviewedBy" TEXT,
    "supervisorNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyEvaluation_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_ftoId_fkey" FOREIGN KEY ("ftoId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TrainingPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_supervisorReviewedBy_fkey" FOREIGN KEY ("supervisorReviewedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyEvaluation" ("id", "traineeId", "ftoId", "phaseId", "date", "overallRating", "narrative", "mostSatisfactory", "leastSatisfactory", "recommendAction", "nrtFlag", "remFlag", "traineeAcknowledged", "acknowledgedAt", "supervisorReviewedBy", "supervisorNotes", "status", "createdAt", "updatedAt") SELECT "id", "traineeId", "ftoId", "phaseId", "date", "overallRating", "narrative", "mostSatisfactory", "leastSatisfactory", "recommendAction", "nrtFlag", "remFlag", "traineeAcknowledged", "acknowledgedAt", "supervisorReviewedBy", "supervisorNotes", "status", "createdAt", "updatedAt" FROM "DailyEvaluation";
DROP TABLE "DailyEvaluation";
ALTER TABLE "new_DailyEvaluation" RENAME TO "DailyEvaluation";
CREATE INDEX "DailyEvaluation_traineeId_idx" ON "DailyEvaluation"("traineeId");
CREATE INDEX "DailyEvaluation_ftoId_idx" ON "DailyEvaluation"("ftoId");
CREATE INDEX "DailyEvaluation_date_idx" ON "DailyEvaluation"("date");
CREATE INDEX "DailyEvaluation_phaseId_idx" ON "DailyEvaluation"("phaseId");
CREATE INDEX "DailyEvaluation_status_idx" ON "DailyEvaluation"("status");
