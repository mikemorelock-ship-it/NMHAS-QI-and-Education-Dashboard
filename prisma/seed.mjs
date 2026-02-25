// seed.mjs - ESM seed script for Prisma v7 with better-sqlite3 or libsql adapter
// Unified User model — all users share email+password auth (password: Admin123!)

import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const { PrismaClient } = await import("../src/generated/prisma/client.ts");
const bcrypt = await import("bcryptjs");

import { readFileSync } from "node:fs";
let dbUrl;
try {
  const envContent = readFileSync(path.join(projectRoot, ".env"), "utf-8");
  const urlMatch = envContent.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  dbUrl = urlMatch ? urlMatch[1] : `file:${path.join(projectRoot, "dev.db")}`;
} catch {
  dbUrl = `file:${path.join(projectRoot, "dev.db")}`;
}
// Allow env vars to override .env file (for CI/scripts)
dbUrl = process.env.DATABASE_URL || dbUrl;
console.log("Using database:", dbUrl);

let adapter;
if (dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://")) {
  // Use web-compatible adapter (no native binary required)
  const { PrismaLibSql } = await import("@prisma/adapter-libsql/web");
  adapter = new PrismaLibSql({
    url: dbUrl,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
} else {
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  adapter = new PrismaBetterSqlite3({ url: dbUrl });
}
const prisma = new PrismaClient({ adapter });

// Generic password for all seed users (meets requirements: 8+ chars, upper, lower, number, special)
const SEED_PASSWORD = "Admin123!";
const seedPasswordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

async function main() {
  console.log("Clearing all site data...\n");

  // Delete all data from every table (order matters for foreign keys)
  await prisma.traineeCoachingAssignment.deleteMany();
  await prisma.coachingActivity.deleteMany();
  await prisma.traineeSnapshot.deleteMany();
  await prisma.skillSignoff.deleteMany();
  await prisma.skillStep.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.skillCategory.deleteMany();
  await prisma.evaluationRating.deleteMany();
  await prisma.dailyEvaluation.deleteMany();
  await prisma.evaluationCategory.deleteMany();
  await prisma.traineePhase.deleteMany();
  await prisma.trainingPhase.deleteMany();
  await prisma.trainingAssignment.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.pdsaCycle.deleteMany();
  await prisma.driverNode.deleteMany();
  await prisma.driverDiagram.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.metricAssociation.deleteMany();
  await prisma.scorecardMetric.deleteMany();
  await prisma.scorecardDivision.deleteMany();
  await prisma.scorecardRegion.deleteMany();
  await prisma.scorecard.deleteMany();
  await prisma.metricEntry.deleteMany();
  await prisma.metricAnnotation.deleteMany();
  await prisma.metricResource.deleteMany();
  await prisma.metricResponsibleParty.deleteMany();
  await prisma.metricDefinition.deleteMany();
  await prisma.category.deleteMany();
  await prisma.region.deleteMany();
  await prisma.division.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.department.deleteMany();
  await prisma.loginAttempt.deleteMany();
  console.log("  All data cleared.\n");

  // Create a single admin user so the site remains accessible
  console.log("Creating admin user...");
  await prisma.user.create({
    data: {
      email: "michael.morelock@northmemorial.com",
      passwordHash: seedPasswordHash,
      firstName: "Michael",
      lastName: "Morelock",
      role: "admin",
      status: "active",
    },
  });
  console.log("  Admin: michael.morelock@northmemorial.com (password: Admin123!)\n");

  console.log("Done. Database is clean with one admin user.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
