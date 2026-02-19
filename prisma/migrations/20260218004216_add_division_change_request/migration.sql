-- CreateTable
CREATE TABLE "DivisionChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "currentDivisionId" TEXT,
    "requestedDivisionId" TEXT NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DivisionChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DivisionChangeRequest_requestedDivisionId_fkey" FOREIGN KEY ("requestedDivisionId") REFERENCES "Division" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DivisionChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DivisionChangeRequest_userId_idx" ON "DivisionChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "DivisionChangeRequest_status_idx" ON "DivisionChangeRequest"("status");

-- CreateIndex
CREATE INDEX "DivisionChangeRequest_requestedDivisionId_idx" ON "DivisionChangeRequest"("requestedDivisionId");
