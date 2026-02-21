import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { IdleTimeout } from "@/components/IdleTimeout";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) {
    redirect("/login");
  }

  // Get pending approval count for admin badge
  let pendingCount = 0;
  if (session.role === "admin") {
    pendingCount = await prisma.user.count({
      where: { status: "pending" },
    });
  }

  // Compute session expiry from JWT iat claim (24h sessions)
  let expiresAt = Date.now() + 24 * 60 * 60 * 1000; // fallback
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (token) {
      const payloadB64 = token.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
      if (typeof payload.iat === "number") {
        expiresAt = (payload.iat + 86400) * 1000; // iat + 24h in ms
      }
    }
  } catch {
    // Use fallback if JWT parsing fails
  }

  return (
    <div className="min-h-screen flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <AdminSidebar
        userRole={session.role as UserRole}
        userName={`${session.firstName} ${session.lastName}`}
        pendingApprovals={pendingCount}
      />
      <main id="main-content" className="flex-1 p-6 lg:p-8 bg-muted/30 overflow-auto">
        {children}
      </main>
      <SessionTimeoutWarning
        expiresAt={expiresAt}
        loginPath="/login"
        sessionDurationLabel="24-hour"
      />
      <IdleTimeout timeoutMinutes={30} />
    </div>
  );
}
