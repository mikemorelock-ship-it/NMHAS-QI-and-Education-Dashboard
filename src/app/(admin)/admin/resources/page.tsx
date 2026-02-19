import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "manage_departments")) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nmh-gray">Resources</h1>
        <p className="text-muted-foreground mt-1">
          Coming soon — this page will be a repository for various kinds of resources.
        </p>
      </div>

      <div className="bg-card rounded-lg border p-12 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-nmh-teal/10 p-4 mb-4">
          <Users className="h-8 w-8 text-nmh-teal" />
        </div>
        <h2 className="text-lg font-semibold text-nmh-gray mb-2">Resources Hub</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          This section will house training materials, protocol documents, reference links, and other
          resources for the EMS team. Check back soon!
        </p>
      </div>
    </div>
  );
}
