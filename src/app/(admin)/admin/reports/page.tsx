import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { getReportsLookupData } from "@/actions/reports";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "export_reports")) {
    notFound();
  }

  const lookup = await getReportsLookupData();

  return <ReportsClient lookup={lookup} />;
}
