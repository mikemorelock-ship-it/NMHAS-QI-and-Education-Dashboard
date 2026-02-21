-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "supervisorReviewedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyEvaluation_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_ftoId_fkey" FOREIGN KEY ("ftoId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "FtoPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DailyEvaluation_supervisorReviewedBy_fkey" FOREIGN KEY ("supervisorReviewedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyEvaluation" ("id", "traineeId", "ftoId", "phaseId", "date", "overallRating", "narrative", "mostSatisfactory", "leastSatisfactory", "recommendAction", "nrtFlag", "remFlag", "traineeAcknowledged", "acknowledgedAt", "supervisorReviewedBy", "supervisorReviewedAt", "status", "createdAt", "updatedAt") SELECT "id", "traineeId", "ftoId", "phaseId", "date", CAST("overallRating" AS REAL), "narrative", "mostSatisfactory", "leastSatisfactory", "recommendAction", "nrtFlag", "remFlag", "traineeAcknowledged", "acknowledgedAt", "supervisorReviewedBy", "supervisorReviewedAt", "status", "createdAt", "updatedAt" FROM "DailyEvaluation";
DROP TABLE "DailyEvaluation";
ALTER TABLE "new_DailyEvaluation" RENAME TO "DailyEvaluation";
CREATE INDEX "DailyEvaluation_traineeId_idx" ON "DailyEvaluation"("traineeId");
CREATE INDEX "DailyEvaluation_ftoId_idx" ON "DailyEvaluation"("ftoId");
CREATE INDEX "DailyEvaluation_date_idx" ON "DailyEvaluation"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
