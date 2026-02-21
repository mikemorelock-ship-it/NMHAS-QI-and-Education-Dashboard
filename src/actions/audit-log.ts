"use server";

import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/require-auth";
import type { PaginatedResult } from "@/lib/pagination";

export interface AuditLogViewRow {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details: string | null;
  changes: string | null;
  actorId: string | null;
  actorType: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  entity?: string;
  actorId?: string;
  entityId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogLookupData {
  actions: string[];
  entities: string[];
  actors: { id: string; name: string }[];
}

export async function getAuditLogPage(
  filters: AuditLogFilters,
  page: number,
  pageSize: number
): Promise<PaginatedResult<AuditLogViewRow>> {
  await requirePermission("view_audit_log");

  // Build where clause from filters
  const where: {
    action?: string;
    entity?: string;
    actorId?: string;
    entityId?: { contains: string };
    details?: { contains: string };
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (filters.action) where.action = filters.action;
  if (filters.entity) where.entity = filters.entity;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.entityId) where.entityId = { contains: filters.entityId };
  if (filters.search) where.details = { contains: filters.search };
  if (filters.startDate || filters.endDate) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (filters.startDate) createdAt.gte = new Date(`${filters.startDate}T00:00:00.000Z`);
    if (filters.endDate) createdAt.lte = new Date(`${filters.endDate}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }

  const skip = (page - 1) * pageSize;

  // Run count and findMany in parallel
  const [totalItems, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(page, totalPages);

  // Resolve actor names in bulk
  const actorIds = [...new Set(items.map((item) => item.actorId).filter((id) => id !== null))];

  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];

  const actorMap = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

  return {
    items: items.map((item) => ({
      id: item.id,
      action: item.action,
      entity: item.entity,
      entityId: item.entityId,
      details: item.details,
      changes: item.changes,
      actorId: item.actorId,
      actorType: item.actorType,
      actorName: item.actorId ? (actorMap.get(item.actorId) ?? "Unknown") : null,
      createdAt: item.createdAt.toISOString(),
    })),
    pagination: {
      page: clampedPage,
      pageSize,
      totalItems,
      totalPages,
      hasNextPage: clampedPage < totalPages,
      hasPreviousPage: clampedPage > 1,
    },
  };
}

export async function getAuditLogLookupData(): Promise<AuditLogLookupData> {
  await requirePermission("view_audit_log");

  const [actions, entities, actors] = await Promise.all([
    prisma.auditLog
      .findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } })
      .then((rows) => rows.map((r) => r.action)),
    prisma.auditLog
      .findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } })
      .then((rows) => rows.map((r) => r.entity)),
    prisma.user
      .findMany({
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      })
      .then((users) => users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))),
  ]);

  return { actions, entities, actors };
}

export async function getEntityHistory(
  entity: string,
  entityId: string
): Promise<AuditLogViewRow[]> {
  await requirePermission("view_audit_log");

  const logs = await prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const actorIds = [...new Set(logs.map((l) => l.actorId).filter((id) => id !== null))];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const actorMap = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

  return logs.map((item) => ({
    id: item.id,
    action: item.action,
    entity: item.entity,
    entityId: item.entityId,
    details: item.details,
    changes: item.changes,
    actorId: item.actorId,
    actorType: item.actorType,
    actorName: item.actorId ? (actorMap.get(item.actorId) ?? "Unknown") : null,
    createdAt: item.createdAt.toISOString(),
  }));
}
