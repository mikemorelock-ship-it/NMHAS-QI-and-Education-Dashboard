// seed.mjs - ESM seed script for Prisma v7 with better-sqlite3 adapter
// Unified User model — all users share email+password auth (password: Admin123!)

import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
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

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

// Generic password for all seed users (meets requirements: 8+ chars, upper, lower, number, special)
const SEED_PASSWORD = "Admin123!";
const seedPasswordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

function createSeededRandom(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
}
const random = createSeededRandom(42);

const now = new Date();
const SEED_MONTHS = [];
for (let i = 17; i >= 0; i--) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  SEED_MONTHS.push({ year: d.getFullYear(), month: d.getMonth() });
}

function generateValue(month, min, max, options = {}) {
  const { trendStrength = 0.3, seasonalAmplitude = 0.15, seasonalPeak = 8, decimals = 1 } = options;
  const range = max - min;
  const base = min + range * 0.4;
  const trend = (month / (SEED_MONTHS.length - 1)) * range * trendStrength;
  const seasonalOffset = ((month - seasonalPeak + 12) % 12) / 12;
  const seasonal = Math.cos(seasonalOffset * 2 * Math.PI) * range * seasonalAmplitude;
  const noise = (random() - 0.5) * range * 0.2;
  let value = base + trend + seasonal + noise;
  value = Math.max(min, Math.min(max, value));
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function computeValue(month, range, genOptions) {
  const trendStrength = genOptions.trendStrength ?? 0.3;
  let value;
  if (trendStrength < 0) {
    value = generateValue(month, range.min, range.max, { ...genOptions, trendStrength: Math.abs(trendStrength) });
    value = range.max - (value - range.min);
    value = Math.max(range.min, Math.min(range.max, value));
    const decimals = genOptions.decimals ?? 1;
    const factor = Math.pow(10, decimals);
    value = Math.round(value * factor) / factor;
  } else {
    value = generateValue(month, range.min, range.max, { ...genOptions, trendStrength });
  }
  return value;
}

const seedDate = (idx, day = 1) => {
  const { year, month } = SEED_MONTHS[Math.min(idx, SEED_MONTHS.length - 1)];
  return new Date(Date.UTC(year, month, day, 12));
};

// Pick random item from array using seeded random
function pick(arr) { return arr[Math.floor(random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

// ---------------------------------------------------------------------------
// Department definitions
// ---------------------------------------------------------------------------

const departmentDefs = [
  { name: "Ambulance Services Quality", slug: "ambulance-services-quality", type: "quality", description: "Quality assurance and performance improvement for North Memorial Health ambulance operations", sortOrder: 1, divisions: [] },
  { name: "Ambulance Services Clinical Development", slug: "ambulance-services-clinical-development", type: "clinical", description: "Clinical skills development, continuing education, and competency management for field crews", sortOrder: 2, divisions: [] },
  { name: "EMS Professional Education", slug: "ems-professional-education", type: "education", description: "Initial and continuing EMS education programs including Paramedic and EMT certification courses", sortOrder: 3, divisions: [] },
  {
    name: "Clinical and Operational Metrics", slug: "clinical-and-operational-metrics", type: "operations",
    description: "Clinical performance and operational metrics across all North Memorial Health ambulance service lines", sortOrder: 4,
    divisions: [
      { name: "Air Care Clinical", individuals: ["AC 1","AC 2","AC 3","AC 4","AC 5","AC 6","AC 7"] },
      { name: "Air Care Aviation", individuals: [] },
      { name: "Ground Ambulance", individuals: ["Brainerd","Burnett County","Douglas County","Faribault","Grand Rapids","Longville","Marshall","Metro ALS","Metro BLS","Nashwauk","New Prague","Park Rapids","Princeton","Spooner","Walker","Waseca"] },
      { name: "Community Paramedics", individuals: [] },
      { name: "Billing", individuals: [] },
      { name: "Ancillary Services", individuals: ["Quality","Clinical Development","EMS Professional Education","Communications Center","Fleet Management","Technology"] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Metrics — expanded with more depth per department
// ---------------------------------------------------------------------------

const qualityMetrics = [
  { name: "Cases Reviewed", unit: "count", chartType: "bar", isKpi: true, category: "Review Activity", target: null, range: { min: 40, max: 80 }, genOptions: { trendStrength: 0.3, seasonalAmplitude: 0.15, seasonalPeak: 10, decimals: 0 }, dataDefinition: "Total number of patient care reports reviewed by the quality improvement team during the reporting period.", methodology: "Cases are selected via stratified random sampling plus all cases flagged by clinical triggers." },
  { name: "Clinical Debriefs Completed", unit: "count", chartType: "bar", isKpi: true, category: "Review Activity", target: null, range: { min: 8, max: 20 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.15, seasonalPeak: 10, decimals: 0 } },
  { name: "Cardiac Arrest Survival Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Clinical Outcomes", target: 12, range: { min: 8, max: 16 }, genOptions: { trendStrength: 0.35, seasonalAmplitude: 0.1, seasonalPeak: 6, decimals: 1 } },
  { name: "Average Response Time", unit: "duration", chartType: "line", isKpi: true, category: "Operational", target: 8, range: { min: 6, max: 9 }, genOptions: { trendStrength: -0.2, seasonalAmplitude: 0.15, seasonalPeak: 1, decimals: 1 } },
  { name: "Protocol Compliance Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Clinical Outcomes", target: 95, range: { min: 88, max: 98 }, genOptions: { trendStrength: 0.3, seasonalAmplitude: 0.08, seasonalPeak: 7, decimals: 1 } },
  { name: "Patient Satisfaction Score", unit: "score", chartType: "line", isKpi: true, category: "Patient Experience", target: 8.0, range: { min: 7.0, max: 9.0 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.1, seasonalPeak: 6, decimals: 1 } },
  { name: "STEMI Door-to-Balloon Time", unit: "duration", chartType: "line", isKpi: false, category: "Clinical Outcomes", target: 90, range: { min: 55, max: 95 }, genOptions: { trendStrength: -0.25, seasonalAmplitude: 0.1, seasonalPeak: 1, decimals: 0 } },
  { name: "Airway Success Rate", unit: "percentage", chartType: "line", isKpi: false, category: "Clinical Outcomes", target: 95, range: { min: 90, max: 99 }, genOptions: { trendStrength: 0.3, seasonalAmplitude: 0.08, seasonalPeak: 7, decimals: 1 } },
  { name: "Medication Error Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Patient Safety", target: 0.5, range: { min: 0.1, max: 2.0 }, genOptions: { trendStrength: -0.3, seasonalAmplitude: 0.1, seasonalPeak: 1, decimals: 2 } },
  { name: "Hand Hygiene Compliance", unit: "percentage", chartType: "line", isKpi: false, category: "Patient Safety", target: 95, range: { min: 80, max: 99 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.1, seasonalPeak: 9, decimals: 1 } },
  { name: "Patient Complaints", unit: "count", chartType: "bar", isKpi: false, category: "Patient Experience", target: null, range: { min: 2, max: 12 }, genOptions: { trendStrength: -0.2, seasonalAmplitude: 0.15, seasonalPeak: 7, decimals: 0 } },
  { name: "Near Miss Reports", unit: "count", chartType: "bar", isKpi: false, category: "Patient Safety", target: null, range: { min: 5, max: 20 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.1, seasonalPeak: 10, decimals: 0 } },
];

const clinicalDevMetrics = [
  { name: "Skills Competency Assessments", unit: "count", chartType: "bar", isKpi: true, category: "Competency", target: null, range: { min: 30, max: 65 }, genOptions: { trendStrength: 0.3, seasonalAmplitude: 0.2, seasonalPeak: 3, decimals: 0 } },
  { name: "Field Training Hours", unit: "count", chartType: "bar", isKpi: true, category: "Training", target: null, range: { min: 150, max: 350 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.15, seasonalPeak: 4, decimals: 0 } },
  { name: "Simulation Lab Sessions", unit: "count", chartType: "bar", isKpi: true, category: "Training", target: null, range: { min: 8, max: 18 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.2, seasonalPeak: 3, decimals: 0 } },
  { name: "CE Credits Delivered", unit: "count", chartType: "line", isKpi: true, category: "Education", target: null, range: { min: 200, max: 500 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.15, seasonalPeak: 10, decimals: 0 } },
  { name: "Competency Pass Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Competency", target: 90, range: { min: 85, max: 98 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.1, seasonalPeak: 6, decimals: 1 } },
  { name: "Provider Recertification Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Compliance", target: 95, range: { min: 88, max: 99 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.08, seasonalPeak: 12, decimals: 1 } },
  { name: "Preceptor Evaluations Completed", unit: "count", chartType: "bar", isKpi: false, category: "Training", target: null, range: { min: 12, max: 30 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.15, seasonalPeak: 5, decimals: 0 } },
  { name: "New Protocol Rollout Compliance", unit: "percentage", chartType: "line", isKpi: false, category: "Compliance", target: 90, range: { min: 70, max: 98 }, genOptions: { trendStrength: 0.4, seasonalAmplitude: 0.1, seasonalPeak: 3, decimals: 1 } },
  { name: "Clinical Ride-Along Hours", unit: "count", chartType: "bar", isKpi: false, category: "Training", target: null, range: { min: 50, max: 150 }, genOptions: { trendStrength: 0.15, seasonalAmplitude: 0.2, seasonalPeak: 5, decimals: 0 } },
  { name: "High-Acuity Scenario Completions", unit: "count", chartType: "bar", isKpi: true, category: "Training", target: null, range: { min: 15, max: 40 }, genOptions: { trendStrength: 0.3, seasonalAmplitude: 0.15, seasonalPeak: 3, decimals: 0 } },
];

const educationMetrics = [
  { name: "Progress Toward Revenue Targets", unit: "percentage", chartType: "line", isKpi: true, category: "Financial", target: 100, range: { min: 55, max: 98 }, genOptions: { trendStrength: 0.35, seasonalAmplitude: 0.15, seasonalPeak: 12, decimals: 1 } },
  { name: "Active Student Enrollment", unit: "count", chartType: "bar", isKpi: true, category: "Enrollment", target: null, range: { min: 25, max: 60 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.25, seasonalPeak: 9, decimals: 0 } },
  { name: "Course Completion Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Academic", target: 85, range: { min: 72, max: 95 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.1, seasonalPeak: 5, decimals: 1 } },
  { name: "NREMT First-Attempt Pass Rate", unit: "percentage", chartType: "line", isKpi: true, category: "Academic", target: 70, range: { min: 58, max: 85 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.1, seasonalPeak: 6, decimals: 1 } },
  { name: "Student Satisfaction Score", unit: "score", chartType: "line", isKpi: false, category: "Experience", target: 4.0, range: { min: 3.2, max: 4.8 }, genOptions: { trendStrength: 0.2, seasonalAmplitude: 0.1, seasonalPeak: 6, decimals: 1 } },
  { name: "Clinical Site Placements", unit: "count", chartType: "bar", isKpi: false, category: "Clinical", target: null, range: { min: 10, max: 30 }, genOptions: { trendStrength: 0.15, seasonalAmplitude: 0.2, seasonalPeak: 9, decimals: 0 } },
  { name: "Instructor Contact Hours", unit: "count", chartType: "bar", isKpi: false, category: "Staffing", target: null, range: { min: 400, max: 900 }, genOptions: { trendStrength: 0.1, seasonalAmplitude: 0.2, seasonalPeak: 10, decimals: 0 } },
];

const operationsMetrics = [
  { name: "Total Calls", unit: "count", chartType: "bar", isKpi: true, category: "Volume", target: null, range: { min: 2000, max: 4500 }, genOptions: { trendStrength: 0.15, seasonalAmplitude: 0.1, seasonalPeak: 7, decimals: 0 } },
  { name: "Average Response Time", unit: "duration", chartType: "line", isKpi: true, category: "Response", target: 8, range: { min: 5.5, max: 9.5 }, genOptions: { trendStrength: -0.2, seasonalAmplitude: 0.12, seasonalPeak: 1, decimals: 1 } },
  { name: "Unit Hour Utilization", unit: "percentage", chartType: "line", isKpi: true, category: "Utilization", target: 35, range: { min: 22, max: 42 }, genOptions: { trendStrength: 0.15, seasonalAmplitude: 0.12, seasonalPeak: 7, decimals: 1 } },
  { name: "Transport Count", unit: "count", chartType: "bar", isKpi: true, category: "Volume", target: null, range: { min: 1500, max: 3500 }, genOptions: { trendStrength: 0.15, seasonalAmplitude: 0.1, seasonalPeak: 7, decimals: 0 } },
  { name: "Average On-Scene Time", unit: "duration", chartType: "line", isKpi: true, category: "Response", target: 15, range: { min: 12, max: 20 }, genOptions: { trendStrength: -0.1, seasonalAmplitude: 0.08, seasonalPeak: 1, decimals: 1 } },
  { name: "Mutual Aid Given", unit: "count", chartType: "bar", isKpi: true, category: "Mutual Aid", target: null, range: { min: 10, max: 40 }, genOptions: { trendStrength: 0.1, seasonalAmplitude: 0.15, seasonalPeak: 7, decimals: 0 } },
  { name: "Mutual Aid Received", unit: "count", chartType: "bar", isKpi: false, category: "Mutual Aid", target: null, range: { min: 5, max: 25 }, genOptions: { trendStrength: -0.1, seasonalAmplitude: 0.15, seasonalPeak: 7, decimals: 0 } },
  { name: "Chute Time", unit: "duration", chartType: "line", isKpi: true, category: "Response", target: 2, range: { min: 1.0, max: 3.0 }, genOptions: { trendStrength: -0.15, seasonalAmplitude: 0.1, seasonalPeak: 1, decimals: 1 } },
  { name: "Late Calls", unit: "count", chartType: "bar", isKpi: false, category: "Response", target: null, range: { min: 5, max: 30 }, genOptions: { trendStrength: -0.2, seasonalAmplitude: 0.1, seasonalPeak: 7, decimals: 0 } },
  { name: "Turnover Rate", unit: "percentage", chartType: "line", isKpi: false, category: "Workforce", target: null, range: { min: 5, max: 18 }, genOptions: { trendStrength: -0.15, seasonalAmplitude: 0.1, seasonalPeak: 3, decimals: 1 } },
  { name: "Overtime Hours", unit: "count", chartType: "bar", isKpi: false, category: "Workforce", target: null, range: { min: 200, max: 600 }, genOptions: { trendStrength: -0.1, seasonalAmplitude: 0.15, seasonalPeak: 7, decimals: 0 } },
  { name: "Vehicle Out-of-Service Hours", unit: "count", chartType: "bar", isKpi: false, category: "Fleet", target: null, range: { min: 20, max: 120 }, genOptions: { trendStrength: -0.15, seasonalAmplitude: 0.1, seasonalPeak: 1, decimals: 0 } },
  { name: "Dry Runs", unit: "count", chartType: "bar", isKpi: false, category: "Volume", target: null, range: { min: 50, max: 200 }, genOptions: { trendStrength: 0.05, seasonalAmplitude: 0.1, seasonalPeak: 7, decimals: 0 } },
  { name: "Average Transport Time", unit: "duration", chartType: "line", isKpi: false, category: "Response", target: 20, range: { min: 14, max: 28 }, genOptions: { trendStrength: -0.05, seasonalAmplitude: 0.08, seasonalPeak: 1, decimals: 1 } },
];

const metricsByDept = {
  "ambulance-services-quality": qualityMetrics,
  "ambulance-services-clinical-development": clinicalDevMetrics,
  "ems-professional-education": educationMetrics,
  "clinical-and-operational-metrics": operationsMetrics,
};

const airCareUnitRanges = { "Total Calls": { min: 30, max: 80 }, "Average Response Time": { min: 8, max: 18 }, "Unit Hour Utilization": { min: 15, max: 35 }, "Transport Count": { min: 25, max: 65 }, "Average On-Scene Time": { min: 14, max: 22 }, "Mutual Aid Given": { min: 2, max: 10 }, "Mutual Aid Received": { min: 0, max: 5 }, "Chute Time": { min: 3, max: 8 }, "Late Calls": { min: 0, max: 5 }, "Turnover Rate": { min: 3, max: 12 }, "Overtime Hours": { min: 10, max: 40 }, "Vehicle Out-of-Service Hours": { min: 2, max: 15 }, "Dry Runs": { min: 3, max: 15 }, "Average Transport Time": { min: 20, max: 45 } };
const groundBaseRanges = { "Total Calls": { min: 50, max: 400 }, "Average Response Time": { min: 4, max: 12 }, "Unit Hour Utilization": { min: 15, max: 50 }, "Transport Count": { min: 40, max: 320 }, "Average On-Scene Time": { min: 10, max: 20 }, "Mutual Aid Given": { min: 1, max: 8 }, "Mutual Aid Received": { min: 0, max: 6 }, "Chute Time": { min: 0.8, max: 3.5 }, "Late Calls": { min: 0, max: 10 }, "Turnover Rate": { min: 3, max: 20 }, "Overtime Hours": { min: 8, max: 50 }, "Vehicle Out-of-Service Hours": { min: 1, max: 12 }, "Dry Runs": { min: 2, max: 20 }, "Average Transport Time": { min: 10, max: 30 } };

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding EMS Dashboard database for North Memorial Health...\n");

  console.log("Clearing existing data...");
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
  await prisma.scorecard.deleteMany();
  await prisma.metricEntry.deleteMany();
  await prisma.metricAnnotation.deleteMany();
  await prisma.metricResource.deleteMany();
  await prisma.metricResponsibleParty.deleteMany();
  await prisma.metricDefinition.deleteMany();
  await prisma.region.deleteMany();
  await prisma.division.deleteMany();
  await prisma.user.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.department.deleteMany();
  await prisma.loginAttempt.deleteMany();
  console.log("  Done.\n");

  // --- Departments ---
  console.log("Creating departments...");
  const departments = {};
  for (const dept of departmentDefs) {
    const c = await prisma.department.create({ data: { name: dept.name, slug: dept.slug, type: dept.type, description: dept.description, sortOrder: dept.sortOrder, isActive: true } });
    departments[dept.slug] = c.id;
    console.log(`  ${dept.name}`);
  }

  // --- Divisions & Regions ---
  console.log("\nCreating divisions and regions...");
  const divisionIds = {};
  const regionIds = {};
  for (const dept of departmentDefs) {
    const departmentId = departments[dept.slug];
    for (let i = 0; i < dept.divisions.length; i++) {
      const dd = dept.divisions[i];
      const ds = slugify(dd.name);
      const div = await prisma.division.create({ data: { departmentId, name: dd.name, slug: ds, sortOrder: i + 1, isActive: true } });
      divisionIds[`${dept.slug}/${ds}`] = div.id;
      if (dd.individuals?.length > 0) {
        for (const iName of dd.individuals) {
          const ind = await prisma.region.create({ data: { divisionId: div.id, name: iName, role: dd.name === "Air Care Clinical" ? "Helicopter Unit" : dd.name === "Ancillary Services" ? "Support Unit" : "Base Station", isActive: true } });
          regionIds[`${dept.slug}/${ds}/${iName}`] = ind.id;
        }
      }
    }
  }

  const opsDeptSlug = "clinical-and-operational-metrics";
  const opsDeptId = departments[opsDeptSlug];
  const groundAmbDivId = divisionIds[`${opsDeptSlug}/ground-ambulance`] || null;
  const airCareDivId = divisionIds[`${opsDeptSlug}/air-care-clinical`] || null;

  // =========================================================================
  // USERS — expanded roster
  // =========================================================================
  console.log("\nCreating users...");

  // --- Admin & management ---
  const adminUser = await prisma.user.create({ data: { email: "michael.morelock@northmemorial.com", passwordHash: seedPasswordHash, firstName: "Michael", lastName: "Morelock", role: "admin", status: "active" } });
  const manager1 = await prisma.user.create({ data: { email: "sarah.chen@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Sarah", lastName: "Chen", role: "manager", status: "active", employeeId: "MGR-001", badgeNumber: "B-100", divisionId: groundAmbDivId } });
  const manager2 = await prisma.user.create({ data: { email: "david.martinez@nmhealth.org", passwordHash: seedPasswordHash, firstName: "David", lastName: "Martinez", role: "manager", status: "active", employeeId: "MGR-002", badgeNumber: "B-101", divisionId: groundAmbDivId } });
  await prisma.user.create({ data: { email: "karen.wright@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Karen", lastName: "Wright", role: "manager", status: "active", employeeId: "MGR-003", badgeNumber: "B-102", divisionId: airCareDivId } });
  console.log("  Admin: michael.morelock@northmemorial.com");
  console.log("  Managers: sarah.chen, david.martinez, karen.wright");

  // --- Data entry ---
  await prisma.user.create({ data: { email: "data.entry@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Data", lastName: "Entry", role: "data_entry", status: "active" } });
  await prisma.user.create({ data: { email: "lisa.park@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Lisa", lastName: "Park", role: "data_entry", status: "active" } });
  console.log("  Data Entry: data.entry, lisa.park");

  // --- Supervisors ---
  const sup1 = await prisma.user.create({ data: { email: "marcus.johnson@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Marcus", lastName: "Johnson", role: "supervisor", status: "active", employeeId: "SUP-001", badgeNumber: "B-445", divisionId: groundAmbDivId } });
  const sup2 = await prisma.user.create({ data: { email: "jennifer.walsh@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Jennifer", lastName: "Walsh", role: "supervisor", status: "active", employeeId: "SUP-002", badgeNumber: "B-302", divisionId: groundAmbDivId } });
  const sup3 = await prisma.user.create({ data: { email: "derek.Thompson@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Derek", lastName: "Thompson", role: "supervisor", status: "active", employeeId: "SUP-003", badgeNumber: "B-518", divisionId: airCareDivId } });
  const sup4 = await prisma.user.create({ data: { email: "maria.gonzalez@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Maria", lastName: "Gonzalez", role: "supervisor", status: "active", employeeId: "SUP-004", badgeNumber: "B-411", divisionId: groundAmbDivId } });
  console.log("  Supervisors: marcus.johnson, jennifer.walsh, derek.thompson, maria.gonzalez");

  // --- FTOs ---
  const fto1 = await prisma.user.create({ data: { email: "rachel.nguyen@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Rachel", lastName: "Nguyen", role: "fto", status: "active", employeeId: "FTO-001", badgeNumber: "B-312", divisionId: groundAmbDivId } });
  const fto2 = await prisma.user.create({ data: { email: "brian.kowalski@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Brian", lastName: "Kowalski", role: "fto", status: "active", employeeId: "FTO-002", badgeNumber: "B-220", divisionId: groundAmbDivId } });
  const fto3 = await prisma.user.create({ data: { email: "samantha.lee@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Samantha", lastName: "Lee", role: "fto", status: "active", employeeId: "FTO-003", badgeNumber: "B-334", divisionId: groundAmbDivId } });
  const fto4 = await prisma.user.create({ data: { email: "tyler.anderson@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Tyler", lastName: "Anderson", role: "fto", status: "active", employeeId: "FTO-004", badgeNumber: "B-156", divisionId: groundAmbDivId } });
  const fto5 = await prisma.user.create({ data: { email: "natalie.brooks@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Natalie", lastName: "Brooks", role: "fto", status: "active", employeeId: "FTO-005", badgeNumber: "B-278", divisionId: airCareDivId } });
  const fto6 = await prisma.user.create({ data: { email: "kevin.russo@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Kevin", lastName: "Russo", role: "fto", status: "active", employeeId: "FTO-006", badgeNumber: "B-190", divisionId: groundAmbDivId } });
  const fto7 = await prisma.user.create({ data: { email: "amanda.foster@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Amanda", lastName: "Foster", role: "fto", status: "active", employeeId: "FTO-007", badgeNumber: "B-267", divisionId: groundAmbDivId } });
  const fto8 = await prisma.user.create({ data: { email: "jason.murphy@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Jason", lastName: "Murphy", role: "fto", status: "active", employeeId: "FTO-008", badgeNumber: "B-345", divisionId: groundAmbDivId } });
  console.log("  FTOs: rachel.nguyen, brian.kowalski, samantha.lee, tyler.anderson, natalie.brooks, kevin.russo, amanda.foster, jason.murphy");

  // --- Trainees ---
  const trainee1 = await prisma.user.create({ data: { email: "alex.chen@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Alex", lastName: "Chen", role: "trainee", status: "active", employeeId: "TR-001", divisionId: groundAmbDivId, hireDate: seedDate(0, 15), startDate: seedDate(1, 1), traineeStatus: "active" } });
  const trainee2 = await prisma.user.create({ data: { email: "jordan.williams@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Jordan", lastName: "Williams", role: "trainee", status: "active", employeeId: "TR-002", divisionId: groundAmbDivId, hireDate: seedDate(0, 1), startDate: seedDate(0, 15), traineeStatus: "active" } });
  const trainee3 = await prisma.user.create({ data: { email: "megan.taylor@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Megan", lastName: "Taylor", role: "trainee", status: "active", employeeId: "TR-003", divisionId: groundAmbDivId, hireDate: seedDate(2, 1), startDate: seedDate(3, 1), traineeStatus: "active" } });
  const trainee4 = await prisma.user.create({ data: { email: "ryan.patel@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Ryan", lastName: "Patel", role: "trainee", status: "active", employeeId: "TR-004", divisionId: groundAmbDivId, hireDate: seedDate(4, 10), startDate: seedDate(5, 1), traineeStatus: "active" } });
  const trainee5 = await prisma.user.create({ data: { email: "hannah.brown@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Hannah", lastName: "Brown", role: "trainee", status: "active", employeeId: "TR-005", divisionId: airCareDivId, hireDate: seedDate(6, 1), startDate: seedDate(7, 1), traineeStatus: "active" } });
  const trainee6 = await prisma.user.create({ data: { email: "ethan.davis@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Ethan", lastName: "Davis", role: "trainee", status: "active", employeeId: "TR-006", divisionId: groundAmbDivId, hireDate: seedDate(8, 1), startDate: seedDate(9, 1), traineeStatus: "active" } });
  const trainee7 = await prisma.user.create({ data: { email: "olivia.moore@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Olivia", lastName: "Moore", role: "trainee", status: "active", employeeId: "TR-007", divisionId: groundAmbDivId, hireDate: seedDate(10, 15), startDate: seedDate(11, 1), traineeStatus: "active" } });
  const trainee8 = await prisma.user.create({ data: { email: "lucas.jackson@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Lucas", lastName: "Jackson", role: "trainee", status: "active", employeeId: "TR-008", divisionId: groundAmbDivId, hireDate: seedDate(12, 1), startDate: seedDate(13, 1), traineeStatus: "active" } });
  // Completed trainee
  const trainee9 = await prisma.user.create({ data: { email: "sophia.white@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Sophia", lastName: "White", role: "trainee", status: "active", employeeId: "TR-009", divisionId: groundAmbDivId, hireDate: seedDate(0, 1), startDate: seedDate(0, 15), completionDate: seedDate(10, 1), traineeStatus: "completed" } });
  // Separated trainee
  const trainee10 = await prisma.user.create({ data: { email: "noah.harris@nmhealth.org", passwordHash: seedPasswordHash, firstName: "Noah", lastName: "Harris", role: "trainee", status: "active", employeeId: "TR-010", divisionId: groundAmbDivId, hireDate: seedDate(3, 1), startDate: seedDate(4, 1), traineeStatus: "separated", notes: "Voluntary separation — relocated out of state." } });
  console.log("  Trainees: alex.chen, jordan.williams, megan.taylor, ryan.patel, hannah.brown, ethan.davis, olivia.moore, lucas.jackson, sophia.white (completed), noah.harris (separated)");
  console.log(`\n  All users use password: ${SEED_PASSWORD}\n`);

  // =========================================================================
  // METRICS
  // =========================================================================
  console.log("Creating metrics...");
  const allMetricDefs = [];
  for (const dept of departmentDefs) {
    const departmentId = departments[dept.slug];
    const metrics = metricsByDept[dept.slug];
    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const c = await prisma.metricDefinition.create({ data: { departmentId, name: m.name, slug: slugify(m.name), unit: m.unit, aggregationType: (m.unit === "count" || m.unit === "currency") ? "sum" : "average", chartType: m.chartType, isKpi: m.isKpi, categoryLegacy: m.category, target: m.target, dataDefinition: m.dataDefinition || null, methodology: m.methodology || null, sortOrder: i + 1, isActive: true } });
      allMetricDefs.push({ id: c.id, departmentId, deptSlug: dept.slug, metricName: m.name, range: m.range, genOptions: m.genOptions });
    }
  }
  console.log(`  Created ${allMetricDefs.length} metric definitions.`);

  // Sub-metrics
  const clinicalDebriefsDef = allMetricDefs.find((m) => m.metricName === "Clinical Debriefs Completed");
  const subMetrics = [];
  if (clinicalDebriefsDef) {
    const omd = await prisma.metricDefinition.create({ data: { departmentId: clinicalDebriefsDef.departmentId, parentId: clinicalDebriefsDef.id, name: "OMD Clinical Debrief", slug: "omd-clinical-debrief", unit: "count", aggregationType: "sum", chartType: "bar", isKpi: false, categoryLegacy: "Review Activity", sortOrder: 1, isActive: true } });
    subMetrics.push({ id: omd.id, departmentId: clinicalDebriefsDef.departmentId, range: { min: 3, max: 8 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.15, seasonalPeak: 10, decimals: 0 } });
    const qa = await prisma.metricDefinition.create({ data: { departmentId: clinicalDebriefsDef.departmentId, parentId: clinicalDebriefsDef.id, name: "QA Clinical Debrief", slug: "qa-clinical-debrief", unit: "count", aggregationType: "sum", chartType: "bar", isKpi: false, categoryLegacy: "Review Activity", sortOrder: 2, isActive: true } });
    subMetrics.push({ id: qa.id, departmentId: clinicalDebriefsDef.departmentId, range: { min: 5, max: 12 }, genOptions: { trendStrength: 0.25, seasonalAmplitude: 0.15, seasonalPeak: 10, decimals: 0 } });
  }

  // Annotations, Resources, Responsible Parties
  const findMetricDef = (name) => allMetricDefs.find((m) => m.metricName === name);
  const annotationData = [
    { metricName: "Cardiac Arrest Survival Rate", date: seedDate(1, 15), title: "Implemented Pit Crew CPR Model", type: "intervention" },
    { metricName: "Cardiac Arrest Survival Rate", date: seedDate(5, 1), title: "LUCAS Device Deployment", type: "intervention" },
    { metricName: "Protocol Compliance Rate", date: seedDate(2, 1), title: "Protocol Compliance Dashboard Launch", type: "intervention" },
    { metricName: "Airway Success Rate", date: seedDate(3, 1), title: "Video Laryngoscopy Training", type: "intervention" },
    { metricName: "Average Response Time", date: seedDate(4, 1), title: "Dynamic Deployment Model Activated", type: "intervention" },
    { metricName: "Total Calls", date: seedDate(6, 1), title: "Summer Volume Surge", type: "event" },
    { metricName: "Medication Error Rate", date: seedDate(7, 1), title: "Medication Double-Check Protocol Launched", type: "intervention" },
    { metricName: "Hand Hygiene Compliance", date: seedDate(8, 1), title: "Hand Hygiene Campaign Kickoff", type: "intervention" },
    { metricName: "NREMT First-Attempt Pass Rate", date: seedDate(4, 15), title: "New Test Prep Curriculum Launched", type: "intervention" },
    { metricName: "Total Calls", date: seedDate(12, 1), title: "Winter Storm — Increased Call Volume", type: "event" },
    { metricName: "Unit Hour Utilization", date: seedDate(10, 1), title: "Staffing Model Revised", type: "intervention" },
    { metricName: "Turnover Rate", date: seedDate(6, 15), title: "Retention Bonus Program Started", type: "intervention" },
  ];
  for (const ann of annotationData) {
    const md = findMetricDef(ann.metricName);
    if (md) await prisma.metricAnnotation.create({ data: { metricDefinitionId: md.id, date: ann.date, title: ann.title, type: ann.type } });
  }

  const resourceData = [
    { metricName: "Cardiac Arrest Survival Rate", title: "NMH Cardiac Arrest Protocol", url: "https://protocols.nmhealth.org/cardiac-arrest", type: "protocol", sortOrder: 1 },
    { metricName: "Protocol Compliance Rate", title: "NMH Clinical Protocol Library", url: "https://protocols.nmhealth.org/library", type: "protocol", sortOrder: 1 },
    { metricName: "Airway Success Rate", title: "Difficult Airway Algorithm", url: "https://protocols.nmhealth.org/airway", type: "protocol", sortOrder: 1 },
    { metricName: "Medication Error Rate", title: "Medication Safety Guidelines", url: "https://protocols.nmhealth.org/medication-safety", type: "protocol", sortOrder: 1 },
    { metricName: "NREMT First-Attempt Pass Rate", title: "NREMT Exam Prep Resources", url: "https://www.nremt.org/resources", type: "link", sortOrder: 1 },
  ];
  for (const res of resourceData) {
    const md = findMetricDef(res.metricName);
    if (md) await prisma.metricResource.create({ data: { metricDefinitionId: md.id, title: res.title, url: res.url, type: res.type, sortOrder: res.sortOrder } });
  }

  const partyData = [
    { metricName: "Cardiac Arrest Survival Rate", name: "Dr. Sarah Chen", role: "Medical Director", email: "sarah.chen@nmhealth.org", sortOrder: 1 },
    { metricName: "Protocol Compliance Rate", name: "Jennifer Walsh", role: "QI Program Manager", email: "jennifer.walsh@nmhealth.org", sortOrder: 1 },
    { metricName: "Average Response Time", name: "Tom Anderson", role: "Operations Director", email: "tom.anderson@nmhealth.org", sortOrder: 1 },
    { metricName: "Total Calls", name: "Tom Anderson", role: "Operations Director", email: "tom.anderson@nmhealth.org", sortOrder: 1 },
    { metricName: "Medication Error Rate", name: "Dr. Sarah Chen", role: "Medical Director", email: "sarah.chen@nmhealth.org", sortOrder: 1 },
    { metricName: "NREMT First-Attempt Pass Rate", name: "Michael Morelock", role: "Education Director", email: "michael.morelock@northmemorial.com", sortOrder: 1 },
  ];
  for (const p of partyData) {
    const md = findMetricDef(p.metricName);
    if (md) await prisma.metricResponsibleParty.create({ data: { metricDefinitionId: md.id, name: p.name, role: p.role, email: p.email, sortOrder: p.sortOrder } });
  }
  console.log(`  Created ${annotationData.length} annotations, ${resourceData.length} resources, ${partyData.length} responsible parties.`);

  // --- Metric Entries (18 months) ---
  console.log("\nCreating metric entries...");
  const batchData = [];
  for (const md of allMetricDefs) {
    for (let i = 0; i < SEED_MONTHS.length; i++) {
      const { year, month } = SEED_MONTHS[i];
      batchData.push({ metricDefinitionId: md.id, departmentId: md.departmentId, periodType: "monthly", periodStart: new Date(Date.UTC(year, month, 1, 12, 0, 0)), value: computeValue(i, md.range, md.genOptions) });
    }
  }
  await prisma.metricEntry.createMany({ data: batchData });
  if (subMetrics.length > 0) {
    const subBatch = [];
    for (const sub of subMetrics) {
      for (let i = 0; i < SEED_MONTHS.length; i++) {
        const { year, month } = SEED_MONTHS[i];
        subBatch.push({ metricDefinitionId: sub.id, departmentId: sub.departmentId, periodType: "monthly", periodStart: new Date(Date.UTC(year, month, 1, 12, 0, 0)), value: computeValue(i, sub.range, sub.genOptions) });
      }
    }
    await prisma.metricEntry.createMany({ data: subBatch });
  }

  // Division + individual level entries
  const opsMetricDefs = allMetricDefs.filter((m) => m.deptSlug === opsDeptSlug);
  const divBatch = [];
  const indivBatch = [];
  for (const dept of departmentDefs) {
    if (dept.slug !== opsDeptSlug) continue;
    for (const dd of dept.divisions) {
      const dk = `${dept.slug}/${slugify(dd.name)}`;
      const divId = divisionIds[dk];
      for (const md of opsMetricDefs) {
        for (let i = 0; i < SEED_MONTHS.length; i++) {
          const { year, month } = SEED_MONTHS[i];
          divBatch.push({ metricDefinitionId: md.id, departmentId: opsDeptId, divisionId: divId, periodType: "monthly", periodStart: new Date(Date.UTC(year, month, 1, 12, 0, 0)), value: computeValue(i, md.range, md.genOptions) });
        }
      }
      if (dd.individuals?.length > 0) {
        const isAC = dd.name === "Air Care Clinical";
        const ur = isAC ? airCareUnitRanges : groundBaseRanges;
        for (const iName of dd.individuals) {
          const indId = regionIds[`${dk}/${iName}`];
          for (const md of opsMetricDefs) {
            const r = ur[md.metricName];
            if (!r) continue;
            for (let i = 0; i < SEED_MONTHS.length; i++) {
              const { year, month } = SEED_MONTHS[i];
              indivBatch.push({ metricDefinitionId: md.id, departmentId: opsDeptId, divisionId: divId, regionId: indId, periodType: "monthly", periodStart: new Date(Date.UTC(year, month, 1, 12, 0, 0)), value: computeValue(i, r, md.genOptions) });
            }
          }
        }
      }
    }
  }
  if (divBatch.length) await prisma.metricEntry.createMany({ data: divBatch });
  if (indivBatch.length) await prisma.metricEntry.createMany({ data: indivBatch });
  console.log(`  Created ${batchData.length} dept + ${divBatch.length} div + ${indivBatch.length} individual entries.`);

  // =========================================================================
  // METRIC ASSOCIATIONS — link metrics to divisions/regions for dashboard
  // =========================================================================
  console.log("\nCreating metric associations...");
  let assocCount = 0;

  // Operations metrics → associate with ALL divisions and their regions
  for (const dept of departmentDefs) {
    if (dept.slug !== opsDeptSlug) continue;
    for (const dd of dept.divisions) {
      const dk = `${dept.slug}/${slugify(dd.name)}`;
      const divId = divisionIds[dk];
      if (!divId) continue;

      // Associate every ops metric with this division
      for (const md of opsMetricDefs) {
        await prisma.metricAssociation.create({
          data: { metricDefinitionId: md.id, divisionId: divId, regionId: null },
        });
        assocCount++;
      }

      // Associate every ops metric with each region in this division
      if (dd.individuals?.length > 0) {
        for (const iName of dd.individuals) {
          const rKey = `${dk}/${iName}`;
          const regId = regionIds[rKey];
          if (!regId) continue;
          for (const md of opsMetricDefs) {
            await prisma.metricAssociation.create({
              data: { metricDefinitionId: md.id, divisionId: divId, regionId: regId },
            });
            assocCount++;
          }
        }
      }
    }
  }
  console.log(`  Created ${assocCount} metric associations.`);

  // =========================================================================
  // DRIVER DIAGRAMS + PDSA (expanded)
  // =========================================================================
  console.log("\nCreating driver diagrams...");
  const rtm = findMetricDef("Average Response Time");
  const diagram = await prisma.driverDiagram.create({ data: { name: "Reduce Emergency Response Time", slug: "reduce-emergency-response-time", description: "Reduce average response time to under 8 minutes.", status: "active", isActive: true, sortOrder: 1, metricDefinitionId: rtm?.id ?? null } });
  const aim = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, type: "aim", text: "Reduce average response time to under 8 minutes for Priority 1 calls", sortOrder: 1 } });
  const pd1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: aim.id, type: "primary", text: "Dispatch Efficiency", sortOrder: 1 } });
  const pd2 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: aim.id, type: "primary", text: "Route Optimization", sortOrder: 2 } });
  const pd3 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: aim.id, type: "primary", text: "Crew Readiness", sortOrder: 3 } });
  const sd1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: pd1.id, type: "secondary", text: "CAD System Response Time", sortOrder: 1 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: pd1.id, type: "secondary", text: "Dispatcher Training", sortOrder: 2 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: pd2.id, type: "secondary", text: "GPS-Based Unit Selection", sortOrder: 1 } });
  const sd4 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: pd2.id, type: "secondary", text: "Dynamic Posting Strategy", sortOrder: 2 } });
  const sd5 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: pd3.id, type: "secondary", text: "Shift Change Protocols", sortOrder: 1 } });
  const ci1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: sd1.id, type: "changeIdea", text: "Implement GPS-based unit recommendation in CAD", sortOrder: 1 } });
  const ci4 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: sd4.id, type: "changeIdea", text: "Implement predictive posting model", sortOrder: 1 } });
  const ci5 = await prisma.driverNode.create({ data: { driverDiagramId: diagram.id, parentId: sd5.id, type: "changeIdea", text: "Staggered shift change with 30-minute overlap", sortOrder: 1 } });

  await prisma.pdsaCycle.create({ data: { title: "GPS-Based Unit Recommendation Pilot", cycleNumber: 1, status: "completed", outcome: "adopt", driverDiagramId: diagram.id, metricDefinitionId: rtm?.id ?? null, changeIdeaNodeId: ci1.id, planDescription: "Test GPS-based unit recommendation.", planStartDate: seedDate(0, 5), doStartDate: seedDate(1, 1), doEndDate: seedDate(2, 1), studyResults: "33% improvement in dispatch-to-enroute time.", studyDate: seedDate(2, 15), actDecision: "Adopt and roll out.", actDate: seedDate(3, 1) } });
  await prisma.pdsaCycle.create({ data: { title: "Predictive Posting Model Test", cycleNumber: 1, status: "studying", driverDiagramId: diagram.id, metricDefinitionId: rtm?.id ?? null, changeIdeaNodeId: ci4.id, planDescription: "Test predictive posting model.", planStartDate: seedDate(3, 10), doStartDate: seedDate(4, 1), doEndDate: seedDate(5, 15), studyResults: "1.3 min improvement.", studyDate: seedDate(6, 1) } });
  await prisma.pdsaCycle.create({ data: { title: "Staggered Shift Change Pilot", cycleNumber: 1, status: "planning", driverDiagramId: diagram.id, changeIdeaNodeId: ci5.id, planDescription: "Test 30-min overlapping shift changes.", planStartDate: seedDate(8, 1) } });

  // Second driver diagram — Cardiac Arrest Survival
  const casrDef = findMetricDef("Cardiac Arrest Survival Rate");
  const diagram2 = await prisma.driverDiagram.create({ data: { name: "Improve Cardiac Arrest Survival", slug: "improve-cardiac-arrest-survival", description: "Increase overall cardiac arrest survival to neurologically intact discharge above 15%.", status: "active", isActive: true, sortOrder: 2, metricDefinitionId: casrDef?.id ?? null } });
  const aim2 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, type: "aim", text: "Increase cardiac arrest survival (CPC 1-2) to above 15% by end of fiscal year", sortOrder: 1 } });
  const ca_pd1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: aim2.id, type: "primary", text: "Early Recognition & CPR Quality", sortOrder: 1 } });
  const ca_pd2 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: aim2.id, type: "primary", text: "Advanced Interventions", sortOrder: 2 } });
  const ca_pd3 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: aim2.id, type: "primary", text: "Post-ROSC Care", sortOrder: 3 } });
  const ca_sd1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_pd1.id, type: "secondary", text: "Pit Crew CPR Model", sortOrder: 1 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_pd1.id, type: "secondary", text: "Bystander CPR Enhancement", sortOrder: 2 } });
  const ca_sd3 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_pd2.id, type: "secondary", text: "Mechanical CPR Devices", sortOrder: 1 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_pd2.id, type: "secondary", text: "Double Sequential Defibrillation", sortOrder: 2 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_pd3.id, type: "secondary", text: "Targeted Temperature Management", sortOrder: 1 } });
  const ca_ci1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_sd1.id, type: "changeIdea", text: "Quarterly high-fidelity cardiac arrest simulations", sortOrder: 1 } });
  const ca_ci2 = await prisma.driverNode.create({ data: { driverDiagramId: diagram2.id, parentId: ca_sd3.id, type: "changeIdea", text: "Deploy LUCAS 3 on every ALS unit", sortOrder: 1 } });

  await prisma.pdsaCycle.create({ data: { title: "Quarterly Cardiac Arrest Simulation Program", cycleNumber: 1, status: "doing", driverDiagramId: diagram2.id, metricDefinitionId: casrDef?.id ?? null, changeIdeaNodeId: ca_ci1.id, planDescription: "Run quarterly high-fidelity simulations with all ALS crews.", planStartDate: seedDate(4, 1), doStartDate: seedDate(5, 1), doEndDate: seedDate(10, 30) } });
  await prisma.pdsaCycle.create({ data: { title: "LUCAS 3 Deployment on ALS Units", cycleNumber: 1, status: "completed", outcome: "adopt", driverDiagramId: diagram2.id, metricDefinitionId: casrDef?.id ?? null, changeIdeaNodeId: ca_ci2.id, planDescription: "Deploy LUCAS 3 devices to all ALS ambulances.", planStartDate: seedDate(1, 1), doStartDate: seedDate(2, 1), doEndDate: seedDate(4, 1), studyResults: "Improved compression fraction from 72% to 89%. Survival trend improving.", studyDate: seedDate(4, 15), actDecision: "Full adoption — order 5 additional units.", actDate: seedDate(5, 1) } });

  // Third driver diagram — Medication Error Reduction
  const medErrDef = findMetricDef("Medication Error Rate");
  const diagram3 = await prisma.driverDiagram.create({ data: { name: "Reduce Medication Errors", slug: "reduce-medication-errors", description: "Reduce medication error rate below 0.5% through system-level interventions.", status: "draft", isActive: true, sortOrder: 3, metricDefinitionId: medErrDef?.id ?? null } });
  const aim3 = await prisma.driverNode.create({ data: { driverDiagramId: diagram3.id, type: "aim", text: "Reduce medication error rate to below 0.5% within 12 months", sortOrder: 1 } });
  const me_pd1 = await prisma.driverNode.create({ data: { driverDiagramId: diagram3.id, parentId: aim3.id, type: "primary", text: "Standardize Medication Preparation", sortOrder: 1 } });
  const me_pd2 = await prisma.driverNode.create({ data: { driverDiagramId: diagram3.id, parentId: aim3.id, type: "primary", text: "Crew Education & Competency", sortOrder: 2 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram3.id, parentId: me_pd1.id, type: "secondary", text: "Pre-drawn Medication Kits", sortOrder: 1 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram3.id, parentId: me_pd1.id, type: "secondary", text: "Color-Coded Syringe System", sortOrder: 2 } });
  await prisma.driverNode.create({ data: { driverDiagramId: diagram3.id, parentId: me_pd2.id, type: "secondary", text: "Monthly Medication Quiz", sortOrder: 1 } });
  console.log("  Created 3 driver diagrams with 6 PDSA cycles.");

  // =========================================================================
  // QI CAMPAIGNS & ACTION ITEMS
  // =========================================================================
  console.log("\nCreating QI campaigns and action items...");

  const campaign1 = await prisma.campaign.create({
    data: {
      name: "Response Time Improvement Initiative",
      slug: "response-time-improvement-initiative",
      description: "Comprehensive initiative to reduce emergency response times across all NMH EMS divisions through dispatch optimization, route planning, and crew readiness improvements.",
      goals: "- Reduce average P1 response time to under 8 minutes\n- Improve dispatch-to-enroute interval by 30%\n- Implement predictive posting in all divisions\n- Achieve 95% compliance with chute-time targets",
      status: "active",
      ownerId: adminUser?.id ?? null,
      startDate: seedDate(1, 1),
      endDate: seedDate(12, 31),
      sortOrder: 1,
    },
  });

  // Associate first diagram with this campaign
  await prisma.driverDiagram.update({
    where: { slug: "reduce-emergency-response-time" },
    data: { campaignId: campaign1.id },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      name: "Cardiac Arrest Survival Program",
      slug: "cardiac-arrest-survival-program",
      description: "Multi-year program targeting improved cardiac arrest outcomes through crew training, equipment deployment, and protocol optimization.",
      goals: "- Achieve >15% neurologically intact survival rate\n- Deploy mechanical CPR on all ALS units\n- Quarterly simulation drills for all ALS crews\n- Implement double sequential defibrillation protocol",
      status: "active",
      ownerId: adminUser?.id ?? null,
      startDate: seedDate(3, 1),
      endDate: null,
      sortOrder: 2,
    },
  });

  // Associate second diagram with this campaign
  await prisma.driverDiagram.update({
    where: { slug: "improve-cardiac-arrest-survival" },
    data: { campaignId: campaign2.id },
  });

  // Action Items
  await prisma.actionItem.create({
    data: {
      title: "Procure GPS-based CAD module",
      description: "Work with IT to purchase and integrate GPS-based unit recommendation module for CAD system.",
      status: "in_progress",
      priority: "high",
      dueDate: seedDate(6, 30),
      campaignId: campaign1.id,
      assigneeId: adminUser?.id ?? null,
    },
  });

  await prisma.actionItem.create({
    data: {
      title: "Draft staggered shift change policy",
      description: "Write operational policy document for 30-minute overlapping shift changes.",
      status: "completed",
      priority: "medium",
      dueDate: seedDate(4, 1),
      completedAt: seedDate(3, 25),
      campaignId: campaign1.id,
      assigneeId: adminUser?.id ?? null,
    },
  });

  await prisma.actionItem.create({
    data: {
      title: "Order LUCAS 3 devices for remaining ALS units",
      description: "Submit purchase order for 4 additional LUCAS 3 mechanical CPR devices.",
      status: "open",
      priority: "high",
      dueDate: seedDate(8, 15),
      campaignId: campaign2.id,
      assigneeId: adminUser?.id ?? null,
    },
  });

  await prisma.actionItem.create({
    data: {
      title: "Schedule Q3 cardiac arrest simulation drills",
      description: "Coordinate with training division to schedule simulations for all ALS crews in Q3.",
      status: "open",
      priority: "medium",
      dueDate: seedDate(7, 1),
      campaignId: campaign2.id,
      assigneeId: adminUser?.id ?? null,
    },
  });

  console.log("  Created 2 campaigns with 4 action items.");

  // =========================================================================
  // FIELD TRAINING — expanded
  // =========================================================================
  console.log("\nCreating field training data...");
  const phases = [
    { name: "Orientation", slug: "orientation", sortOrder: 1, minDays: 5 },
    { name: "Direct Supervision", slug: "direct-supervision", sortOrder: 2, minDays: 30 },
    { name: "Indirect Supervision", slug: "indirect-supervision", sortOrder: 3, minDays: 20 },
    { name: "Solo Evaluation", slug: "solo-evaluation", sortOrder: 4, minDays: 10 },
  ];
  const phaseRecords = {};
  for (const p of phases) { const c = await prisma.trainingPhase.create({ data: p }); phaseRecords[p.slug] = c.id; }

  const evalCategories = [
    { name: "Appearance/Demeanor", slug: "appearance-demeanor", sortOrder: 1 },
    { name: "Attitude/Acceptance of Feedback", slug: "attitude-feedback", sortOrder: 2 },
    { name: "Knowledge — EMS Protocols", slug: "knowledge-protocols", sortOrder: 3 },
    { name: "Knowledge — Department Policies", slug: "knowledge-policies", sortOrder: 4 },
    { name: "Scene Management/Safety", slug: "scene-management", sortOrder: 5 },
    { name: "Patient Assessment", slug: "patient-assessment", sortOrder: 6 },
    { name: "Clinical Decision-Making", slug: "clinical-decision-making", sortOrder: 7 },
    { name: "Patient Communication", slug: "patient-communication", sortOrder: 8 },
    { name: "Crew/Agency Communication", slug: "crew-communication", sortOrder: 9 },
    { name: "Documentation/Report Writing", slug: "documentation", sortOrder: 10 },
    { name: "Driving/Vehicle Operations", slug: "driving-vehicle-ops", sortOrder: 11 },
    { name: "Equipment Use & Maintenance", slug: "equipment-maintenance", sortOrder: 12 },
    { name: "Officer Safety/Situational Awareness", slug: "officer-safety", sortOrder: 13 },
    { name: "Stress Tolerance/Emotional Regulation", slug: "stress-tolerance", sortOrder: 14 },
  ];
  const evalCatRecords = {};
  for (const ec of evalCategories) { const c = await prisma.evaluationCategory.create({ data: ec }); evalCatRecords[ec.slug] = c.id; }
  const catSlugs = evalCategories.map((ec) => ec.slug);

  // ── Coaching Activities ────────────────────────────────────────────────
  console.log("  Seeding coaching activities...");
  const coachingActivities = [
    { categorySlug: "knowledge-protocols", title: "Protocol Review: Chest Pain", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Review the chest pain assessment and treatment protocol.", content: "CHEST PAIN / ACS PROTOCOL REVIEW\n\nKey Steps:\n1. Perform a 12-lead ECG within 5 minutes of patient contact\n2. Administer aspirin 324mg PO (if not allergic, not already taken)\n3. Establish IV access\n4. Administer nitroglycerin 0.4mg SL if SBP > 100 and no contraindications\n5. Assess pain using 0-10 scale before and after interventions\n6. Transmit 12-lead to receiving facility\n7. Consider fentanyl for pain management per protocol\n\nCritical Thinking Points:\n- What are the contraindications for nitroglycerin?\n- When should you activate a STEMI alert?\n- How do you differentiate ACS from other causes of chest pain?" },
    { categorySlug: "knowledge-protocols", title: "Protocol Review: Respiratory Distress", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Review the respiratory distress assessment and treatment protocol.", content: "RESPIRATORY DISTRESS PROTOCOL REVIEW\n\nAssessment Framework:\n1. Determine onset, duration, and severity\n2. Auscultate lung sounds in all fields\n3. Obtain SpO2, EtCO2, and vital signs\n4. Identify potential causes: asthma, COPD, CHF, pneumonia, PE, anaphylaxis\n\nTreatment Priorities:\n- Supplemental O2 to maintain SpO2 > 94% (88-92% for COPD)\n- Position of comfort (usually sitting upright)\n- Nebulized albuterol for bronchospasm\n- CPAP for pulmonary edema or severe distress\n- Epinephrine for anaphylaxis\n\nRed Flags:\n- Inability to speak in full sentences\n- Use of accessory muscles\n- Altered mental status\n- Silent chest on auscultation" },
    { categorySlug: "knowledge-protocols", title: "Protocol Knowledge: Self-Assessment", type: "reflection", difficulty: "basic", estimatedMins: 15, description: "Reflect on protocol knowledge gaps and create an improvement plan.", content: "Take a moment to reflect on your protocol knowledge. Consider the following questions and write a thoughtful response.\n\n1. Which protocols do you feel most confident with? Why?\n2. Which protocols do you feel least confident with? What specific areas are unclear?\n3. Can you describe the decision tree for a patient presenting with altered mental status?\n4. What is your plan to strengthen your weaker areas?" },
    { categorySlug: "patient-assessment", title: "Systematic Patient Assessment", type: "reading", difficulty: "basic", estimatedMins: 12, description: "Review the systematic approach to patient assessment.", content: "SYSTEMATIC PATIENT ASSESSMENT\n\nScene Size-Up:\n- Scene safety, BSI/PPE, mechanism of injury or nature of illness\n- Number of patients, additional resources needed\n\nPrimary Assessment (60 seconds):\n- General impression: age, gender, position, chief complaint\n- Level of consciousness (AVPU)\n- Airway: patent, maintainable, unmaintainable\n- Breathing: rate, depth, adequacy, lung sounds\n- Circulation: pulse, skin color/temp/moisture, bleeding control\n- Priority/transport decision\n\nSecondary Assessment:\n- Focused vs. rapid physical exam\n- OPQRST for pain complaints\n- SAMPLE history\n- Vital signs (full set)\n- Head-to-toe or focused exam based on complaint\n\nCommon Pitfalls:\n- Tunnel vision on chief complaint\n- Skipping reassessments\n- Not trending vital signs\n- Forgetting to reassess after interventions" },
    { categorySlug: "patient-assessment", title: "Assessment Priorities Reflection", type: "reflection", difficulty: "intermediate", estimatedMins: 15, description: "Reflect on your assessment approach and identify areas for improvement.", content: "Think about your recent patient encounters and reflect on your assessment skills.\n\n1. Describe a recent call where your assessment went well. What made it effective?\n2. Describe a call where you missed something or could have assessed better. What would you do differently?\n3. How do you prioritize your assessment when faced with multiple findings?\n4. What assessment techniques do you want to practice more?" },
    { categorySlug: "patient-communication", title: "Effective Patient Communication", type: "reading", difficulty: "basic", estimatedMins: 8, description: "Review best practices for communicating with patients.", content: "EFFECTIVE PATIENT COMMUNICATION\n\nFirst Impressions:\n- Introduce yourself by name and role\n- Make eye contact and get on patient's level\n- Use calm, confident tone\n\nActive Listening:\n- Let the patient tell their story without interruption\n- Use open-ended questions first, then focused questions\n- Acknowledge their concerns: \"I understand this is frightening\"\n\nExplaining Care:\n- Tell the patient what you're going to do before you do it\n- Explain why: \"I'm starting an IV so we can give you medication for pain\"\n- Check understanding: \"Do you have any questions?\"\n\nDifficult Situations:\n- Anxious patients: validate emotions, provide reassurance with facts\n- Uncooperative patients: remain professional, explain consequences calmly\n- Pediatric patients: speak to the child and parent, use age-appropriate language\n- Hearing/language barriers: speak clearly, use interpreter services" },
    { categorySlug: "patient-communication", title: "Communication Scenario", type: "scenario", difficulty: "intermediate", estimatedMins: 15, description: "Interactive scenario: Communicating with an anxious patient refusing treatment.", content: null },
    { categorySlug: "crew-communication", title: "Crew Resource Management Basics", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Review CRM principles for effective crew communication.", content: "CREW RESOURCE MANAGEMENT (CRM)\n\nCore Principles:\n1. Closed-loop communication: Give order → Repeat back → Confirm\n2. Speak up: If you see something wrong, say something\n3. Use SBAR for handoffs: Situation, Background, Assessment, Recommendation\n4. Assign roles clearly during critical events\n\nRadio Communication:\n- Be concise and organized\n- Use standard terminology\n- State unit number, location, and request clearly\n- Confirm receipt of orders\n\nHospital Handoff (SBAR):\n- Situation: \"This is [name] from [unit], we're bringing a [age/gender] with [chief complaint]\"\n- Background: \"They have a history of [PMH], currently on [medications]\"\n- Assessment: \"Vitals are [vitals], we found [findings], we've done [treatments]\"\n- Recommendation: \"We think they need [interventions/evaluation]\"" },
    { categorySlug: "clinical-decision-making", title: "Clinical Decision-Making Framework", type: "reading", difficulty: "intermediate", estimatedMins: 12, description: "Review frameworks for making better clinical decisions in the field.", content: "CLINICAL DECISION-MAKING FRAMEWORK\n\nThe Decision Process:\n1. Gather information (assessment)\n2. Form a differential diagnosis (consider multiple possibilities)\n3. Rule out life threats first\n4. Select the most likely diagnosis\n5. Implement treatment plan\n6. Reassess and adjust\n\nAvoiding Common Errors:\n- Anchoring bias: Don't lock onto the first diagnosis\n- Confirmation bias: Actively look for findings that don't fit your working diagnosis\n- Premature closure: Keep reassessing, conditions change\n\nWhen Unsure:\n- Treat the worst-case scenario first\n- Consult medical control\n- Document your reasoning\n- It's OK to say \"I'm not sure\" — then work the problem systematically" },
    { categorySlug: "clinical-decision-making", title: "Decision-Making Reflection", type: "reflection", difficulty: "intermediate", estimatedMins: 15, description: "Reflect on a clinical decision you made and analyze your thought process.", content: "Reflect on a recent clinical decision during a call.\n\n1. What was the patient's chief complaint and presentation?\n2. What were your differential diagnoses? How did you narrow them down?\n3. What treatment did you provide and why?\n4. Looking back, would you make the same decisions? What might you do differently?\n5. Did you feel rushed? How did time pressure affect your thinking?" },
    { categorySlug: "documentation", title: "PCR Documentation Best Practices", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Review standards for complete and accurate patient care reports.", content: "PCR DOCUMENTATION BEST PRACTICES\n\nGolden Rules:\n1. If you didn't document it, you didn't do it\n2. Document what you found AND what you didn't find (pertinent negatives)\n3. Be objective — describe observations, not interpretations\n4. Use standardized medical terminology\n\nNarrative Structure:\n- Chief complaint and mechanism/nature of illness\n- Assessment findings (organized by system)\n- Interventions and patient response\n- Changes in condition during transport\n- Handoff information\n\nCommon Deficiencies:\n- Missing vital sign times\n- No reassessment after interventions\n- Vague descriptions (\"patient looks bad\" vs. specific findings)\n- Missing pertinent negatives\n- Incomplete medication documentation (dose, route, time, response)" },
    { categorySlug: "scene-management", title: "Scene Management Principles", type: "reading", difficulty: "basic", estimatedMins: 8, description: "Review scene safety and management fundamentals.", content: "SCENE MANAGEMENT PRINCIPLES\n\nBefore Arriving:\n- Consider dispatch information and potential hazards\n- Request additional resources early if needed\n- Plan your approach and parking position\n\nOn Scene:\n- BSI/PPE appropriate to the situation\n- 360-degree scene assessment\n- Identify and mitigate hazards before patient contact\n- Establish command if multi-agency response\n\nCrowd/Bystander Management:\n- Assign a bystander to help if needed\n- Create a safe working perimeter\n- Protect patient privacy\n\nLift Assist / Patient Movement:\n- Assess the environment for safe lift path\n- Use proper body mechanics\n- Communicate with your partner throughout the move" },
    { categorySlug: "stress-tolerance", title: "Stress Management for EMS", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Learn strategies for managing stress in high-pressure EMS situations.", content: "STRESS MANAGEMENT FOR EMS PROVIDERS\n\nRecognizing Stress:\n- Physical: increased heart rate, tunnel vision, muscle tension\n- Cognitive: difficulty concentrating, indecision, forgetting steps\n- Emotional: frustration, anxiety, feeling overwhelmed\n\nIn-the-Moment Strategies:\n- Tactical breathing: 4 counts in, 4 hold, 4 out, 4 hold\n- Cognitive reframing: \"This is a challenge I've trained for\"\n- Task-focus: concentrate on the next single step, not the whole situation\n- Verbalize your plan aloud — it helps organize your thinking\n\nAfter Difficult Calls:\n- Debrief with your partner/crew\n- Use peer support resources — talking helps\n- Maintain healthy sleep, nutrition, and exercise habits\n- Know when to ask for professional help — it's a sign of strength" },
    { categorySlug: "attitude-feedback", title: "Receiving Feedback Effectively", type: "reflection", difficulty: "basic", estimatedMins: 10, description: "Reflect on how you receive and use feedback to improve.", content: "Feedback is one of the most important tools for professional growth in EMS.\n\n1. Think about a time you received constructive feedback. What was your initial reaction?\n2. How did you ultimately use that feedback to improve?\n3. What makes feedback easier to receive? What makes it harder?\n4. How can you actively seek out more feedback from your FTO and peers?\n5. Describe one specific thing you've changed about your practice based on feedback." },
    { categorySlug: "driving-vehicle-ops", title: "Emergency Vehicle Operations Review", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Review safe emergency vehicle operation principles.", content: "EMERGENCY VEHICLE OPERATIONS\n\nPre-Trip:\n- Complete vehicle inspection checklist\n- Adjust mirrors, seat, steering wheel\n- Know your route options\n\nEmergency Response Driving:\n- Lights and sirens do NOT give you right of way — they REQUEST it\n- Clear EVERY intersection, even with a green light\n- Maintain safe following distance (4+ seconds)\n- Reduce speed in residential areas, school zones, adverse conditions\n- Avoid backing when possible; use a spotter when you must\n\nWith a Patient:\n- Drive smoothly — sudden stops/starts affect patient care\n- Communicate with the crew in back about driving conditions\n- Non-emergency transport is the default unless critical patient\n\nPost-Run:\n- Report any vehicle damage or issues immediately\n- Refuel if below 3/4 tank\n- Restock supplies used" },
    { categorySlug: "appearance-demeanor", title: "Professional Appearance & Conduct", type: "reflection", difficulty: "basic", estimatedMins: 8, description: "Reflect on how your professional appearance affects patient and crew interactions.", content: "Professional appearance and demeanor directly impact patient trust and care outcomes.\n\n1. How does your uniform appearance affect the way patients perceive you?\n2. Describe a time when maintaining a professional demeanor was challenging. How did you handle it?\n3. What does \"professional behavior\" mean to you in the context of EMS?\n4. How can you model professionalism for future new hires?" },
    { categorySlug: "equipment-maintenance", title: "Equipment Familiarity Checklist", type: "reading", difficulty: "basic", estimatedMins: 10, description: "Review key equipment operation and troubleshooting steps.", content: "EQUIPMENT FAMILIARITY & MAINTENANCE\n\nCardiac Monitor/Defibrillator:\n- Know how to power on, select leads, print strips\n- Practice switching between monitoring and defibrillation modes\n- Know battery life and where spares are stored\n- Troubleshoot: poor tracing → check lead placement and cable connections\n\nSuction Unit:\n- Test before each shift\n- Know where replacement canisters and tubing are stored\n- Troubleshoot: weak suction → check connections, canister full, battery charge\n\nVentilator/CPAP:\n- Know settings for different patient populations\n- Practice setup rapidly\n- Know contraindications\n\nDaily Equipment Check:\n- All equipment present per checklist\n- Batteries charged/spares available\n- Expiration dates current on medications and supplies\n- Report deficiencies immediately" },
    { categorySlug: "officer-safety", title: "Situational Awareness for EMS", type: "reading", difficulty: "basic", estimatedMins: 8, description: "Review situational awareness principles for scene safety.", content: "SITUATIONAL AWARENESS FOR EMS\n\nCooper's Color Code:\n- White: Unaware (never be here on a call)\n- Yellow: Relaxed alert (default on-scene awareness)\n- Orange: Specific alert (potential threat identified)\n- Red: Action required (threat is real, act now)\n\nKey Principles:\n- Always know your exit routes\n- Position yourself between the patient and the exit when possible\n- Watch hands — most threats come from what you can't see\n- Trust your instincts — if something feels wrong, create distance\n- Stage for law enforcement when dispatch advises or scene seems unsafe\n\nDe-escalation:\n- Use calm, low voice\n- Give the person space\n- Avoid threatening body language\n- Empathize: \"I can see you're upset, I want to help\"\n- Know when to disengage and wait for PD" },
  ];
  for (const ca of coachingActivities) {
    const catId = evalCatRecords[ca.categorySlug];
    if (!catId) { console.warn(`  Skipping coaching activity: no category for slug "${ca.categorySlug}"`); continue; }
    await prisma.coachingActivity.create({
      data: {
        title: ca.title,
        description: ca.description,
        categoryId: catId,
        type: ca.type,
        content: ca.content,
        difficulty: ca.difficulty,
        estimatedMins: ca.estimatedMins,
      },
    });
  }
  console.log(`  Created ${coachingActivities.length} coaching activities.\n`);

  const skillDefs = [
    { category: { name: "Airway Management", slug: "airway-management", sortOrder: 1 }, skills: [{ name: "OPA", slug: "opa", sortOrder: 1 },{ name: "NPA", slug: "npa", sortOrder: 2 },{ name: "Supraglottic Airway", slug: "supraglottic-airway", sortOrder: 3, isCritical: true },{ name: "Endotracheal Intubation", slug: "endotracheal-intubation", sortOrder: 4, isCritical: true },{ name: "Surgical Cricothyrotomy", slug: "surgical-cric", sortOrder: 5, isCritical: true },{ name: "Suctioning", slug: "suctioning", sortOrder: 6 }] },
    { category: { name: "Cardiac Care", slug: "cardiac-care", sortOrder: 2 }, skills: [{ name: "12-Lead ECG", slug: "12-lead-ecg", sortOrder: 1, isCritical: true },{ name: "Cardiac Monitor", slug: "cardiac-monitor", sortOrder: 2 },{ name: "Cardioversion", slug: "synchronized-cardioversion", sortOrder: 3, isCritical: true },{ name: "Defibrillation", slug: "defibrillation", sortOrder: 4, isCritical: true },{ name: "TCP", slug: "tcp", sortOrder: 5, isCritical: true },{ name: "CPR Quality", slug: "cpr-quality", sortOrder: 6 }] },
    { category: { name: "Trauma Care", slug: "trauma-care", sortOrder: 3 }, skills: [{ name: "Spinal Motion Restriction", slug: "spinal-motion-restriction", sortOrder: 1 },{ name: "Tourniquet", slug: "tourniquet", sortOrder: 2, isCritical: true },{ name: "Wound Packing", slug: "wound-packing", sortOrder: 3, isCritical: true },{ name: "Splinting", slug: "splinting", sortOrder: 4 },{ name: "Chest Seal", slug: "chest-seal", sortOrder: 5 },{ name: "Needle Thoracostomy", slug: "needle-thoracostomy", sortOrder: 6, isCritical: true }] },
    { category: { name: "Medical Emergencies", slug: "medical-emergencies", sortOrder: 4 }, skills: [{ name: "Blood Glucose", slug: "blood-glucose", sortOrder: 1 },{ name: "IV Access", slug: "iv-access", sortOrder: 2, isCritical: true },{ name: "IO Access", slug: "io-access", sortOrder: 3, isCritical: true },{ name: "Medication Admin", slug: "medication-admin", sortOrder: 4, isCritical: true },{ name: "Nebulizer", slug: "nebulizer", sortOrder: 5 },{ name: "Stroke Assessment", slug: "stroke-assessment", sortOrder: 6 }] },
    { category: { name: "OB/Pediatrics", slug: "ob-pediatrics", sortOrder: 5 }, skills: [{ name: "Normal Delivery", slug: "normal-delivery", sortOrder: 1, isCritical: true },{ name: "Neonatal Resus", slug: "neonatal-resus", sortOrder: 2, isCritical: true },{ name: "Ped Assessment Triangle", slug: "ped-assessment-triangle", sortOrder: 3 },{ name: "Ped Medication Dosing", slug: "ped-medication-dosing", sortOrder: 4 },{ name: "Ped Airway", slug: "ped-airway", sortOrder: 5, isCritical: true }] },
    { category: { name: "Driving & Operations", slug: "driving-operations", sortOrder: 6 }, skills: [{ name: "EVOC", slug: "evoc", sortOrder: 1, isCritical: true },{ name: "Non-Emergency Driving", slug: "non-emergency-driving", sortOrder: 2 },{ name: "Vehicle Inspection", slug: "vehicle-inspection", sortOrder: 3 },{ name: "Equipment Inventory", slug: "equipment-inventory", sortOrder: 4 },{ name: "Radio Comms", slug: "radio-comms", sortOrder: 5 }] },
    { category: { name: "Administrative", slug: "administrative", sortOrder: 7 }, skills: [{ name: "PCR Completion", slug: "pcr-completion", sortOrder: 1 },{ name: "Billing Documentation", slug: "billing-documentation", sortOrder: 2 },{ name: "HIPAA Compliance", slug: "hipaa-compliance", sortOrder: 3 },{ name: "Controlled Substance Docs", slug: "controlled-substance-docs", sortOrder: 4, isCritical: true },{ name: "Incident Reporting", slug: "incident-reporting", sortOrder: 5 },{ name: "MCI/ICS Documentation", slug: "mci-ics-docs", sortOrder: 6 }] },
  ];
  const skillRecords = {};
  const allSkillKeys = [];
  for (const sd of skillDefs) {
    const cat = await prisma.skillCategory.create({ data: sd.category });
    for (const sk of sd.skills) {
      const key = `${sd.category.slug}/${sk.slug}`;
      const c = await prisma.skill.create({ data: { categoryId: cat.id, name: sk.name, slug: sk.slug, isCritical: sk.isCritical || false, sortOrder: sk.sortOrder } });
      skillRecords[key] = c.id;
      allSkillKeys.push(key);
    }
  }

  // =========================================================================
  // TRAINING ASSIGNMENTS — every trainee gets an FTO
  // =========================================================================
  const traineeAssignments = [
    { trainee: trainee1, fto: sup1, start: 1 },    // Alex → Marcus (supervisor)
    { trainee: trainee2, fto: fto1, start: 0 },     // Jordan → Rachel
    { trainee: trainee3, fto: fto2, start: 3 },     // Megan → Brian
    { trainee: trainee4, fto: fto3, start: 5 },     // Ryan → Samantha
    { trainee: trainee5, fto: fto5, start: 7 },     // Hannah → Natalie (Air Care)
    { trainee: trainee6, fto: fto4, start: 9 },     // Ethan → Tyler
    { trainee: trainee7, fto: fto6, start: 11 },    // Olivia → Kevin
    { trainee: trainee8, fto: fto7, start: 13 },    // Lucas → Amanda
    { trainee: trainee9, fto: fto8, start: 0 },     // Sophia (completed) → Jason
    { trainee: trainee10, fto: fto1, start: 4 },    // Noah (separated) → Rachel
  ];
  for (const ta of traineeAssignments) {
    await prisma.trainingAssignment.create({ data: { traineeId: ta.trainee.id, ftoId: ta.fto.id, startDate: seedDate(ta.start, 1), status: ta.trainee === trainee9 ? "completed" : ta.trainee === trainee10 ? "reassigned" : "active" } });
  }

  // =========================================================================
  // TRAINEE PHASES — varied progress for each trainee
  // =========================================================================

  // Helper: create phases for a trainee at a given progress level
  async function createTraineePhases(trainee, progressLevel, ftoForSignoff, startMonthIdx) {
    // progressLevel: 0=orientation, 1=direct, 2=indirect, 3=solo, 4=completed all
    const phaseList = ["orientation", "direct-supervision", "indirect-supervision", "solo-evaluation"];
    for (let i = 0; i < phaseList.length; i++) {
      let status, startD, endD, signoff;
      if (i < progressLevel) {
        // completed
        status = "completed";
        startD = seedDate(startMonthIdx + i * 2, 1);
        endD = seedDate(startMonthIdx + i * 2 + 1, 28);
        signoff = ftoForSignoff.id;
      } else if (i === progressLevel) {
        // in_progress
        status = "in_progress";
        startD = seedDate(startMonthIdx + i * 2, 1);
        endD = null;
        signoff = null;
      } else {
        // not_started
        status = "not_started";
        startD = null;
        endD = null;
        signoff = null;
      }
      await prisma.traineePhase.create({ data: { traineeId: trainee.id, phaseId: phaseRecords[phaseList[i]], startDate: startD, endDate: endD, status, ftoSignoffId: signoff } });
    }
  }

  // Trainee progress assignments
  await createTraineePhases(trainee1, 1, sup1, 1);      // Alex: in Direct Supervision
  await createTraineePhases(trainee2, 0, fto1, 0);       // Jordan: in Orientation
  await createTraineePhases(trainee3, 2, fto2, 3);       // Megan: in Indirect Supervision
  await createTraineePhases(trainee4, 1, fto3, 5);       // Ryan: in Direct Supervision
  await createTraineePhases(trainee5, 1, fto5, 7);       // Hannah: in Direct Supervision
  await createTraineePhases(trainee6, 0, fto4, 9);       // Ethan: in Orientation
  await createTraineePhases(trainee7, 0, fto6, 11);      // Olivia: in Orientation
  await createTraineePhases(trainee8, 0, fto7, 13);      // Lucas: in Orientation (newest)
  await createTraineePhases(trainee9, 4, fto8, 0);       // Sophia: completed all phases
  await createTraineePhases(trainee10, 1, fto1, 4);      // Noah: was in Direct (separated)

  // =========================================================================
  // DORs — Generate realistic DOR data for each active trainee
  // =========================================================================
  console.log("  Creating DORs for all trainees...");

  // Per-category comment pools — keyed by slug, with high/low variants
  const categoryComments = {
    "appearance-demeanor": {
      high: ["Professional appearance, well-groomed, uniform squared away.", "Sharp presentation — good first impression with patients and families.", "Consistently maintains professional appearance.", null],
      low: ["Needs to pay attention to uniform standards — shirt untucked on two calls.", "Arrived with wrinkled uniform; reviewed dress code expectations.", "Could be more conscious of professional image.", null],
    },
    "attitude-feedback": {
      high: ["Receptive to coaching and implements feedback immediately.", "Great attitude — asks thoughtful follow-up questions after feedback.", "Takes constructive criticism well and applies it on the next call.", null],
      low: ["Became defensive when given feedback about IV technique.", "Needs to be more open to coaching — argued about protocol interpretation.", "Resistant to feedback today; discussed importance of growth mindset.", null],
    },
    "knowledge-protocols": {
      high: ["Strong protocol knowledge — correctly identified STEMI criteria without prompting.", "Accurately recalled medication dosages for pediatric patient.", "Solid grasp of chest pain protocol and decision points.", null],
      low: ["Confused stroke protocol steps — need to review FAST assessment.", "Incorrectly stated dose for adenosine; scheduled pharmacology review.", "Needs to review altered mental status protocol — missed key steps.", null],
    },
    "knowledge-policies": {
      high: ["Good understanding of department SOPs and documentation requirements.", "Correctly followed MCI notification policy on a multi-patient incident.", null],
      low: ["Unfamiliar with controlled substance documentation requirements.", "Needs to review patient refusal policy and required documentation.", null],
    },
    "scene-management": {
      high: ["Excellent scene management on a chaotic MVC — maintained control.", "Great situational awareness on a domestic violence call.", "Solid scene size-up and good use of bystanders for crowd control.", null],
      low: ["Tunnel-visioned on patient and missed scene hazards.", "Needs to establish command presence earlier — scene was disorganized.", "Didn't request PD for a behavioral call in a sketchy area.", null],
    },
    "patient-assessment": {
      high: ["Thorough head-to-toe assessment — didn't miss the posterior rib fractures.", "Excellent SAMPLE/OPQRST on a chest pain patient.", "Identified subtle stroke symptoms that others might miss.", null],
      low: ["Missed a secondary injury on a fall patient — need to be more thorough.", "Assessment was rushed — didn't auscultate lung sounds on a dyspnea call.", "Needs to develop a systematic approach — assessment was disorganized.", null],
    },
    "clinical-decision-making": {
      high: ["Made excellent decision to bypass closer facility for STEMI center.", "Good clinical judgment — recognized sepsis early and initiated protocol.", "Appropriate use of standing orders for chest pain management.", null],
      low: ["Chose BLS transport for a patient who needed ALS intervention.", "Delayed medication administration due to uncertainty — discuss with medical control sooner.", "Struggled with treatment prioritization on a multi-system trauma.", null],
    },
    "patient-communication": {
      high: ["Excellent bedside manner with anxious pediatric patient and family.", "Communicated plan of care clearly — patient and family felt reassured.", "Great de-escalation with an agitated patient.", null],
      low: ["Used too much medical jargon — patient was confused about treatment.", "Needs to explain procedures before performing them.", "Minimal communication with patient during transport — felt impersonal.", null],
    },
    "crew-communication": {
      high: ["Clear, concise radio report to receiving facility.", "Great closed-loop communication during cardiac arrest.", "Communicated well with fire crew on scene.", null],
      low: ["Radio report was disorganized — practice SBAR format.", "Didn't communicate patient status changes to partner during transport.", "Late hospital notification on a trauma alert.", null],
    },
    "documentation": {
      high: ["PCR was thorough and completed before end of shift.", "Excellent narrative — painted a clear clinical picture.", "Good use of timestamps and interventions in documentation.", null],
      low: ["PCR not completed until next day — needs to prioritize documentation.", "Narrative was too brief — didn't document clinical decision-making.", "Missing vital sign trends in documentation.", null],
    },
    "driving-vehicle-ops": {
      high: ["Smooth driving, appropriate speed, good use of mirrors.", "Safe emergency driving — proper intersection clearing.", "Good backing skills and spatial awareness.", null],
      low: ["Took corners too fast with patient in back.", "Needs to work on smooth braking — patient complained about rough ride.", "Missed a turn due to unfamiliarity with response area.", null],
    },
    "equipment-maintenance": {
      high: ["Thorough rig check — found and replaced expired medications.", "Good equipment familiarity — set up for RSI without prompting.", "Knows where everything is and keeps workspace organized.", null],
      low: ["Didn't check suction unit during rig check — it wasn't working on scene.", "Unfamiliar with ventilator setup — took too long on critical call.", "Left airway bag unrestocked after a call.", null],
    },
    "officer-safety": {
      high: ["Good scene awareness — noticed weapon in residence and repositioned.", "Appropriate use of PPE on every call.", "Maintained egress path on a volatile behavioral call.", null],
      low: ["Approached scene without staging for PD on a reported assault.", "Forgot gloves on a bleeding patient — reviewed BSI/PPE requirements.", "Positioned ambulance too close to structure fire.", null],
    },
    "stress-tolerance": {
      high: ["Remained calm and focused during a pediatric cardiac arrest.", "Handled a combative patient without escalating the situation.", "Good composure on a high-acuity shift with back-to-back calls.", null],
      low: ["Got visibly flustered during a high-acuity call — froze momentarily.", "Stress level affected communication with crew during critical call.", "Needs coping strategies for high-stress calls — discussed options.", null],
    },
  };

  // Generate a set of DORs for a trainee
  async function generateDORs(trainee, fto, phaseSlug, startMonthIdx, count, progressionType) {
    // progressionType: "improving", "steady", "struggling"
    const dorRecords = [];
    for (let d = 0; d < count; d++) {
      const monthIdx = startMonthIdx + Math.floor(d / 3);
      const dayOffset = (d % 3) * 4 + 2; // space them out
      const date = seedDate(monthIdx, Math.min(dayOffset + 1, 28));

      let baseRating;
      if (progressionType === "improving") {
        baseRating = Math.min(7, 2 + Math.floor(d * 0.5) + (random() > 0.5 ? 1 : 0));
      } else if (progressionType === "struggling") {
        baseRating = Math.min(5, 2 + Math.floor(d * 0.15) + (random() > 0.7 ? 1 : 0));
      } else {
        baseRating = Math.min(7, 4 + Math.floor(random() * 2));
      }
      baseRating = Math.max(1, Math.min(7, baseRating));

      const ratings = catSlugs.map(() => {
        const r = baseRating + Math.floor((random() - 0.4) * 3);
        return Math.max(1, Math.min(7, r));
      });
      const overall = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);

      let recommend;
      if (d === count - 1 && progressionType === "improving" && overall >= 5) recommend = "advance";
      else if (progressionType === "struggling" && overall <= 2) recommend = "remediate";
      else recommend = "continue";

      const nrtFlag = progressionType === "struggling" && d > 4 && overall <= 2;
      const acknowledged = random() > 0.15; // 85% acknowledged

      // Find best and worst categories for mostSatisfactory/leastSatisfactory
      let bestIdx = 0, worstIdx = 0;
      for (let j = 1; j < ratings.length; j++) {
        if (ratings[j] > ratings[bestIdx]) bestIdx = j;
        if (ratings[j] < ratings[worstIdx]) worstIdx = j;
      }
      const mostSatisfactory = evalCategories[bestIdx].name;
      const leastSatisfactory = bestIdx !== worstIdx ? evalCategories[worstIdx].name : null;

      const narratives = [
        "Solid shift. Good patient interactions and improving clinical skills. Ran 4 calls total — two BLS transports, one chest pain, and one fall with hip injury. Showed good improvement from last shift.",
        "Trainee demonstrated competence in scene management today. Handled a 3-car MVC as lead medic with minimal coaching needed. Good triage decisions.",
        "Struggled with documentation timeliness but clinical decisions were sound. PCR from first call wasn't started until third call — need to prioritize real-time documentation.",
        "Excellent assessment skills on a multi-system trauma patient. Identified tension pneumothorax clinically and performed needle decompression under supervision. Textbook performance.",
        "Needs more work on radio communication and scene size-up. Hospital notification was disorganized — practiced SBAR format during downtime.",
        "Good improvement from last shift. More confident with IV access — got two difficult sticks today. Building good rapport with patients.",
        "Handled a cardiac arrest well — followed ACLS protocols accurately. Took charge of airway management and communicated clearly with the team. Debriefed after the call.",
        "Struggled with pediatric dosing calculations on a febrile seizure call. No patient harm but delayed treatment. Will review weight-based dosing at next training.",
        "Outstanding shift. Minimal coaching needed for all 5 calls. Ready to advance — clinical skills, communication, and documentation all at acceptable level.",
        "Worked an MCI drill — good command presence but needs work on triage speed. START triage was accurate but took longer than ideal. Good radio communication during drill.",
        "Quiet shift — only 2 BLS calls. Used downtime productively to review protocols and practice skills in the sim lab. Good initiative.",
        "Busy 12-hour shift with 7 calls. Trainee managed fatigue well and maintained quality patient care throughout. Discussed strategies for sustained performance.",
        "First shift on the medic unit — showed eagerness to learn. Some nervous energy but channeled it productively. Foundation is there — needs reps.",
        "Responded to a bariatric patient — good problem-solving for access and transport challenges. Communicated well with fire crew for lift assist.",
        null, null, // some without narrative
      ];

      // Supervisor notes — only on ~30% of DORs
      const supervisorNotePool = [
        "Reviewed this DOR with trainee during check-in. Good progress overall.",
        "Discussed clinical decision-making with FTO — agree with assessment.",
        "Flagged for follow-up on documentation improvement.",
        "Strong performance — discussed timeline for phase advancement.",
        "Met with trainee to discuss stress management after difficult call.",
        null, null, null, null, null, null, null, // most have no supervisor notes
      ];

      const dor = await prisma.dailyEvaluation.create({
        data: {
          traineeId: trainee.id,
          ftoId: fto.id,
          phaseId: phaseRecords[phaseSlug],
          date,
          overallRating: Math.max(1, Math.min(7, overall)),
          narrative: pick(narratives),
          mostSatisfactory,
          leastSatisfactory,
          recommendAction: recommend,
          nrtFlag,
          traineeAcknowledged: acknowledged,
          acknowledgedAt: acknowledged ? new Date(date.getTime() + 86400000) : null,
          supervisorNotes: pick(supervisorNotePool),
          status: "submitted",
        },
      });

      // Create evaluation ratings WITH per-category comments
      for (let j = 0; j < catSlugs.length; j++) {
        const slug = catSlugs[j];
        const rating = ratings[j];
        let comment = null;

        // ~60% of categories get a comment
        if (random() > 0.4 && categoryComments[slug]) {
          const pool = rating >= 4 ? categoryComments[slug].high : categoryComments[slug].low;
          comment = pick(pool);
        }

        await prisma.evaluationRating.create({
          data: {
            evaluationId: dor.id,
            categoryId: evalCatRecords[slug],
            rating,
            comments: comment,
          },
        });
      }
      dorRecords.push(dor);
    }
    return dorRecords;
  }

  // DOR generation per trainee
  await generateDORs(trainee1, sup1, "direct-supervision", 2, 12, "improving");
  await generateDORs(trainee2, fto1, "orientation", 1, 4, "steady");
  await generateDORs(trainee3, fto2, "direct-supervision", 4, 10, "improving");
  await generateDORs(trainee3, fto2, "indirect-supervision", 8, 6, "steady");
  await generateDORs(trainee4, fto3, "direct-supervision", 6, 8, "improving");
  await generateDORs(trainee5, fto5, "direct-supervision", 8, 7, "steady");
  await generateDORs(trainee6, fto4, "orientation", 10, 3, "improving");
  await generateDORs(trainee7, fto6, "orientation", 12, 3, "steady");
  await generateDORs(trainee8, fto7, "orientation", 14, 2, "improving");
  await generateDORs(trainee9, fto8, "orientation", 1, 3, "improving");
  await generateDORs(trainee9, fto8, "direct-supervision", 2, 10, "improving");
  await generateDORs(trainee9, fto8, "indirect-supervision", 5, 8, "steady");
  await generateDORs(trainee9, fto8, "solo-evaluation", 8, 5, "steady");
  await generateDORs(trainee10, fto1, "direct-supervision", 5, 6, "struggling");

  // =========================================================================
  // SKILL SIGNOFFS — progressive per trainee
  // =========================================================================
  console.log("  Creating skill signoffs...");

  // Trainee 1 (Alex) — good progress, ~45% signed off
  const alexSkills = ["airway-management/opa","airway-management/npa","airway-management/suctioning","cardiac-care/cardiac-monitor","cardiac-care/cpr-quality","trauma-care/spinal-motion-restriction","trauma-care/tourniquet","trauma-care/splinting","medical-emergencies/blood-glucose","medical-emergencies/iv-access","medical-emergencies/nebulizer","driving-operations/non-emergency-driving","driving-operations/vehicle-inspection","driving-operations/equipment-inventory","driving-operations/radio-comms","administrative/pcr-completion","administrative/hipaa-compliance","administrative/incident-reporting"];
  for (let i = 0; i < alexSkills.length; i++) {
    const sid = skillRecords[alexSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee1.id, skillId: sid, ftoId: sup1.id, date: seedDate(2, 5 + i) } });
  }

  // Trainee 2 (Jordan) — early, just a few
  const jordanSkills = ["driving-operations/vehicle-inspection","driving-operations/radio-comms","administrative/hipaa-compliance"];
  for (let i = 0; i < jordanSkills.length; i++) {
    const sid = skillRecords[jordanSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee2.id, skillId: sid, ftoId: fto1.id, date: seedDate(1, 3 + i) } });
  }

  // Trainee 3 (Megan) — well along, ~60% signed off
  const meganSkills = pickN(allSkillKeys, 26);
  for (let i = 0; i < meganSkills.length; i++) {
    const sid = skillRecords[meganSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee3.id, skillId: sid, ftoId: fto2.id, date: seedDate(4, 3 + Math.floor(i / 2)) } });
  }

  // Trainee 4 (Ryan) — moderate progress
  const ryanSkills = pickN(allSkillKeys, 14);
  for (let i = 0; i < ryanSkills.length; i++) {
    const sid = skillRecords[ryanSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee4.id, skillId: sid, ftoId: fto3.id, date: seedDate(6, 5 + i) } });
  }

  // Trainee 5 (Hannah — Air Care) — moderate
  const hannahSkills = pickN(allSkillKeys, 12);
  for (let i = 0; i < hannahSkills.length; i++) {
    const sid = skillRecords[hannahSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee5.id, skillId: sid, ftoId: fto5.id, date: seedDate(8, 3 + i) } });
  }

  // Trainee 6 (Ethan) — early
  const ethanSkills = pickN(allSkillKeys, 5);
  for (let i = 0; i < ethanSkills.length; i++) {
    const sid = skillRecords[ethanSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee6.id, skillId: sid, ftoId: fto4.id, date: seedDate(10, 5 + i) } });
  }

  // Trainee 7 (Olivia) — very early
  const oliviaSkills = pickN(allSkillKeys, 3);
  for (let i = 0; i < oliviaSkills.length; i++) {
    const sid = skillRecords[oliviaSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee7.id, skillId: sid, ftoId: fto6.id, date: seedDate(12, 8 + i) } });
  }

  // Trainee 8 (Lucas) — just started
  const lucasSkills = pickN(allSkillKeys, 2);
  for (let i = 0; i < lucasSkills.length; i++) {
    const sid = skillRecords[lucasSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee8.id, skillId: sid, ftoId: fto7.id, date: seedDate(14, 5 + i) } });
  }

  // Trainee 9 (Sophia — completed) — ALL skills signed off
  for (let i = 0; i < allSkillKeys.length; i++) {
    const sid = skillRecords[allSkillKeys[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee9.id, skillId: sid, ftoId: fto8.id, date: seedDate(1 + Math.floor(i / 5), 3 + (i % 5)) } });
  }

  // Trainee 10 (Noah — separated) — partial
  const noahSkills = pickN(allSkillKeys, 8);
  for (let i = 0; i < noahSkills.length; i++) {
    const sid = skillRecords[noahSkills[i]];
    if (sid) await prisma.skillSignoff.create({ data: { traineeId: trainee10.id, skillId: sid, ftoId: fto1.id, date: seedDate(5, 5 + i) } });
  }

  console.log("  Created training phases, eval categories, skills, assignments, DORs, signoffs.");

  // --- Summary ---
  const counts = await Promise.all([prisma.user.count(), prisma.department.count(), prisma.division.count(), prisma.region.count(), prisma.metricDefinition.count(), prisma.metricEntry.count(), prisma.driverDiagram.count(), prisma.pdsaCycle.count(), prisma.campaign.count(), prisma.actionItem.count(), prisma.trainingPhase.count(), prisma.dailyEvaluation.count(), prisma.skillSignoff.count(), prisma.trainingAssignment.count()]);
  console.log(`\nSeed complete!`);
  console.log(`  Users: ${counts[0]}`);
  console.log(`  Departments: ${counts[1]}`);
  console.log(`  Divisions: ${counts[2]}`);
  console.log(`  Regions: ${counts[3]}`);
  console.log(`  Metrics: ${counts[4]}`);
  console.log(`  Metric Entries: ${counts[5]}`);
  console.log(`  Driver Diagrams: ${counts[6]}`);
  console.log(`  PDSA Cycles: ${counts[7]}`);
  console.log(`  QI Campaigns: ${counts[8]}`);
  console.log(`  Action Items: ${counts[9]}`);
  console.log(`  Training Phases: ${counts[10]}`);
  console.log(`  DORs: ${counts[11]}`);
  console.log(`  Skill Signoffs: ${counts[12]}`);
  console.log(`  Training Assignments: ${counts[13]}`);
  console.log("\nNorth Memorial Health EMS Dashboard is ready.");
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
