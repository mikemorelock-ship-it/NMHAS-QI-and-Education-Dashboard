import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PublicJcaClient } from "./public-jca-client";

export const dynamic = "force-dynamic";

export default async function PublicJcaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.jcaShareLink.findUnique({
    where: { token },
  });

  if (!link || !link.isActive) {
    notFound();
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600 text-sm">
            This Just Culture Algorithm link has expired. Please contact your administrator for a
            new link.
          </p>
        </div>
      </div>
    );
  }

  return <PublicJcaClient token={token} linkLabel={link.label} />;
}
