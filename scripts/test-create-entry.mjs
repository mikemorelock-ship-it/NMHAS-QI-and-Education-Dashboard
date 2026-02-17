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
  // Test creating an entry for OMD Clinical Debrief
  const omdId = "cmlle0v4z001zfotksmlewb7v";
  const deptId = "cmlle0uf10000fotkk6vth8ed";

  try {
    const entry = await prisma.metricEntry.create({
      data: {
        metricDefinitionId: omdId,
        departmentId: deptId,
        divisionId: null,
        individualId: null,
        periodType: "monthly",
        periodStart: new Date("2026-01-01T12:00:00.000Z"),
        value: 7,
        notes: "test entry",
      },
    });
    console.log("SUCCESS: Created entry:", entry.id);

    // Clean up test entry
    await prisma.metricEntry.delete({ where: { id: entry.id } });
    console.log("Cleaned up test entry");
  } catch (err) {
    console.error("FAILED:", err.message);
  }

  // Count entries
  const count = await prisma.metricEntry.count();
  console.log("Total entries:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
