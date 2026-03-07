import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { PublicHeader } from "@/components/PublicHeader";
import { IdleTimeout } from "@/components/IdleTimeout";

/**
 * Public dashboard layout -- full-screen, kiosk-friendly.
 *
 * - NMH teal header bar
 * - Uses the browser's native scrollbar for vertical overflow.
 * - Designed for wall-mounted displays and touch kiosks.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <PublicHeader userName={`${session.firstName} ${session.lastName}`} userRole={session.role} />
      {/* Full-width content area */}
      <main id="main-content" className="flex-1 w-full">
        {children}
      </main>
      <IdleTimeout timeoutMinutes={30} />
    </div>
  );
}
