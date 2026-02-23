import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { QIResourcesContent } from "@/components/resources/QIResourcesContent";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_departments")) {
    notFound();
  }

  return <QIResourcesContent />;
}
