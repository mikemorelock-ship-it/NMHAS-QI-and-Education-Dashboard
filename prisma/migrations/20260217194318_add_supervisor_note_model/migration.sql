-- CreateTable
CREATE TABLE "SupervisorNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evaluationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisorNote_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "DailyEvaluation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupervisorNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SupervisorNote_evaluationId_idx" ON "SupervisorNote"("evaluationId");

-- CreateIndex
CREATE INDEX "SupervisorNote_authorId_idx" ON "SupervisorNote"("authorId");
