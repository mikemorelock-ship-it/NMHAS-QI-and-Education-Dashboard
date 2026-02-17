import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MetricDetailAdminClient } from "./metric-detail-admin-client";
import { format } from "date-fns";
import { toUTCDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MetricDetailAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_metric_defs")) {
    notFound();
  }

  const { id } = await params;

  const metric = await prisma.metricDefinition.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      annotations: {
        orderBy: { date: "desc" },
      },
      resources: {
        orderBy: { sortOrder: "asc" },
      },
      responsibleParties: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!metric) {
    notFound();
  }

  return (
    <MetricDetailAdminClient
      metric={{
        id: metric.id,
        name: metric.name,
        departmentName: metric.department.name,
      }}
      annotations={metric.annotations.map((a) => ({
        id: a.id,
        metricDefinitionId: a.metricDefinitionId,
        date: format(toUTCDate(a.date), "yyyy-MM-dd"),
        title: a.title,
        description: a.description,
        type: a.type as "intervention" | "milestone" | "event",
      }))}
      resources={metric.resources.map((r) => ({
        id: r.id,
        metricDefinitionId: r.metricDefinitionId,
        title: r.title,
        url: r.url,
        type: r.type as "document" | "link" | "reference" | "protocol",
        sortOrder: r.sortOrder,
      }))}
      responsibleParties={metric.responsibleParties.map((p) => ({
        id: p.id,
        metricDefinitionId: p.metricDefinitionId,
        name: p.name,
        role: p.role,
        email: p.email,
        sortOrder: p.sortOrder,
      }))}
    />
  );
}
