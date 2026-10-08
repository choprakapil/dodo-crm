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
    departmentId?: string | null;
    department?: {
      id: string;
      name: string;
      divisionId: string;
      division?: {
        id: string;
        name: string;
      } | null;
    } | null;
    isActive: boolean;
    createdAt: Date;
    manager: { id: string; name: string; email: string } | null;
    memberCount: number;
    leadCount: number;
  }>).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    departmentId: t.departmentId,
    department: t.department,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
    manager: t.manager,
    memberCount: t.memberCount,
    leadCount: t.leadCount,
  }));

  const canManage = authContext.hasPermission("teams", "manage");

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      <SettingsNav />

      <TeamWorkspace
        initialTeams={serializedTeams}
        total={result.pagination.total}
        currentPage={result.pagination.page}
        totalPages={result.pagination.totalPages}
        initialSearch={search}
        canManage={canManage}
      />
    </div>
  );
}
