import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { DeveloperGuideContent } from "@/components/admin/DeveloperGuideContent";

export default async function DeveloperGuidePage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "view_admin")) {
    notFound();
  }

  return <DeveloperGuideContent />;
}
