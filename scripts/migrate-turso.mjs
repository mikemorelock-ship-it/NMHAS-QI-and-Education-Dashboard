/**
 * Apply pending migrations to the remote Turso database.
 *
 * Usage:
 *   TURSO_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/migrate-turso.mjs
 *
 * Or set them in a .env.turso file and run:
 *   node --env-file=.env.turso scripts/migrate-turso.mjs
 */

import { createClient } from "@libsql/client";

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
