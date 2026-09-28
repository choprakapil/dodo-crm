import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { TeamService } from "@/lib/services/team.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { TeamRoster, TeamMemberUser } from "@/components/settings/team-roster";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Crown,
  Briefcase,
  CheckCircle2,
  Users,
} from "lucide-react";

interface TeamDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { id } = await params;

  let team;
  try {
    team = await TeamService.getTeamById(authContext, id);
  } catch {
    notFound();
  }

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

        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/app/settings/teams"
            className="inline-flex items-center text-xs font-medium text-slate-400 hover:text-slate-200 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Teams
          </Link>
        </div>

        {/* Hero Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 border border-violet-400/30 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {team.name}
                  </h1>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-0.5 font-medium ${
                      team.isActive
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}
                  >
                    {team.isActive ? "Active Team" : "Inactive"}
                  </Badge>
                </div>

                {team.description ? (
                  <p className="text-xs text-slate-300 mt-2 max-w-2xl leading-relaxed">
                    {team.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic mt-2">
                    No description provided.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-3">
                  <div className="flex items-center space-x-1.5">
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                    <span>Team Lead:</span>
                    <span className="text-slate-200 font-medium">
                      {team.manager ? team.manager.name : "None assigned"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{team.leadCount} Active Leads</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{team.taskCount} Tasks</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Link
                href={`/app/leads?teamId=${team.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200 text-xs h-9 px-3 font-medium transition-colors"
              >
                <Briefcase className="h-3.5 w-3.5 mr-1.5 text-indigo-400" />
                View Team Leads ({team.leadCount})
              </Link>
            </div>
          </div>
        </div>

        {/* Members Roster */}
        <TeamRoster
          teamId={team.id}
          members={team.members as unknown as TeamMemberUser[]}
          canManage={canManage}
        />
      </main>
    </div>
  );
}
