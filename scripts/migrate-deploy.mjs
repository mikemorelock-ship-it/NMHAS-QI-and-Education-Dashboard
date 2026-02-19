/**
 * migrate-deploy.mjs — Apply pending Prisma migrations to a Turso/libsql database.
 *
 * Prisma's built-in `migrate deploy` doesn't support libsql:// URLs, so this
 * script replicates its behaviour:
 *   1. Ensures the `_prisma_migrations` tracking table exists.
 *   2. Reads which migrations have already been applied.
 *   3. Applies any new migration SQL files in order.
 *   4. Records each successful migration in the tracking table.
 *
 * Usage:
 *   DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/migrate-deploy.mjs
 *
 * The script is also safe to run when DATABASE_URL is a local file: path — it
 * simply skips and prints a message (local dev uses `prisma migrate dev`).
 */

import "dotenv/config";
import { createClient } from "@libsql/client/web";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set.");
  process.exit(1);
}

// Skip if this is a local file: URL (local dev uses prisma migrate dev)
if (DATABASE_URL.startsWith("file:")) {
  console.log("⏭️  DATABASE_URL is a local file — skipping remote migration deploy.");
  process.exit(0);
}

const migrationsDir = join(import.meta.dirname, "..", "prisma", "migrations");

const client = createClient({
  url: DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function ensureMigrationsTable() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id                  TEXT PRIMARY KEY NOT NULL,
      checksum            TEXT NOT NULL,
      finished_at         DATETIME,
      migration_name      TEXT NOT NULL,
      logs                TEXT,
      rolled_back_at      DATETIME,
      started_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    )
  `);
}

async function getAppliedMigrations() {
  const result = await client.execute(
    "SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name"
  );
  return new Set(result.rows.map((r) => r.migration_name));
}

async function getPendingMigrations(applied) {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const pending = [];
  for (const dir of dirs) {
    if (!applied.has(dir)) {
      const sqlPath = join(migrationsDir, dir, "migration.sql");
      try {
        const sql = await readFile(sqlPath, "utf-8");
        pending.push({ name: dir, sql });
      } catch {
        // No migration.sql in this directory — skip
      }
    }
  }
  return pending;
}

async function applyMigration({ name, sql }) {
  const startedAt = new Date().toISOString();
  const id = randomUUID();

  // Split on semicolons and execute each statement (libsql doesn't support multi-statement execute)
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err) {
      // Tolerate "already exists" errors for idempotent re-runs
      const msg = err.message || "";
      if (msg.includes("already exists") || msg.includes("duplicate column name")) {
        console.log(`     ⚠️  Skipped (already exists): ${stmt.slice(0, 80)}...`);
        continue;
      }
      throw err;
    }
  }

  // Record the migration
  await client.execute({
    sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, "", new Date().toISOString(), name, startedAt, statements.length],
  });
}

async function main() {
  console.log("🔄 Deploying migrations to Turso...");

  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  console.log(`   ${applied.size} migration(s) already applied.`);

  const pending = await getPendingMigrations(applied);
  if (pending.length === 0) {
    console.log("✅ No pending migrations — database is up to date.");
    return;
  }

  console.log(`   ${pending.length} pending migration(s) to apply:\n`);
  for (const m of pending) {
    console.log(`   → Applying: ${m.name}`);
    await applyMigration(m);
    console.log(`     ✅ Done.`);
  }

  console.log(`\n✅ All ${pending.length} migration(s) applied successfully.`);
}

main()
  .catch((err) => {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  })
  .finally(() => {
    client.close();
  });
