-- AlterTable
ALTER TABLE "JustCultureAssessment" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "JustCultureAssessment" ADD COLUMN "submitterEmail" TEXT;
ALTER TABLE "JustCultureAssessment" ADD COLUMN "submitterName" TEXT;

-- CreateTable
CREATE TABLE "MetricYearTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "target" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetricYearTarget_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JcaShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "createdById" TEXT,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JcaShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "goals" TEXT,
    "keyFindings" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "ownerId" TEXT,
    "metricDefinitionId" TEXT,
    "divisionId" TEXT,
    "regionId" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Campaign_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Individual" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("createdAt", "description", "divisionId", "endDate", "goals", "id", "isActive", "keyFindings", "metricDefinitionId", "name", "ownerId", "regionId", "slug", "sortOrder", "startDate", "status", "updatedAt") SELECT "createdAt", "description", "divisionId", "endDate", "goals", "id", "isActive", "keyFindings", "metricDefinitionId", "name", "ownerId", "regionId", "slug", "sortOrder", "startDate", "status", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_metricDefinitionId_idx" ON "Campaign"("metricDefinitionId");
CREATE INDEX "Campaign_divisionId_idx" ON "Campaign"("divisionId");
CREATE INDEX "Campaign_regionId_idx" ON "Campaign"("regionId");
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
    CONSTRAINT "DailyEvaluation_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "TrainingPhase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyEvaluation" ("acknowledgedAt", "createdAt", "date", "ftoId", "id", "leastSatisfactory", "mostSatisfactory", "narrative", "nrtFlag", "overallRating", "phaseId", "recommendAction", "remFlag", "status", "supervisorNotes", "supervisorReviewedBy", "traineeAcknowledged", "traineeId", "updatedAt") SELECT "acknowledgedAt", "createdAt", "date", "ftoId", "id", "leastSatisfactory", "mostSatisfactory", "narrative", "nrtFlag", "overallRating", "phaseId", "recommendAction", "remFlag", "status", "supervisorNotes", "supervisorReviewedBy", "traineeAcknowledged", "traineeId", "updatedAt" FROM "DailyEvaluation";
DROP TABLE "DailyEvaluation";
ALTER TABLE "new_DailyEvaluation" RENAME TO "DailyEvaluation";
CREATE INDEX "DailyEvaluation_traineeId_date_idx" ON "DailyEvaluation"("traineeId", "date");
CREATE INDEX "DailyEvaluation_ftoId_idx" ON "DailyEvaluation"("ftoId");
CREATE INDEX "DailyEvaluation_phaseId_idx" ON "DailyEvaluation"("phaseId");
CREATE INDEX "DailyEvaluation_status_idx" ON "DailyEvaluation"("status");
CREATE TABLE "new_MetricEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricDefinitionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "divisionId" TEXT,
    "individualId" TEXT,
    "periodType" TEXT NOT NULL DEFAULT 'monthly',
    "periodStart" DATETIME NOT NULL,
    "value" REAL NOT NULL,
    "numerator" REAL,
    "denominator" REAL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MetricEntry_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_individualId_fkey" FOREIGN KEY ("individualId") REFERENCES "Individual" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MetricEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MetricEntry" ("createdAt", "createdById", "denominator", "departmentId", "divisionId", "id", "individualId", "metricDefinitionId", "notes", "numerator", "periodStart", "periodType", "updatedAt", "value") SELECT "createdAt", "createdById", "denominator", "departmentId", "divisionId", "id", "individualId", "metricDefinitionId", "notes", "numerator", "periodStart", "periodType", "updatedAt", "value" FROM "MetricEntry";
DROP TABLE "MetricEntry";
ALTER TABLE "new_MetricEntry" RENAME TO "MetricEntry";
CREATE INDEX "MetricEntry_departmentId_periodStart_idx" ON "MetricEntry"("departmentId", "periodStart");
CREATE INDEX "MetricEntry_metricDefinitionId_periodStart_idx" ON "MetricEntry"("metricDefinitionId", "periodStart");
CREATE INDEX "MetricEntry_divisionId_periodStart_idx" ON "MetricEntry"("divisionId", "periodStart");
CREATE UNIQUE INDEX "MetricEntry_metricDefinitionId_departmentId_divisionId_individualId_periodType_periodStart_key" ON "MetricEntry"("metricDefinitionId", "departmentId", "divisionId", "individualId", "periodType", "periodStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MetricYearTarget_metricDefinitionId_idx" ON "MetricYearTarget"("metricDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricYearTarget_metricDefinitionId_year_key" ON "MetricYearTarget"("metricDefinitionId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "JcaShareLink_token_key" ON "JcaShareLink"("token");

-- CreateIndex
CREATE INDEX "JcaShareLink_token_idx" ON "JcaShareLink"("token");
