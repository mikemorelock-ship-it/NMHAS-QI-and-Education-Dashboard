// delete-metric-entries.mjs - Delete all metricEntry rows from the database

import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
const { PrismaClient } = await import("../src/generated/prisma/client.ts");

const dbUrl = `file:${path.join(projectRoot, "dev.db")}`;
console.log("Using database:", dbUrl);

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
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
