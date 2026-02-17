import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { notFound } from "next/navigation";
import { getLookupData } from "@/actions/upload";
import { UploadClient } from "./upload-client";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await verifySession();
  if (!session || !hasAdminPermission(session.role, "upload_batch_data")) {
    notFound();
  }

  const lookup = await getLookupData();

  return <UploadClient lookup={lookup} />;
}
