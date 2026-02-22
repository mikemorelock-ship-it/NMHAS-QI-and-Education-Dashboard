import { verifySession } from "@/lib/auth";
import { notFound } from "next/navigation";

/**
 * Restrict the Field Training analytics dashboard to
 * managers, admins, and supervisors only.
 */
export default async function FieldTrainingDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession();
  if (!session || !["manager", "admin", "supervisor"].includes(session.role)) {
    notFound();
  }

  return <>{children}</>;
}
