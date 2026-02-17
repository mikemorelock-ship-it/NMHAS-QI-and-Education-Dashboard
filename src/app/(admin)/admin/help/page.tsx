import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { HelpPageContent } from "@/components/help/HelpPageContent";

export default async function AdminHelpPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "view_admin")) {
    notFound();
  }

  return <HelpPageContent portal="admin" />;
}
