import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { getMyCoachingActivities } from "@/actions/coaching";
import { CoachingDashboardClient } from "./coaching-client";

export const dynamic = "force-dynamic";

export default async function CoachingPage() {
  const session = await verifySession();
  if (!session) redirect("/login");

  const activities = await getMyCoachingActivities();

  return <CoachingDashboardClient activities={activities} />;
}
