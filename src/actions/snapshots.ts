"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/require-auth";
import { buildTraineeSnapshot } from "@/lib/snapshot-builder";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T = undefined> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ---------------------------------------------------------------------------
// Create Snapshot
// ---------------------------------------------------------------------------

export async function createTraineeSnapshot(
  traineeId: string
): Promise<ActionResult<{ token: string; traineeName: string }>> {
  const session = await requirePermission("view_all_trainees");

  try {
    // Get creator name
    const creator = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    });
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : "System";

    const snapshotData = await buildTraineeSnapshot(traineeId, creatorName);

    const snapshot = await prisma.traineeSnapshot.create({
      data: {
        traineeId,
        createdById: session.userId,
        title: `${snapshotData.profile.name} — Progress Report`,
        snapshotData: JSON.stringify(snapshotData),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "TraineeSnapshot",
        entityId: snapshot.id,
        details: `Created snapshot report for ${snapshotData.profile.name}`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/snapshots");
    return {
      success: true,
      data: { token: snapshot.token, traineeName: snapshotData.profile.name },
    };
  } catch (err) {
    console.error("createTraineeSnapshot error:", err);
    return { success: false, error: "Failed to create snapshot." };
  }
}

// ---------------------------------------------------------------------------
// Bulk Create Snapshots
// ---------------------------------------------------------------------------

export async function createBulkSnapshots(
  traineeIds: string[]
): Promise<
  ActionResult<{ snapshots: { traineeId: string; traineeName: string; token: string }[] }>
> {
  const session = await requirePermission("view_all_trainees");

  try {
    const creator = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { firstName: true, lastName: true },
    });
    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : "System";

    const results: { traineeId: string; traineeName: string; token: string }[] = [];

    for (const traineeId of traineeIds) {
      try {
        const snapshotData = await buildTraineeSnapshot(traineeId, creatorName);
        const snapshot = await prisma.traineeSnapshot.create({
          data: {
            traineeId,
            createdById: session.userId,
            title: `${snapshotData.profile.name} — Progress Report`,
            snapshotData: JSON.stringify(snapshotData),
          },
        });

        results.push({
          traineeId,
          traineeName: snapshotData.profile.name,
          token: snapshot.token,
        });
      } catch (err) {
        console.error(`Failed to create snapshot for trainee ${traineeId}:`, err);
      }
    }

    await prisma.auditLog.create({
      data: {
        action: "BULK_CREATE",
        entity: "TraineeSnapshot",
        entityId: "bulk",
        details: `Created ${results.length} snapshot reports`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/snapshots");
    return { success: true, data: { snapshots: results } };
  } catch (err) {
    console.error("createBulkSnapshots error:", err);
    return { success: false, error: "Failed to create snapshots." };
  }
}

// ---------------------------------------------------------------------------
// Deactivate Snapshot
// ---------------------------------------------------------------------------

export async function deactivateSnapshot(snapshotId: string): Promise<ActionResult> {
  const session = await requirePermission("view_all_trainees");

  try {
    await prisma.traineeSnapshot.update({
      where: { id: snapshotId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: "DEACTIVATE",
        entity: "TraineeSnapshot",
        entityId: snapshotId,
        details: "Deactivated snapshot report",
        actorId: session.userId,
        actorType: "user",
      },
    });

    revalidatePath("/admin/field-training/snapshots");
    return { success: true };
  } catch (err) {
    console.error("deactivateSnapshot error:", err);
    return { success: false, error: "Failed to deactivate snapshot." };
  }
}
