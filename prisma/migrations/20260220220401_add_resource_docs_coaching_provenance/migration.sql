-- CreateTable
CREATE TABLE "ResourceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "textContent" TEXT,
    "textLength" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "uploadedById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResourceDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoachingActivity" (
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
    "sourceDocumentId" TEXT,
    "generationStatus" TEXT NOT NULL DEFAULT 'manual',
    "generationPrompt" TEXT,
    "generatedAt" DATETIME,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "reviewNotes" TEXT,
    CONSTRAINT "CoachingActivity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EvaluationCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoachingActivity_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "ResourceDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoachingActivity_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CoachingActivity" ("categoryId", "content", "createdAt", "description", "difficulty", "estimatedMins", "id", "isActive", "title", "type", "updatedAt") SELECT "categoryId", "content", "createdAt", "description", "difficulty", "estimatedMins", "id", "isActive", "title", "type", "updatedAt" FROM "CoachingActivity";
DROP TABLE "CoachingActivity";
ALTER TABLE "new_CoachingActivity" RENAME TO "CoachingActivity";
CREATE INDEX "CoachingActivity_categoryId_idx" ON "CoachingActivity"("categoryId");
CREATE INDEX "CoachingActivity_type_idx" ON "CoachingActivity"("type");
CREATE INDEX "CoachingActivity_sourceDocumentId_idx" ON "CoachingActivity"("sourceDocumentId");
CREATE INDEX "CoachingActivity_generationStatus_idx" ON "CoachingActivity"("generationStatus");
CREATE INDEX "CoachingActivity_reviewedById_idx" ON "CoachingActivity"("reviewedById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ResourceDocument_uploadedById_idx" ON "ResourceDocument"("uploadedById");

-- CreateIndex
CREATE INDEX "ResourceDocument_isActive_idx" ON "ResourceDocument"("isActive");
