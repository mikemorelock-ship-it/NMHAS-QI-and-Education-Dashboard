import { redirect, notFound } from "next/navigation";
import { verifySession } from "@/lib/auth";
import { hasAdminPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await verifySession();
  if (!session) redirect("/login");
  if (!hasAdminPermission(session.role, "manage_users")) notFound();

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <UsersClient
      users={users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      }))}
      currentUserId={session.userId}
    />
  );
}
