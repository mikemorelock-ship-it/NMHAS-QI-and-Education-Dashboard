// seed.mjs - ESM seed script for Prisma v7 with better-sqlite3 or libsql adapter
// Populates departments, divisions, regions, categories, metrics, entries, and scorecards
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

// ---------------------------------------------------------------------------
// Helper: generate monthly metric values with realistic variation
// ---------------------------------------------------------------------------
function generateMonthlyValues(baseValue, variance, months, trend = 0) {
  const values = [];
  for (let i = 0; i < months; i++) {
    const trendAdjust = trend * i;
    const noise = (Math.random() - 0.5) * 2 * variance;
    values.push(Math.round((baseValue + trendAdjust + noise) * 100) / 100);
  }
  return values;
}

function generatePercentageValues(baseValue, variance, months, trend = 0) {
  return generateMonthlyValues(baseValue, variance, months, trend).map((v) =>
    Math.min(100, Math.max(0, Math.round(v * 10) / 10))
  );
}

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
  await prisma.metricYearTarget.deleteMany();
  await prisma.metricDefinition.deleteMany();
  await prisma.category.deleteMany();
  await prisma.region.deleteMany();
  await prisma.division.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.department.deleteMany();
  await prisma.loginAttempt.deleteMany();
  console.log("  All data cleared.\n");

  // =========================================================================
  // 1. Admin user
  // =========================================================================
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

  // =========================================================================
  // 2. Departments (organizational backbone — hidden in UI)
  // =========================================================================
  console.log("Creating departments...");
  const deptOperations = await prisma.department.create({
    data: {
      name: "EMS Operations",
      slug: "ems-operations",
      type: "operations",
      description: "Core EMS operational metrics",
      sortOrder: 1,
      isActive: true,
    },
  });
  const deptQuality = await prisma.department.create({
    data: {
      name: "Quality Improvement",
      slug: "quality-improvement",
      type: "quality",
      description: "Quality assurance and improvement metrics",
      sortOrder: 2,
      isActive: true,
    },
  });
  const deptClinical = await prisma.department.create({
    data: {
      name: "Clinical Development",
      slug: "clinical-development",
      type: "clinical",
      description: "Clinical training and development metrics",
      sortOrder: 3,
      isActive: true,
    },
  });
  const deptEducation = await prisma.department.create({
    data: {
      name: "Education",
      slug: "education",
      type: "education",
      description: "FTO education and training program metrics",
      sortOrder: 4,
      isActive: true,
    },
  });
  console.log("  Created 4 departments.\n");

  // =========================================================================
  // 3. Divisions (top-level units shown in UI)
  // =========================================================================
  console.log("Creating divisions...");
  const divAirCare = await prisma.division.create({
    data: {
      name: "Air Care Clinical",
      slug: "air-care-clinical",
      departmentId: deptOperations.id,
      sortOrder: 1,
      isActive: true,
    },
  });
  const divGroundAmb = await prisma.division.create({
    data: {
      name: "Ground Ambulance",
      slug: "ground-ambulance",
      departmentId: deptOperations.id,
      sortOrder: 2,
      isActive: true,
    },
  });
  const divComHealth = await prisma.division.create({
    data: {
      name: "Community Health",
      slug: "community-health",
      departmentId: deptOperations.id,
      sortOrder: 3,
      isActive: true,
    },
  });
  const divQI = await prisma.division.create({
    data: {
      name: "Quality Improvement",
      slug: "quality-improvement",
      departmentId: deptQuality.id,
      sortOrder: 4,
      isActive: true,
    },
  });
  console.log("  Created 4 divisions.\n");

  // =========================================================================
  // 4. Regions (departments in UI — granular units under divisions)
  // =========================================================================
  console.log("Creating regions (departments in UI)...");
  const regAC1 = await prisma.region.create({
    data: { name: "AC 1", divisionId: divAirCare.id, isActive: true },
  });
  const regAC2 = await prisma.region.create({
    data: { name: "AC 2", divisionId: divAirCare.id, isActive: true },
  });
  const regBrainerd = await prisma.region.create({
    data: { name: "Brainerd", divisionId: divGroundAmb.id, isActive: true },
  });
  const regRobbinsdale = await prisma.region.create({
    data: { name: "Robbinsdale", divisionId: divGroundAmb.id, isActive: true },
  });
  const regBuffalo = await prisma.region.create({
    data: { name: "Buffalo", divisionId: divGroundAmb.id, isActive: true },
  });
  const regMonticello = await prisma.region.create({
    data: { name: "Monticello", divisionId: divGroundAmb.id, isActive: true },
  });
  const regCommunity = await prisma.region.create({
    data: { name: "Community Programs", divisionId: divComHealth.id, isActive: true },
  });
  const regQIDept = await prisma.region.create({
    data: { name: "QI Department", divisionId: divQI.id, isActive: true },
  });
  console.log("  Created 8 regions.\n");

  // =========================================================================
  // 5. Categories (for metric grouping)
  // =========================================================================
  console.log("Creating categories...");
  const catResponse = await prisma.category.create({
    data: { name: "Response Times", slug: "response-times", sortOrder: 1, color: "#00b0ad" },
  });
  const catClinical = await prisma.category.create({
    data: { name: "Clinical Quality", slug: "clinical-quality", sortOrder: 2, color: "#e04726" },
  });
  const catPatientSafety = await prisma.category.create({
    data: { name: "Patient Safety", slug: "patient-safety", sortOrder: 3, color: "#fcb526" },
  });
  const catVolume = await prisma.category.create({
    data: {
      name: "Volume & Utilization",
      slug: "volume-utilization",
      sortOrder: 4,
      color: "#4b4f54",
    },
  });
  const catEducation = await prisma.category.create({
    data: {
      name: "Education & Training",
      slug: "education-training",
      sortOrder: 5,
      color: "#00383d",
    },
  });
  console.log("  Created 5 categories.\n");

  // =========================================================================
  // 6. Metric Definitions (KPIs and regular metrics)
  // =========================================================================
  console.log("Creating metric definitions...");

  // --- Operations KPIs ---
  const metricResponseTime = await prisma.metricDefinition.create({
    data: {
      name: "Response Time",
      slug: "response-time",
      departmentId: deptOperations.id,
      categoryId: catResponse.id,
      categoryLegacy: "Response Times",
      description: "Average response time from dispatch to on-scene",
      unit: "duration",
      chartType: "line",
      periodType: "monthly",
      isKpi: true,
      target: 8.0,
      aggregationType: "average",
      dataType: "continuous",
      desiredDirection: "down",
      sortOrder: 1,
      isActive: true,
    },
  });

  const metricTransportCount = await prisma.metricDefinition.create({
    data: {
      name: "Total Transports",
      slug: "total-transports",
      departmentId: deptOperations.id,
      categoryId: catVolume.id,
      categoryLegacy: "Volume & Utilization",
      description: "Total number of patient transports",
      unit: "count",
      chartType: "bar",
      periodType: "monthly",
      isKpi: true,
      target: 1200,
      aggregationType: "sum",
      dataType: "continuous",
      desiredDirection: "up",
      sortOrder: 2,
      isActive: true,
    },
  });

  const metricOnTimePerf = await prisma.metricDefinition.create({
    data: {
      name: "On-Time Performance",
      slug: "on-time-performance",
      departmentId: deptOperations.id,
      categoryId: catResponse.id,
      categoryLegacy: "Response Times",
      description: "Percentage of responses within target time",
      unit: "percentage",
      chartType: "line",
      periodType: "monthly",
      isKpi: true,
      target: 90,
      aggregationType: "average",
      dataType: "proportion",
      desiredDirection: "up",
      sortOrder: 3,
      isActive: true,
    },
  });

  const metricUnitHourUtil = await prisma.metricDefinition.create({
    data: {
      name: "Unit Hour Utilization",
      slug: "unit-hour-utilization",
      departmentId: deptOperations.id,
      categoryId: catVolume.id,
      categoryLegacy: "Volume & Utilization",
      description: "Ratio of productive time to total staffed hours",
      unit: "percentage",
      chartType: "area",
      periodType: "monthly",
      isKpi: true,
      target: 35,
      aggregationType: "average",
      dataType: "proportion",
      desiredDirection: "up",
      sortOrder: 4,
      isActive: true,
    },
  });

  // --- Quality KPIs ---
  const metricProtocolComp = await prisma.metricDefinition.create({
    data: {
      name: "Protocol Compliance",
      slug: "protocol-compliance",
      departmentId: deptQuality.id,
      categoryId: catClinical.id,
      categoryLegacy: "Clinical Quality",
      description: "Percentage of calls meeting protocol compliance standards",
      unit: "percentage",
      chartType: "line",
      periodType: "monthly",
      isKpi: true,
      target: 95,
      aggregationType: "average",
      dataType: "proportion",
      desiredDirection: "up",
      sortOrder: 5,
      isActive: true,
    },
  });

  const metricPatientSafety = await prisma.metricDefinition.create({
    data: {
      name: "Patient Safety Events",
      slug: "patient-safety-events",
      departmentId: deptQuality.id,
      categoryId: catPatientSafety.id,
      categoryLegacy: "Patient Safety",
      description: "Number of reported patient safety events per month",
      unit: "count",
      chartType: "bar",
      periodType: "monthly",
      isKpi: true,
      target: 3,
      aggregationType: "sum",
      dataType: "continuous",
      desiredDirection: "down",
      sortOrder: 6,
      isActive: true,
    },
  });

  const metricChartCompletion = await prisma.metricDefinition.create({
    data: {
      name: "Chart Completion Rate",
      slug: "chart-completion-rate",
      departmentId: deptQuality.id,
      categoryId: catClinical.id,
      categoryLegacy: "Clinical Quality",
      description: "Percentage of patient charts completed within 24 hours",
      unit: "percentage",
      chartType: "line",
      periodType: "monthly",
      isKpi: true,
      target: 98,
      aggregationType: "average",
      dataType: "proportion",
      desiredDirection: "up",
      sortOrder: 7,
      isActive: true,
    },
  });

  // --- Clinical Development KPIs ---
  const metricCertCurrent = await prisma.metricDefinition.create({
    data: {
      name: "Certification Currency",
      slug: "certification-currency",
      departmentId: deptClinical.id,
      categoryId: catEducation.id,
      categoryLegacy: "Education & Training",
      description: "Percentage of staff with current certifications",
      unit: "percentage",
      chartType: "line",
      periodType: "monthly",
      isKpi: true,
      target: 100,
      aggregationType: "average",
      dataType: "proportion",
      desiredDirection: "up",
      sortOrder: 8,
      isActive: true,
    },
  });

  const metricTrainingHours = await prisma.metricDefinition.create({
    data: {
      name: "Training Hours",
      slug: "training-hours",
      departmentId: deptClinical.id,
      categoryId: catEducation.id,
      categoryLegacy: "Education & Training",
      description: "Average training hours per provider per month",
      unit: "duration",
      chartType: "bar",
      periodType: "monthly",
      isKpi: true,
      target: 12,
      aggregationType: "average",
      dataType: "continuous",
      desiredDirection: "up",
      sortOrder: 9,
      isActive: true,
    },
  });

  // --- Education KPIs ---
  const metricFTOCompRate = await prisma.metricDefinition.create({
    data: {
      name: "FTO Completion Rate",
      slug: "fto-completion-rate",
      departmentId: deptEducation.id,
      categoryId: catEducation.id,
      categoryLegacy: "Education & Training",
      description: "Percentage of FTO trainees who complete the program",
      unit: "percentage",
      chartType: "line",
      periodType: "monthly",
      isKpi: true,
      target: 85,
      aggregationType: "average",
      dataType: "proportion",
      desiredDirection: "up",
      sortOrder: 10,
      isActive: true,
    },
  });

  // Additional non-KPI metrics
  const metricMileage = await prisma.metricDefinition.create({
    data: {
      name: "Average Mileage per Transport",
      slug: "avg-mileage-per-transport",
      departmentId: deptOperations.id,
      categoryId: catVolume.id,
      categoryLegacy: "Volume & Utilization",
      description: "Average miles per transport run",
      unit: "count",
      chartType: "line",
      periodType: "monthly",
      isKpi: false,
      target: 15,
      aggregationType: "average",
      dataType: "continuous",
      desiredDirection: "down",
      sortOrder: 11,
      isActive: true,
    },
  });

  const metricCallVolume = await prisma.metricDefinition.create({
    data: {
      name: "911 Call Volume",
      slug: "911-call-volume",
      departmentId: deptOperations.id,
      categoryId: catVolume.id,
      categoryLegacy: "Volume & Utilization",
      description: "Total 911 calls received per month",
      unit: "count",
      chartType: "bar",
      periodType: "monthly",
      isKpi: false,
      target: 1500,
      aggregationType: "sum",
      dataType: "continuous",
      desiredDirection: "up",
      sortOrder: 12,
      isActive: true,
    },
  });

  console.log("  Created 12 metric definitions (10 KPIs + 2 regular metrics).\n");

  // =========================================================================
  // 7. Metric Associations (which metrics appear under which divisions/regions)
  // =========================================================================
  console.log("Creating metric associations...");

  // Operations metrics -> Ground Ambulance + Air Care divisions + their regions
  const opsMetrics = [
    metricResponseTime,
    metricTransportCount,
    metricOnTimePerf,
    metricUnitHourUtil,
    metricMileage,
    metricCallVolume,
  ];
  const opsDivisions = [
    { div: divGroundAmb, regions: [regBrainerd, regRobbinsdale, regBuffalo, regMonticello] },
    { div: divAirCare, regions: [regAC1, regAC2] },
  ];

  for (const metric of opsMetrics) {
    for (const { div, regions } of opsDivisions) {
      await prisma.metricAssociation.create({
        data: { metricDefinitionId: metric.id, divisionId: div.id },
      });
      for (const region of regions) {
        await prisma.metricAssociation.create({
          data: { metricDefinitionId: metric.id, regionId: region.id },
        });
      }
    }
  }

  // Quality metrics -> all divisions
  const qualityMetrics = [metricProtocolComp, metricPatientSafety, metricChartCompletion];
  for (const metric of qualityMetrics) {
    for (const { div, regions } of opsDivisions) {
      await prisma.metricAssociation.create({
        data: { metricDefinitionId: metric.id, divisionId: div.id },
      });
      for (const region of regions) {
        await prisma.metricAssociation.create({
          data: { metricDefinitionId: metric.id, regionId: region.id },
        });
      }
    }
    // Also associate with QI division
    await prisma.metricAssociation.create({
      data: { metricDefinitionId: metric.id, divisionId: divQI.id },
    });
    await prisma.metricAssociation.create({
      data: { metricDefinitionId: metric.id, regionId: regQIDept.id },
    });
  }

  // Clinical metrics -> operations divisions
  const clinicalMetrics = [metricCertCurrent, metricTrainingHours];
  for (const metric of clinicalMetrics) {
    for (const { div, regions } of opsDivisions) {
      await prisma.metricAssociation.create({
        data: { metricDefinitionId: metric.id, divisionId: div.id },
      });
      for (const region of regions) {
        await prisma.metricAssociation.create({
          data: { metricDefinitionId: metric.id, regionId: region.id },
        });
      }
    }
  }

  // Community Health division + region associations
  const communityMetrics = [
    metricTransportCount,
    metricOnTimePerf,
    metricProtocolComp,
    metricChartCompletion,
  ];
  for (const metric of communityMetrics) {
    await prisma.metricAssociation.create({
      data: { metricDefinitionId: metric.id, divisionId: divComHealth.id },
    });
    await prisma.metricAssociation.create({
      data: { metricDefinitionId: metric.id, regionId: regCommunity.id },
    });
  }

  // FTO metric -> all operational divisions
  await prisma.metricAssociation.create({
    data: { metricDefinitionId: metricFTOCompRate.id, divisionId: divGroundAmb.id },
  });
  await prisma.metricAssociation.create({
    data: { metricDefinitionId: metricFTOCompRate.id, divisionId: divAirCare.id },
  });
  for (const region of [regBrainerd, regRobbinsdale, regBuffalo, regMonticello, regAC1, regAC2]) {
    await prisma.metricAssociation.create({
      data: { metricDefinitionId: metricFTOCompRate.id, regionId: region.id },
    });
  }

  console.log("  Created metric associations.\n");

  // =========================================================================
  // 8. Metric Entries (12 months of data for 2025 and 3 months for 2026)
  // =========================================================================
  console.log("Creating metric entries (15 months of data)...");

  const MONTHS = 15; // Jan 2025 - Mar 2026

  // Helper to create entries for each region
  async function createRegionEntries(metric, dept, divisionId, regionId, values) {
    for (let i = 0; i < values.length; i++) {
      const year = i < 12 ? 2025 : 2026;
      const month = i < 12 ? i : i - 12;
      const periodStart = new Date(Date.UTC(year, month, 1, 12, 0, 0));
      await prisma.metricEntry.create({
        data: {
          metricDefinitionId: metric.id,
          departmentId: dept.id,
          divisionId,
          regionId,
          periodType: "monthly",
          periodStart,
          value: values[i],
          numerator: metric.dataType === "proportion" ? Math.round(values[i] * 10) : null,
          denominator: metric.dataType === "proportion" ? 1000 : null,
        },
      });
    }
  }

  // --- Response Time entries (target: 8 min, lower is better) ---
  for (const { div, regions } of opsDivisions) {
    for (const region of regions) {
      const vals = generateMonthlyValues(7.5, 1.5, MONTHS, -0.05);
      await createRegionEntries(metricResponseTime, deptOperations, div.id, region.id, vals);
    }
  }

  // --- Total Transports (target: 1200, sum, higher is better) ---
  const transportBases = {
    [regBrainerd.id]: 320,
    [regRobbinsdale.id]: 380,
    [regBuffalo.id]: 220,
    [regMonticello.id]: 180,
    [regAC1.id]: 90,
    [regAC2.id]: 85,
    [regCommunity.id]: 150,
  };
  for (const { div, regions } of [
    ...opsDivisions,
    { div: divComHealth, regions: [regCommunity] },
  ]) {
    for (const region of regions) {
      const base = transportBases[region.id] || 200;
      const vals = generateMonthlyValues(base, base * 0.1, MONTHS, 2);
      await createRegionEntries(
        metricTransportCount,
        deptOperations,
        div.id,
        region.id,
        vals.map((v) => Math.round(v))
      );
    }
  }

  // --- On-Time Performance (target: 90%, higher is better) ---
  for (const { div, regions } of [
    ...opsDivisions,
    { div: divComHealth, regions: [regCommunity] },
  ]) {
    for (const region of regions) {
      const vals = generatePercentageValues(88, 5, MONTHS, 0.3);
      await createRegionEntries(metricOnTimePerf, deptOperations, div.id, region.id, vals);
    }
  }

  // --- Unit Hour Utilization (target: 35%, higher is better) ---
  for (const { div, regions } of opsDivisions) {
    for (const region of regions) {
      const vals = generatePercentageValues(33, 4, MONTHS, 0.2);
      await createRegionEntries(metricUnitHourUtil, deptOperations, div.id, region.id, vals);
    }
  }

  // --- Protocol Compliance (target: 95%, higher is better) ---
  for (const { div, regions } of [
    ...opsDivisions,
    { div: divComHealth, regions: [regCommunity] },
    { div: divQI, regions: [regQIDept] },
  ]) {
    for (const region of regions) {
      const vals = generatePercentageValues(93, 3, MONTHS, 0.15);
      await createRegionEntries(metricProtocolComp, deptQuality, div.id, region.id, vals);
    }
  }

  // --- Patient Safety Events (target: 3, lower is better) ---
  for (const { div, regions } of [...opsDivisions, { div: divQI, regions: [regQIDept] }]) {
    for (const region of regions) {
      const vals = generateMonthlyValues(2.5, 2, MONTHS, -0.05).map((v) =>
        Math.max(0, Math.round(v))
      );
      await createRegionEntries(metricPatientSafety, deptQuality, div.id, region.id, vals);
    }
  }

  // --- Chart Completion Rate (target: 98%, higher is better) ---
  for (const { div, regions } of [
    ...opsDivisions,
    { div: divComHealth, regions: [regCommunity] },
    { div: divQI, regions: [regQIDept] },
  ]) {
    for (const region of regions) {
      const vals = generatePercentageValues(96, 2, MONTHS, 0.1);
      await createRegionEntries(metricChartCompletion, deptQuality, div.id, region.id, vals);
    }
  }

  // --- Certification Currency (target: 100%, higher is better) ---
  for (const { div, regions } of opsDivisions) {
    for (const region of regions) {
      const vals = generatePercentageValues(97, 2, MONTHS, 0.1);
      await createRegionEntries(metricCertCurrent, deptClinical, div.id, region.id, vals);
    }
  }

  // --- Training Hours (target: 12 hrs, higher is better) ---
  for (const { div, regions } of opsDivisions) {
    for (const region of regions) {
      const vals = generateMonthlyValues(10, 3, MONTHS, 0.15);
      await createRegionEntries(metricTrainingHours, deptClinical, div.id, region.id, vals);
    }
  }

  // --- FTO Completion Rate (target: 85%, higher is better) ---
  for (const region of [regBrainerd, regRobbinsdale, regBuffalo, regMonticello, regAC1, regAC2]) {
    const divId = [regAC1.id, regAC2.id].includes(region.id) ? divAirCare.id : divGroundAmb.id;
    const vals = generatePercentageValues(82, 8, MONTHS, 0.3);
    await createRegionEntries(metricFTOCompRate, deptEducation, divId, region.id, vals);
  }

  // --- Non-KPI: Average Mileage per Transport ---
  for (const { div, regions } of opsDivisions) {
    for (const region of regions) {
      const vals = generateMonthlyValues(14, 3, MONTHS, 0);
      await createRegionEntries(metricMileage, deptOperations, div.id, region.id, vals);
    }
  }

  // --- Non-KPI: 911 Call Volume ---
  for (const { div, regions } of opsDivisions) {
    for (const region of regions) {
      const base = region.id === regRobbinsdale.id ? 400 : region.id === regBrainerd.id ? 350 : 200;
      const vals = generateMonthlyValues(base, base * 0.12, MONTHS, 1.5).map((v) => Math.round(v));
      await createRegionEntries(metricCallVolume, deptOperations, div.id, region.id, vals);
    }
  }

  console.log("  Created metric entries for 15 months across all regions.\n");

  // =========================================================================
  // 9. Year-specific targets for 2026
  // =========================================================================
  console.log("Creating year-specific targets for 2026...");
  const yearTargets = [
    { metricDefinitionId: metricResponseTime.id, year: 2026, target: 7.5 },
    { metricDefinitionId: metricTransportCount.id, year: 2026, target: 1300 },
    { metricDefinitionId: metricOnTimePerf.id, year: 2026, target: 92 },
    { metricDefinitionId: metricProtocolComp.id, year: 2026, target: 96 },
    { metricDefinitionId: metricChartCompletion.id, year: 2026, target: 99 },
  ];
  for (const yt of yearTargets) {
    await prisma.metricYearTarget.create({ data: yt });
  }
  console.log("  Created 5 year-specific targets.\n");

  // =========================================================================
  // 10. Scorecards (preset filter views)
  // =========================================================================
  console.log("Creating scorecards...");

  const scorecardAll = await prisma.scorecard.create({
    data: {
      name: "All Operations",
      slug: "all-operations",
      description: "Complete view of all operational KPIs",
      sortOrder: 1,
      isActive: true,
    },
  });

  const scorecardGround = await prisma.scorecard.create({
    data: {
      name: "Ground Ambulance",
      slug: "ground-ambulance",
      description: "Ground ambulance division scorecard",
      sortOrder: 2,
      isActive: true,
    },
  });

  const scorecardAirCare = await prisma.scorecard.create({
    data: {
      name: "Air Care",
      slug: "air-care",
      description: "Air Care clinical division scorecard",
      sortOrder: 3,
      isActive: true,
    },
  });

  const scorecardQuality = await prisma.scorecard.create({
    data: {
      name: "Quality Metrics",
      slug: "quality-metrics",
      description: "Quality improvement scorecard",
      sortOrder: 4,
      isActive: true,
    },
  });

  console.log("  Created 4 scorecards.\n");

  // =========================================================================
  // 11. Scorecard Divisions (link scorecards to divisions)
  // =========================================================================
  console.log("Linking scorecards to divisions...");
  await prisma.scorecardDivision.createMany({
    data: [
      { scorecardId: scorecardAll.id, divisionId: divGroundAmb.id },
      { scorecardId: scorecardAll.id, divisionId: divAirCare.id },
      { scorecardId: scorecardAll.id, divisionId: divComHealth.id },
      { scorecardId: scorecardGround.id, divisionId: divGroundAmb.id },
      { scorecardId: scorecardAirCare.id, divisionId: divAirCare.id },
      { scorecardId: scorecardQuality.id, divisionId: divGroundAmb.id },
      { scorecardId: scorecardQuality.id, divisionId: divAirCare.id },
      { scorecardId: scorecardQuality.id, divisionId: divQI.id },
    ],
  });
  console.log("  Linked scorecards to divisions.\n");

  // =========================================================================
  // 12. Scorecard Regions (link scorecards to specific departments)
  // =========================================================================
  console.log("Linking scorecards to regions...");
  await prisma.scorecardRegion.createMany({
    data: [
      { scorecardId: scorecardGround.id, regionId: regBrainerd.id },
      { scorecardId: scorecardGround.id, regionId: regRobbinsdale.id },
      { scorecardId: scorecardGround.id, regionId: regBuffalo.id },
      { scorecardId: scorecardGround.id, regionId: regMonticello.id },
      { scorecardId: scorecardAirCare.id, regionId: regAC1.id },
      { scorecardId: scorecardAirCare.id, regionId: regAC2.id },
    ],
  });
  console.log("  Linked scorecards to regions.\n");

  // =========================================================================
  // 13. Scorecard Metrics (which metrics appear on each scorecard + ordering)
  // =========================================================================
  console.log("Linking metrics to scorecards...");

  // All Operations scorecard — all KPIs
  const allOpsMetrics = [
    { metric: metricResponseTime, group: "Response" },
    { metric: metricOnTimePerf, group: "Response" },
    { metric: metricTransportCount, group: "Volume" },
    { metric: metricUnitHourUtil, group: "Volume" },
    { metric: metricProtocolComp, group: "Quality" },
    { metric: metricPatientSafety, group: "Quality" },
    { metric: metricChartCompletion, group: "Quality" },
    { metric: metricCertCurrent, group: "Training" },
    { metric: metricTrainingHours, group: "Training" },
    { metric: metricFTOCompRate, group: "Training" },
  ];
  for (let i = 0; i < allOpsMetrics.length; i++) {
    await prisma.scorecardMetric.create({
      data: {
        scorecardId: scorecardAll.id,
        metricDefinitionId: allOpsMetrics[i].metric.id,
        sortOrder: i + 1,
        groupName: allOpsMetrics[i].group,
      },
    });
  }

  // Ground Ambulance scorecard
  const groundMetrics = [
    metricResponseTime,
    metricOnTimePerf,
    metricTransportCount,
    metricUnitHourUtil,
    metricProtocolComp,
    metricChartCompletion,
  ];
  for (let i = 0; i < groundMetrics.length; i++) {
    await prisma.scorecardMetric.create({
      data: {
        scorecardId: scorecardGround.id,
        metricDefinitionId: groundMetrics[i].id,
        sortOrder: i + 1,
      },
    });
  }

  // Air Care scorecard
  const airCareMetrics = [
    metricResponseTime,
    metricTransportCount,
    metricProtocolComp,
    metricCertCurrent,
  ];
  for (let i = 0; i < airCareMetrics.length; i++) {
    await prisma.scorecardMetric.create({
      data: {
        scorecardId: scorecardAirCare.id,
        metricDefinitionId: airCareMetrics[i].id,
        sortOrder: i + 1,
      },
    });
  }

  // Quality scorecard
  const qualScMetrics = [metricProtocolComp, metricPatientSafety, metricChartCompletion];
  for (let i = 0; i < qualScMetrics.length; i++) {
    await prisma.scorecardMetric.create({
      data: {
        scorecardId: scorecardQuality.id,
        metricDefinitionId: qualScMetrics[i].id,
        sortOrder: i + 1,
        groupName: "Quality Metrics",
      },
    });
  }

  console.log("  Linked metrics to scorecards.\n");

  // =========================================================================
  // 14. Department-level metric entries (for unassociated metric fallback)
  // =========================================================================
  console.log("Creating department-level entries for cross-cutting metrics...");

  // Some metrics also need dept-level entries (no division/region) as fallback
  const deptLevelMetrics = [
    { metric: metricProtocolComp, dept: deptQuality, base: 94, variance: 2 },
    { metric: metricChartCompletion, dept: deptQuality, base: 97, variance: 1.5 },
    { metric: metricCertCurrent, dept: deptClinical, base: 98, variance: 1 },
    { metric: metricFTOCompRate, dept: deptEducation, base: 83, variance: 5 },
  ];

  for (const { metric, dept, base, variance } of deptLevelMetrics) {
    const vals = generatePercentageValues(base, variance, MONTHS, 0.1);
    for (let i = 0; i < vals.length; i++) {
      const year = i < 12 ? 2025 : 2026;
      const month = i < 12 ? i : i - 12;
      await prisma.metricEntry.create({
        data: {
          metricDefinitionId: metric.id,
          departmentId: dept.id,
          divisionId: null,
          regionId: null,
          periodType: "monthly",
          periodStart: new Date(Date.UTC(year, month, 1, 12, 0, 0)),
          value: vals[i],
          numerator: Math.round(vals[i] * 10),
          denominator: 1000,
        },
      });
    }
  }

  console.log("  Created department-level entries.\n");

  console.log("Seed complete! Dashboard should now show KPI data and scorecards.");
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
