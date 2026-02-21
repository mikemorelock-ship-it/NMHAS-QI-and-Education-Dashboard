/**
 * Apply pending migrations to the remote Turso database.
 *
 * Usage:
 *   TURSO_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/migrate-turso.mjs
 *
 * Or set them in a .env.turso file and run:
 *   node --env-file=.env.turso scripts/migrate-turso.mjs
 */

import { createClient } from "@libsql/client/web";

const url = process.env.TURSO_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !url.startsWith("libsql://")) {
  console.error("Error: TURSO_URL must be set to a libsql:// URL");
  console.error(
    "Usage: TURSO_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/migrate-turso.mjs"
  );
  process.exit(1);
}

if (!authToken) {
  console.error("Error: TURSO_AUTH_TOKEN must be set");
  process.exit(1);
}

const client = createClient({ url, authToken });

// Migrations to apply (in order)
const migrations = [
  {
    name: "20260218004216_add_division_change_request",
    statements: [
      `CREATE TABLE IF NOT EXISTS "DivisionChangeRequest" (
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
      )`,
      `CREATE INDEX IF NOT EXISTS "DivisionChangeRequest_userId_idx" ON "DivisionChangeRequest"("userId")`,
      `CREATE INDEX IF NOT EXISTS "DivisionChangeRequest_status_idx" ON "DivisionChangeRequest"("status")`,
      `CREATE INDEX IF NOT EXISTS "DivisionChangeRequest_requestedDivisionId_idx" ON "DivisionChangeRequest"("requestedDivisionId")`,
    ],
  },
  {
    name: "20260218034803_add_audit_log_indexes_and_changes",
    statements: [
      // ALTER TABLE ADD COLUMN is idempotent-safe in SQLite (errors if column exists, so we catch it)
      `ALTER TABLE "AuditLog" ADD COLUMN "changes" TEXT`,
      `CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId")`,
      `CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId")`,
      `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")`,
    ],
  },
  {
    name: "20260220220401_add_resource_docs_coaching_provenance",
    statements: [
      `CREATE TABLE IF NOT EXISTS "ResourceDocument" (
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
      )`,
      `CREATE INDEX IF NOT EXISTS "ResourceDocument_uploadedById_idx" ON "ResourceDocument"("uploadedById")`,
      `CREATE INDEX IF NOT EXISTS "ResourceDocument_isActive_idx" ON "ResourceDocument"("isActive")`,
      // Rebuild CoachingActivity with new provenance columns
      `CREATE TABLE IF NOT EXISTS "new_CoachingActivity" (
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
      )`,
      `INSERT OR IGNORE INTO "new_CoachingActivity" ("categoryId", "content", "createdAt", "description", "difficulty", "estimatedMins", "id", "isActive", "title", "type", "updatedAt") SELECT "categoryId", "content", "createdAt", "description", "difficulty", "estimatedMins", "id", "isActive", "title", "type", "updatedAt" FROM "CoachingActivity"`,
      `DROP TABLE IF EXISTS "CoachingActivity"`,
      `ALTER TABLE "new_CoachingActivity" RENAME TO "CoachingActivity"`,
      `CREATE INDEX IF NOT EXISTS "CoachingActivity_categoryId_idx" ON "CoachingActivity"("categoryId")`,
      `CREATE INDEX IF NOT EXISTS "CoachingActivity_type_idx" ON "CoachingActivity"("type")`,
      `CREATE INDEX IF NOT EXISTS "CoachingActivity_sourceDocumentId_idx" ON "CoachingActivity"("sourceDocumentId")`,
      `CREATE INDEX IF NOT EXISTS "CoachingActivity_generationStatus_idx" ON "CoachingActivity"("generationStatus")`,
      `CREATE INDEX IF NOT EXISTS "CoachingActivity_reviewedById_idx" ON "CoachingActivity"("reviewedById")`,
    ],
  },
  {
    name: "20260221000000_overall_rating_to_float",
    statements: [
      `CREATE TABLE IF NOT EXISTS "new_DailyEvaluation" (
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
      )`,
      `INSERT OR IGNORE INTO "new_DailyEvaluation" ("id", "traineeId", "ftoId", "phaseId", "date", "overallRating", "narrative", "mostSatisfactory", "leastSatisfactory", "recommendAction", "nrtFlag", "remFlag", "traineeAcknowledged", "acknowledgedAt", "supervisorReviewedBy", "supervisorReviewedAt", "status", "createdAt", "updatedAt") SELECT "id", "traineeId", "ftoId", "phaseId", "date", CAST("overallRating" AS REAL), "narrative", "mostSatisfactory", "leastSatisfactory", "recommendAction", "nrtFlag", "remFlag", "traineeAcknowledged", "acknowledgedAt", "supervisorReviewedBy", "supervisorReviewedAt", "status", "createdAt", "updatedAt" FROM "DailyEvaluation"`,
      `DROP TABLE IF EXISTS "DailyEvaluation"`,
      `ALTER TABLE "new_DailyEvaluation" RENAME TO "DailyEvaluation"`,
      `CREATE INDEX IF NOT EXISTS "DailyEvaluation_traineeId_idx" ON "DailyEvaluation"("traineeId")`,
      `CREATE INDEX IF NOT EXISTS "DailyEvaluation_ftoId_idx" ON "DailyEvaluation"("ftoId")`,
      `CREATE INDEX IF NOT EXISTS "DailyEvaluation_date_idx" ON "DailyEvaluation"("date")`,
    ],
  },
];

console.log(`Connecting to Turso: ${url.replace(/\/\/.*@/, "//***@")}`);

for (const migration of migrations) {
  console.log(`\nApplying: ${migration.name}`);
  for (const sql of migration.statements) {
    const shortSql = sql.trim().slice(0, 80).replace(/\n/g, " ");
    try {
      await client.execute(sql);
      console.log(`  ✓ ${shortSql}...`);
    } catch (err) {
      // "duplicate column name" is expected if migration already applied
      if (err.message?.includes("duplicate column")) {
        console.log(`  ⊘ ${shortSql}... (already exists, skipped)`);
      } else {
        console.error(`  ✗ ${shortSql}...`);
        console.error(`    Error: ${err.message}`);
        process.exit(1);
      }
    }
  }
}

console.log("\n✅ All migrations applied successfully!");
client.close();
