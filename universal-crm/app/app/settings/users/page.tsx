import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { UserService } from "@/lib/services/user.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { UserWorkspace, SerializedUser } from "@/components/settings/user-workspace";
import { UserStatus } from "@prisma/client";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    status?: string;
    search?: string;
    roleId?: string;
    teamId?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const canView =
    authContext.hasPermission("users", "view") ||
    authContext.hasPermission("users", "manage");

  if (!canView) {
    redirect("/app");
  }

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const limit = sp.limit ? parseInt(sp.limit, 10) : 20;
  const search = sp.search || undefined;
  const status =
    sp.status && ["ACTIVE", "INVITED", "DISABLED"].includes(sp.status)
      ? (sp.status as UserStatus)
      : undefined;
  const roleId = sp.roleId || undefined;
  const teamId = sp.teamId || undefined;

  const result = await UserService.listUsers(authContext, {
    page,
    limit,
    search,
    status,
    roleId,
    teamId,
  });

  const serializedUsers: SerializedUser[] = (result.data as Array<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
    status: UserStatus;
    lastLoginAt: Date | null;
    createdAt: Date;
    role: { id: string; name: string; isSystem: boolean };
    teams: { id: string; name: string }[];
    assignedLeadsCount: number;
  }>).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    status: u.status,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    role: u.role,
    teams: u.teams,
    assignedLeadsCount: u.assignedLeadsCount,
  }));

  const canManage = authContext.hasPermission("users", "manage");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        <SettingsNav />

        <UserWorkspace
          initialUsers={serializedUsers}
          total={result.pagination.total}
          currentPage={result.pagination.page}
          totalPages={result.pagination.totalPages}
          initialSearch={search}
          initialStatus={sp.status || "ALL"}
          canManage={canManage}
          currentUserId={authContext.user.id}
        />
      </main>
    </div>
  );
}
