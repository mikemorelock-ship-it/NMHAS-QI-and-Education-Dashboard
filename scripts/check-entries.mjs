import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
const { PrismaClient } = await import("../src/generated/prisma/client.ts");

const dbUrl = `file:${path.join(projectRoot, "dev.db")}`;
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check total entries
  const total = await prisma.metricEntry.count();
  console.log("Total metric entries:", total);
  console.log("");

  // Check all recent entries
  const entries = await prisma.metricEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      metricDefinition: { select: { name: true, parentId: true, departmentId: true } },
      department: { select: { name: true } },
      division: { select: { name: true } },
    },
  });

  console.log("Recent entries:");
  for (const e of entries) {
    const isChild = e.metricDefinition.parentId ? "CHILD" : "root";
    console.log(
      `  ${e.id.slice(0, 8)} | ${e.metricDefinition.name.padEnd(30)} | ${e.department.name.padEnd(20)} | ${e.periodStart.toISOString().slice(0, 10)} | val=${e.value} | ${isChild} | div=${e.division?.name ?? "none"}`
    );
  }

  console.log("");

  // Check child metrics specifically
  const childMetrics = await prisma.metricDefinition.findMany({
    where: { parentId: { not: null } },
    select: { id: true, name: true, parentId: true, departmentId: true, isActive: true },
  });

  console.log("Child metrics in DB:");
  for (const m of childMetrics) {
    const entryCount = await prisma.metricEntry.count({
      where: { metricDefinitionId: m.id },
    });
    console.log(`  ${m.id.slice(0, 8)} | ${m.name.padEnd(30)} | active=${m.isActive} | entries=${entryCount} | parent=${m.parentId?.slice(0, 8)}`);
  }

  console.log("");

  // Check the parent metric
  if (childMetrics.length > 0) {
    const parentId = childMetrics[0].parentId;
    const parent = await prisma.metricDefinition.findUnique({
      where: { id: parentId },
      select: { id: true, name: true, departmentId: true },
    });
    console.log("Parent metric:", parent?.name, "| id:", parent?.id.slice(0, 8));

    const parentEntries = await prisma.metricEntry.count({
      where: { metricDefinitionId: parentId },
    });
    console.log("Parent entry count:", parentEntries);
  }

  // Check the data entry page query - does it filter out child metrics?
  const dataEntryMetrics = await prisma.metricDefinition.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, departmentId: true, unit: true, periodType: true, parentId: true },
  });

  console.log("\nMetrics available in data entry page (isActive: true):");
  for (const m of dataEntryMetrics) {
    const tag = m.parentId ? "CHILD" : "root";
    console.log(`  ${m.id.slice(0, 8)} | ${m.name.padEnd(35)} | ${tag}`);
  }

  // Check recent entries query - same as what data entry page uses
  const recentEntries = await prisma.metricEntry.findMany({
    take: 100,
    orderBy: { periodStart: "desc" },
    include: {
      metricDefinition: { select: { name: true, unit: true } },
      department: { select: { name: true } },
      division: { select: { name: true } },
      individual: { select: { name: true } },
    },
  });

  console.log("\nRecent entries (data entry page query):", recentEntries.length, "entries");
  for (const e of recentEntries.slice(0, 15)) {
    console.log(
      `  ${e.metricDefinition.name.padEnd(30)} | ${e.department.name.padEnd(20)} | ${e.periodStart.toISOString().slice(0, 10)} | val=${e.value}`
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
