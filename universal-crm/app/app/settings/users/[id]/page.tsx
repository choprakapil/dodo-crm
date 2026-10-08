import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { UserService } from "@/lib/services/user.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
  Calendar,
  Clock,
  Briefcase,
  Activity as ActivityIcon,
} from "lucide-react";

interface UserDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { id } = await params;

  let user;
  try {
    user = await UserService.getUserById(authContext, id);
  } catch {
    notFound();
  }

  const isCurrentUser = user.id === authContext.user.id;

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      <SettingsNav />

      {/* Back Link */}
      <div className="mb-4">
        <Link
          href="/app/settings/users"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          Back to User Management
        </Link>
      </div>

      {/* User Hero Banner */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 mb-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-md shadow-indigo-600/20">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {user.name}
                </h1>
                {isCurrentUser && (
                  <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                    You
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-medium ${
                    user.status === "ACTIVE"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : user.status === "INVITED"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                  }`}
                >
                  {user.status}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <div className="flex items-center space-x-1.5 font-mono">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{user.email}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center space-x-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    Joined{" "}
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {user.lastLoginAt && (
                  <div className="flex items-center space-x-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      Last active{" "}
                      {new Date(user.lastLoginAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href={`/app/leads?assignedUserId=${user.id}`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs h-9 px-3 font-medium transition shadow-xs"
            >
              <Briefcase className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
              View Assigned Leads ({user._count.assignedLeads})
            </Link>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Role & Team details */}
        <div className="space-y-6 lg:col-span-1">
          {/* Role Card */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Role & Permissions
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Assigned Role</span>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                  {user.role.name}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Type</span>
                <span className="text-xs text-slate-700 font-medium">
                  {user.role.isSystem ? "System Role" : "Custom Role"}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Granted Modules:</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Array.from(
                    new Set(user.role.permissions.map((p) => p.module))
                  ).map((mod) => (
                    <Badge
                      key={mod}
                      variant="secondary"
                      className="bg-slate-100 border-slate-200 text-slate-700 text-[10px]"
                    >
                      {mod}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Teams Card */}
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Team Memberships
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              {user.teams.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Not assigned to any teams yet.
                </p>
              ) : (
                user.teams.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                  >
                    <Link
                      href={`/app/settings/teams/${t.id}`}
                      className="text-xs font-medium text-slate-800 hover:text-indigo-600 transition"
                    >
                      {t.name}
                    </Link>
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-white text-slate-600 text-[10px]"
                    >
                      Member
                    </Badge>
                  </div>
                ))
              )}

              {user.managedTeams.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    Managing Teams:
                  </span>
                  <div className="mt-2 space-y-1.5">
                    {user.managedTeams.map((mt) => (
                      <div
                        key={mt.id}
                        className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 flex items-center justify-between"
                      >
                        <span>{mt.name}</span>
                        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[9px]">
                          Team Lead
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <ActivityIcon className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Recent Activities Logged by User
              </h2>
            </div>

            <div className="mt-4">
              {user.recentActivities.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No recent activities recorded for this user.
                </div>
              ) : (
                <div className="space-y-3">
                  {user.recentActivities.map((act) => (
                    <div
                      key={act.id}
                      className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant="outline"
                            className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px]"
                          >
                            {act.type}
                          </Badge>
                          {act.lead && (
                            <Link
                              href={`/app/leads/${act.lead.id}`}
                              className="font-semibold text-slate-800 hover:text-indigo-600 transition"
                            >
                              {act.lead.name}
                            </Link>
                          )}
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          {act.description}
                        </p>
                      </div>

                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(act.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
