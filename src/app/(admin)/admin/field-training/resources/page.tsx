import { notFound } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getResourceDocuments } from "@/actions/resources";
import { ResourcesClient } from "./resources-client";

export default async function ResourcesPage() {
  const session = await verifySession();
  if (!session || !hasPermission(session.role, "manage_resources")) {
    notFound();
  }

  const documents = await getResourceDocuments();

  return <ResourcesClient documents={documents} />;
}
