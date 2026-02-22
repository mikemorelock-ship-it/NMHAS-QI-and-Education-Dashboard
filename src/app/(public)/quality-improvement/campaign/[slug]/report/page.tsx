import { redirect } from "next/navigation";

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/quality-improvement/campaign/${slug}`);
}
