import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { parsePagination } from "@/lib/pagination";
import { getAuditLogPage, getAuditLogLookupData } from "@/actions/audit-log";
import { AuditLogClient } from "./audit-log-client";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditLogPage({ searchParams }: Props) {
  const session = await verifySession();
  if (!session || !hasPermission(session.role, "view_audit_log")) {
    notFound();
  }

  const params = await searchParams;
  const { page, pageSize } = parsePagination(params, { pageSize: 50 });

  const filters = {
    action: typeof params.action === "string" ? params.action : undefined,
    entity: typeof params.entity === "string" ? params.entity : undefined,
    actorId: typeof params.actorId === "string" ? params.actorId : undefined,
    entityId: typeof params.entityId === "string" ? params.entityId : undefined,
    search: typeof params.search === "string" ? params.search : undefined,
    startDate: typeof params.startDate === "string" ? params.startDate : undefined,
    endDate: typeof params.endDate === "string" ? params.endDate : undefined,
  };

  const [result, lookup] = await Promise.all([
    getAuditLogPage(filters, page, pageSize),
    getAuditLogLookupData(),
  ]);

  return (
    <AuditLogClient
      items={result.items}
      pagination={result.pagination}
      lookup={lookup}
      filters={filters}
    />
  );
}
