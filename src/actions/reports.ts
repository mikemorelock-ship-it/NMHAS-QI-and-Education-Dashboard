"use server";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/require-auth";
import { format } from "date-fns";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type MetricDataRow = {
  metricName: string;
  department: string;
  division: string;
  region: string;
  periodType: string;
  periodStart: string;
  value: number;
  numerator: string;
  denominator: string;
  notes: string;
};

export type DorDataRow = {
  date: string;
  traineeName: string;
  traineeEmployeeId: string;
  ftoName: string;
  ftoEmployeeId: string;
  phase: string;
  overallRating: number;
  narrative: string;
  mostSatisfactory: string;
  leastSatisfactory: string;
  recommendAction: string;
  nrtFlag: string;
  remFlag: string;
  traineeAcknowledged: string;
  status: string;
  [key: string]: string | number; // dynamic category rating columns
};

export type TrainingProgressRow = {
  traineeName: string;
  traineeEmployeeId: string;
  traineeEmail: string;
  traineeStatus: string;
  division: string;
  hireDate: string;
  startDate: string;
  completionDate: string;
  totalDors: number;
  avgOverallRating: string;
  skillsCompleted: number;
  totalSkills: number;
  skillsPercent: string;
  phasesCompleted: number;
  totalPhases: number;
  coachingAssigned: number;
  coachingCompleted: number;
  currentFto: string;
};

export type AuditLogRow = {
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  actorId: string;
  actorType: string;
};

