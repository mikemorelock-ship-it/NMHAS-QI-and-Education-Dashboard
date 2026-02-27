-- CreateTable
CREATE TABLE "RootCauseAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "incidentDate" DATETIME,
    "description" TEXT,
    "method" TEXT NOT NULL DEFAULT 'fishbone',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "severity" TEXT,
    "people" TEXT,
    "process" TEXT,
    "equipment" TEXT,
    "environment" TEXT,
    "management" TEXT,
    "materials" TEXT,
    "whyChain" TEXT,
    "rootCauses" TEXT,
    "contributingFactors" TEXT,
    "correctiveActions" TEXT,
    "preventiveActions" TEXT,
    "summary" TEXT,
    "recommendations" TEXT,
    "lessonsLearned" TEXT,
    "campaignId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RootCauseAnalysis_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RootCauseAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JustCultureAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "incidentDate" DATETIME,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "responses" TEXT,
    "behaviorType" TEXT,
    "recommendation" TEXT,
    "involvedPerson" TEXT,
    "involvedRole" TEXT,
    "supervisorNotes" TEXT,
    "campaignId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "JustCultureAssessment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "JustCultureAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RootCauseAnalysis_status_idx" ON "RootCauseAnalysis"("status");

-- CreateIndex
CREATE INDEX "RootCauseAnalysis_campaignId_idx" ON "RootCauseAnalysis"("campaignId");

-- CreateIndex
CREATE INDEX "RootCauseAnalysis_createdById_idx" ON "RootCauseAnalysis"("createdById");

-- CreateIndex
CREATE INDEX "JustCultureAssessment_status_idx" ON "JustCultureAssessment"("status");

-- CreateIndex
CREATE INDEX "JustCultureAssessment_campaignId_idx" ON "JustCultureAssessment"("campaignId");

-- CreateIndex
CREATE INDEX "JustCultureAssessment_createdById_idx" ON "JustCultureAssessment"("createdById");
