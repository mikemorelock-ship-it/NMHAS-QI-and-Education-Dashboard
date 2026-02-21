import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  getCoachingActivitiesAdmin,
  getEvaluationCategories,
  getActiveResourceDocuments,
  checkAiConfigured,
} from "@/actions/coaching-admin";
import { CoachingAdminClient } from "./coaching-admin-client";

export default async function CoachingAdminPage() {
  const session = await verifySession();
  if (!session || !hasPermission(session.role, "manage_coaching")) {
    notFound();
  }

  const [activities, categories, documents, aiConfigured] = await Promise.all([
    getCoachingActivitiesAdmin(),
    getEvaluationCategories(),
    getActiveResourceDocuments(),
    checkAiConfigured(),
  ]);

  return (
    <CoachingAdminClient
      activities={activities}
      categories={categories}
      documents={documents}
      aiConfigured={aiConfigured}
    />
  );
}
