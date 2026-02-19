import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { FieldTrainingNavbar } from "@/components/field-training/FieldTrainingNavbar";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";
import { IdleTimeout } from "@/components/IdleTimeout";

export default async function FieldTrainingLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();

  // No session → render children without nav (login redirect page)
  if (!session) {
    return <>{children}</>;
  }

  const userName = `${session.firstName} ${session.lastName}`;

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <FieldTrainingNavbar session={session} userName={userName} />
      <main id="main-content" className="flex-1 p-4 md:p-8">{children}</main>
      <SessionTimeoutWarning
        expiresAt={expiresAt}
        loginPath="/login"
        sessionDurationLabel="24-hour"
      />
      <IdleTimeout timeoutMinutes={30} />
    </div>
  );
}
