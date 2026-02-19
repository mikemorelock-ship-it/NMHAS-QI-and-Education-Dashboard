import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Types for structured change tracking
// ---------------------------------------------------------------------------

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface AuditLogEntry {
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  changes?: AuditChanges;
  actorId?: string;
  actorType?: string;
}

// ---------------------------------------------------------------------------
// Create audit log entry
// ---------------------------------------------------------------------------

export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        details: entry.details ?? null,
        changes: entry.changes ? JSON.stringify(entry.changes) : null,
        actorId: entry.actorId ?? null,
        actorType: entry.actorType ?? null,
      },
    });
  } catch (err) {
    // Don't let audit log failures crash the main operation
    console.error("[audit] Failed to write audit log:", err);
  }
}

// ---------------------------------------------------------------------------
// Diff helper: compute changed fields between two objects
// ---------------------------------------------------------------------------

export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: string[]
): AuditChanges | null {
  const relevantFields = fields ?? Object.keys(after);
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let hasChanges = false;

  for (const field of relevantFields) {
    const oldVal = before[field];
    const newVal = after[field];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changedBefore[field] = oldVal;
      changedAfter[field] = newVal;
      hasChanges = true;
    }
  }

  if (!hasChanges) return null;
  return { before: changedBefore, after: changedAfter };
}

// ---------------------------------------------------------------------------
// Parse changes JSON from an AuditLog record
// ---------------------------------------------------------------------------

export function parseAuditChanges(changesJson: string | null): AuditChanges | null {
  if (!changesJson) return null;
  try {
    return JSON.parse(changesJson) as AuditChanges;
  } catch {
    return null;
  }
}
