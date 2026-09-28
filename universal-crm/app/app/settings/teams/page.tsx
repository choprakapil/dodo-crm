import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { TeamService } from "@/lib/services/team.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { TeamWorkspace, SerializedTeam } from "@/components/settings/team-workspace";

interface TeamsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
  }>;
}

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const canView =
    authContext.hasPermission("teams", "view") ||
    authContext.hasPermission("teams", "manage");

  if (!canView) {
    redirect("/app");
  }

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 1;
  const limit = sp.limit ? parseInt(sp.limit, 10) : 50;
  const search = sp.search || undefined;

  const result = await TeamService.listTeams(authContext, {
    page,
    limit,
    search,
  });

  const serializedTeams: SerializedTeam[] = (result.data as Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    manager: { id: string; name: string; email: string } | null;
    memberCount: number;
    leadCount: number;
  }>).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    manager: t.manager,
    memberCount: t.memberCount,
    leadCount: t.leadCount,
  }));

  const canManage = authContext.hasPermission("teams", "manage");

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

        <TeamWorkspace
          initialTeams={serializedTeams}
          total={result.pagination.total}
          currentPage={result.pagination.page}
          totalPages={result.pagination.totalPages}
          initialSearch={search}
          canManage={canManage}
        />
      </main>
    </div>
  );
}
