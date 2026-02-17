// setup-turso.mjs - Apply migrations to Turso database
// Usage: DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/setup-turso.mjs

import { createClient } from "@libsql/client/web";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const dbUrl = process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !dbUrl.startsWith("libsql://")) {
  console.error("ERROR: DATABASE_URL must be a libsql:// URL");
  process.exit(1);
}
if (!authToken) {
  console.error("ERROR: TURSO_AUTH_TOKEN is required");
  process.exit(1);
}

const client = createClient({ url: dbUrl, authToken });

// Get migration directories sorted by name (timestamp order)
const migrationsDir = path.join(projectRoot, "prisma", "migrations");
const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "_journal")
  .sort((a, b) => a.name.localeCompare(b.name));

console.log(`Found ${migrationDirs.length} migrations to apply...\n`);

for (const dir of migrationDirs) {
  const sqlPath = path.join(migrationsDir, dir.name, "migration.sql");
  let sql;
  try {
    sql = readFileSync(sqlPath, "utf-8");
  } catch {
    console.log(`  Skipping ${dir.name} (no migration.sql)`);
    continue;
  }

  console.log(`Applying: ${dir.name}`);

  // Split into statements, preserving multi-line CREATE TABLE etc.
  const statements = [];
  let current = "";
  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith("--")) continue;
    // Skip PRAGMA (not supported by Turso)
    if (trimmed.toUpperCase().startsWith("PRAGMA")) continue;

    current += line + "\n";
    if (trimmed.endsWith(";")) {
      const stmt = current.trim().replace(/;$/, "").trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      current = "";
    }
  }

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err) {
      // Ignore "already exists" errors for idempotency
      if (
        err.message?.includes("already exists") ||
        err.message?.includes("duplicate column")
      ) {
        console.log(`  (skipped - already exists)`);
      } else {
        console.error(`  ERROR: ${err.message}`);
        console.error(`  Statement: ${stmt.slice(0, 200)}...`);
        process.exit(1);
      }
    }
  }
  console.log(`  OK`);
}

console.log("\nAll migrations applied successfully!");
console.log(
  "Now run the seed script with the same env vars to populate data."
);
