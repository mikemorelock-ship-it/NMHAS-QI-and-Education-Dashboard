-- CreateTable
CREATE TABLE "CoachingActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'reading',
    "content" TEXT,
    "difficulty" TEXT NOT NULL DEFAULT 'basic',
    "estimatedMins" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachingActivity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EvaluationCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraineeCoachingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "traineeId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "dorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "score" INTEGER,
    "response" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TraineeCoachingAssignment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineeCoachingAssignment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CoachingActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineeCoachingAssignment_dorId_fkey" FOREIGN KEY ("dorId") REFERENCES "DailyEvaluation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TraineeSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "snapshotData" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TraineeSnapshot_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TraineeSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CoachingActivity_categoryId_idx" ON "CoachingActivity"("categoryId");

-- CreateIndex
CREATE INDEX "CoachingActivity_type_idx" ON "CoachingActivity"("type");

-- CreateIndex
CREATE INDEX "TraineeCoachingAssignment_traineeId_idx" ON "TraineeCoachingAssignment"("traineeId");

-- CreateIndex
CREATE INDEX "TraineeCoachingAssignment_status_idx" ON "TraineeCoachingAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeCoachingAssignment_traineeId_activityId_dorId_key" ON "TraineeCoachingAssignment"("traineeId", "activityId", "dorId");

-- CreateIndex
CREATE UNIQUE INDEX "TraineeSnapshot_token_key" ON "TraineeSnapshot"("token");

-- CreateIndex
CREATE INDEX "TraineeSnapshot_token_idx" ON "TraineeSnapshot"("token");

-- CreateIndex
CREATE INDEX "TraineeSnapshot_traineeId_idx" ON "TraineeSnapshot"("traineeId");