export type UserRosterRow = {
  name: string;
  email: string;
  role: string;
  status: string;
  employeeId: string;
  badgeNumber: string;
  division: string;
  lastLoginAt: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type MetricDataFilters = {
  metricIds?: string[];
  departmentId?: string;
  divisionId?: string;
  startDate?: string;
  endDate?: string;
};

export type DorDataFilters = {
  traineeIds?: string[];
  ftoIds?: string[];
  startDate?: string;
  endDate?: string;
  phaseId?: string;
};

export type TrainingProgressFilters = {
  traineeIds?: string[];
  status?: string;
};

export type AuditLogFilters = {
  startDate?: string;
  endDate?: string;
  action?: string;
  entity?: string;
};

export type UserRosterFilters = {
  role?: string;
  status?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return format(d, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return format(d, "yyyy-MM-dd HH:mm:ss");
  } catch {
    return "";
  }
}

function parseDateFilter(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? undefined : d;
}

// ---------------------------------------------------------------------------
// 1. Export Metric Data
// ---------------------------------------------------------------------------

export async function exportMetricData(
  filters: MetricDataFilters
): Promise<MetricDataRow[]> {
  await requireAdmin("export_reports");

  const startDate = parseDateFilter(filters.startDate);
  const endDate = parseDateFilter(filters.endDate);

  const entries = await prisma.metricEntry.findMany({
    where: {
      ...(filters.metricIds && filters.metricIds.length > 0
        ? { metricDefinitionId: { in: filters.metricIds } }
        : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.divisionId ? { divisionId: filters.divisionId } : {}),
      ...(startDate || endDate
        ? {
            periodStart: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      metricDefinition: { select: { name: true } },
      department: { select: { name: true } },
      division: { select: { name: true } },
      region: { select: { name: true } },
    },
    orderBy: [{ periodStart: "desc" }, { metricDefinition: { name: "asc" } }],
  });

  return entries.map((e) => ({
    metricName: e.metricDefinition.name,
    department: e.department.name,
    division: e.division?.name ?? "",
    region: e.region?.name ?? "",
    periodType: e.periodType,
    periodStart: formatDate(e.periodStart),
    value: e.value,
    numerator: e.numerator != null ? String(e.numerator) : "",
    denominator: e.denominator != null ? String(e.denominator) : "",
    notes: e.notes ?? "",
  }));
}

// ---------------------------------------------------------------------------
// 2. Export DOR Data
// ---------------------------------------------------------------------------

export async function exportDorData(
  filters: DorDataFilters
): Promise<DorDataRow[]> {
  await requireAdmin("export_reports");

  const startDate = parseDateFilter(filters.startDate);
  const endDate = parseDateFilter(filters.endDate);

  const dors = await prisma.dailyEvaluation.findMany({
    where: {
      ...(filters.traineeIds && filters.traineeIds.length > 0
        ? { traineeId: { in: filters.traineeIds } }
        : {}),
      ...(filters.ftoIds && filters.ftoIds.length > 0
        ? { ftoId: { in: filters.ftoIds } }
        : {}),
      ...(filters.phaseId ? { phaseId: filters.phaseId } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      trainee: { select: { firstName: true, lastName: true, employeeId: true } },
      fto: { select: { firstName: true, lastName: true, employeeId: true } },
      phase: { select: { name: true } },
      ratings: {
        include: {
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return dors.map((d) => {
    const row: DorDataRow = {
      date: formatDate(d.date),
      traineeName: `${d.trainee.firstName} ${d.trainee.lastName}`,
      traineeEmployeeId: d.trainee.employeeId ?? "",
      ftoName: `${d.fto.firstName} ${d.fto.lastName}`,
      ftoEmployeeId: d.fto.employeeId ?? "",
      phase: d.phase?.name ?? "",
      overallRating: d.overallRating,
      narrative: d.narrative ?? "",
      mostSatisfactory: d.mostSatisfactory ?? "",
      leastSatisfactory: d.leastSatisfactory ?? "",
      recommendAction: d.recommendAction,
      nrtFlag: d.nrtFlag ? "Yes" : "No",
      remFlag: d.remFlag ? "Yes" : "No",
      traineeAcknowledged: d.traineeAcknowledged ? "Yes" : "No",
      status: d.status,
    };

    // Flatten category ratings as separate columns
    for (const rating of d.ratings) {
      row[`rating_${rating.category.name}`] = rating.rating;
    }

    return row;
  });
}

// ---------------------------------------------------------------------------
// 3. Export Training Progress
// ---------------------------------------------------------------------------

export async function exportTrainingProgress(
  filters: TrainingProgressFilters
): Promise<TrainingProgressRow[]> {
  await requireAdmin("export_reports");

  const trainees = await prisma.user.findMany({
    where: {
      role: "trainee",
      ...(filters.traineeIds && filters.traineeIds.length > 0
        ? { id: { in: filters.traineeIds } }
        : {}),
      ...(filters.status ? { traineeStatus: filters.status } : {}),
    },
    include: {
      division: { select: { name: true } },
      traineeDailyEvals: {
        select: { overallRating: true },
      },
      traineeSkillSignoffs: {
        select: { id: true },
      },
      traineePhases: {
        select: { status: true },
      },
      coachingAssignments: {
        select: { status: true },
      },
      traineeAssignments: {
        where: { status: "active" },
        include: {
          fto: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startDate: "desc" },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  // Get total skills count for percentage calculation
  const totalSkills = await prisma.skill.count({ where: { isActive: true } });
  const totalPhases = await prisma.trainingPhase.count({ where: { isActive: true } });

  return trainees.map((t) => {
    const dorCount = t.traineeDailyEvals.length;
    const avgRating =
      dorCount > 0
        ? (
            t.traineeDailyEvals.reduce((sum, d) => sum + d.overallRating, 0) /
            dorCount
          ).toFixed(2)
        : "";
    const skillsCompleted = t.traineeSkillSignoffs.length;
    const phasesCompleted = t.traineePhases.filter(
      (p) => p.status === "completed"
    ).length;
    const coachingAssigned = t.coachingAssignments.length;
    const coachingCompleted = t.coachingAssignments.filter(
      (c) => c.status === "completed"
    ).length;
    const currentFto = t.traineeAssignments
      .map((a) => `${a.fto.firstName} ${a.fto.lastName}`)
      .join(", ");

    return {
      traineeName: `${t.firstName} ${t.lastName}`,
      traineeEmployeeId: t.employeeId ?? "",
      traineeEmail: t.email,
      traineeStatus: t.traineeStatus ?? "",
      division: t.division?.name ?? "",
      hireDate: formatDate(t.hireDate),
      startDate: formatDate(t.startDate),
      completionDate: formatDate(t.completionDate),
      totalDors: dorCount,
      avgOverallRating: avgRating,
      skillsCompleted,
      totalSkills,
      skillsPercent:
        totalSkills > 0
          ? ((skillsCompleted / totalSkills) * 100).toFixed(1) + "%"
          : "0%",
      phasesCompleted,
      totalPhases,
      coachingAssigned,
      coachingCompleted,
      currentFto,
    };
  });
}

// ---------------------------------------------------------------------------
// 4. Export Audit Log
// ---------------------------------------------------------------------------

export async function exportAuditLog(
  filters: AuditLogFilters
): Promise<AuditLogRow[]> {
  await requireAdmin("export_reports");

  const startDate = parseDateFilter(filters.startDate);
  const endDate = parseDateFilter(filters.endDate);

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000, // cap at 5000 rows for safety
  });

  return logs.map((l) => ({
    timestamp: formatDateTime(l.createdAt),
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    details: l.details ?? "",
    actorId: l.actorId ?? "",
    actorType: l.actorType ?? "",
  }));
}

// ---------------------------------------------------------------------------
// 5. Export User Roster
// ---------------------------------------------------------------------------

export async function exportUserRoster(
  filters: UserRosterFilters
): Promise<UserRosterRow[]> {
  await requireAdmin("export_reports");

  const users = await prisma.user.findMany({
    where: {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: {
      division: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return users.map((u) => ({
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    role: u.role,
    status: u.status,
    employeeId: u.employeeId ?? "",
    badgeNumber: u.badgeNumber ?? "",
    division: u.division?.name ?? "",
    lastLoginAt: formatDateTime(u.lastLoginAt),
    createdAt: formatDate(u.createdAt),
  }));
}

// ---------------------------------------------------------------------------
// Lookup data for the reports page filters
// ---------------------------------------------------------------------------

export type ReportsLookupData = {
  metrics: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  trainees: { id: string; name: string; employeeId: string }[];
  ftos: { id: string; name: string; employeeId: string }[];
  phases: { id: string; name: string }[];
  auditActions: string[];
  auditEntities: string[];
};

export async function getReportsLookupData(): Promise<ReportsLookupData> {
  await requireAdmin("export_reports");

  const [metrics, departments, divisions, trainees, ftos, phases, auditActions, auditEntities] =
    await Promise.all([
      prisma.metricDefinition.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.division.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { role: "trainee" },
        select: { id: true, firstName: true, lastName: true, employeeId: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.user.findMany({
        where: { role: { in: ["fto", "supervisor"] } },
        select: { id: true, firstName: true, lastName: true, employeeId: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.trainingPhase.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.auditLog
        .findMany({
          distinct: ["action"],
          select: { action: true },
          orderBy: { action: "asc" },
        })
        .then((rows) => rows.map((r) => r.action)),
      prisma.auditLog
        .findMany({
          distinct: ["entity"],
          select: { entity: true },
          orderBy: { entity: "asc" },
        })
        .then((rows) => rows.map((r) => r.entity)),
    ]);

  return {
    metrics,
    departments,
    divisions,
    trainees: trainees.map((t) => ({
      id: t.id,
      name: `${t.firstName} ${t.lastName}`,
      employeeId: t.employeeId ?? "",
    })),
    ftos: ftos.map((f) => ({
      id: f.id,
      name: `${f.firstName} ${f.lastName}`,
      employeeId: f.employeeId ?? "",
    })),
    phases,
    auditActions,
    auditEntities,
  };
}
