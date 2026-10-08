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
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      <SettingsNav />

      {/* Back Link */}
      <div className="mb-4">
        <Link
          href="/app/settings/teams"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to Teams
        </Link>
      </div>

      {/* Hero Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-md shadow-indigo-600/20">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {team.name}
                </h1>
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-medium ${
                    team.isActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {team.isActive ? "Active Team" : "Inactive"}
                </Badge>
              </div>

              {team.description ? (
                <p className="text-xs text-slate-600 mt-2 max-w-2xl leading-relaxed">
                  {team.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic mt-2">
                  No description provided.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-3">
                {team.department && (
                  <div className="flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-[11px]">
                      {team.department.division?.name ? `${team.department.division.name} → ` : ""}
                      {team.department.name}
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  <span>Team Lead:</span>
                  <span className="text-slate-900 font-medium">
                    {team.manager ? team.manager.name : "None assigned"}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{team.leadCount} Active Leads</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{team.taskCount} Tasks</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href={`/app/leads?teamId=${team.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9 px-3 font-medium transition shadow-xs"
            >
              <Briefcase className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
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
    </div>
  );
}
