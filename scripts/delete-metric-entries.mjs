// delete-metric-entries.mjs - Delete all metricEntry rows from the database

import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
const { createClient } = await import("@libsql/client");
const { PrismaClient } = await import("../src/generated/prisma/client.ts");

import { readFileSync } from "node:fs";
let dbUrl;
let authToken;
try {
  const envContent = readFileSync(path.join(projectRoot, ".env"), "utf-8");
  const urlMatch = envContent.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  dbUrl = urlMatch ? urlMatch[1] : `file:${path.join(projectRoot, "dev.db")}`;
  const tokenMatch = envContent.match(/^TURSO_AUTH_TOKEN="?([^"\r\n]+)"?/m);
  authToken = tokenMatch ? tokenMatch[1] : undefined;
} catch {
  dbUrl = `file:${path.join(projectRoot, "dev.db")}`;
}
console.log("Using database:", dbUrl);

const libsql = createClient({ url: dbUrl, authToken });
const adapter = new PrismaLibSQL(libsql);
const prisma = new PrismaClient({ adapter });

try {
  // Count before delete
  const beforeCount = await prisma.metricEntry.count();
  console.log(`MetricEntry rows before delete: ${beforeCount}`);

  // Delete all metric entries
  const result = await prisma.metricEntry.deleteMany();
  console.log(`Deleted ${result.count} metricEntry rows.`);

  // Verify
  const afterCount = await prisma.metricEntry.count();
  console.log(`MetricEntry rows after delete: ${afterCount}`);
} finally {
  await prisma.$disconnect();
}
