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

const libsql = createClient({ url: dbUrl, authToken });
const adapter = new PrismaLibSQL(libsql);
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
