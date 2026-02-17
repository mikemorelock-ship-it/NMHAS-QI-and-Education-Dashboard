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
  const childMetrics = await prisma.metricDefinition.findMany({
    where: { parentId: { not: null } },
    include: { department: { select: { name: true, id: true } }, parent: { select: { name: true, departmentId: true } } },
  });

  for (const m of childMetrics) {
    console.log(`Child: ${m.name}`);
    console.log(`  Child departmentId:  ${m.departmentId} (${m.department.name})`);
    console.log(`  Parent departmentId: ${m.parent?.departmentId}`);
    console.log(`  Match: ${m.departmentId === m.parent?.departmentId}`);
    console.log(`  Child ID: ${m.id}`);
    console.log("");
  }

  // Also check audit logs for any failed entries
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log("Recent audit logs:");
  for (const log of auditLogs) {
    console.log(`  ${log.action} | ${log.entity} | ${log.details?.slice(0, 80)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
