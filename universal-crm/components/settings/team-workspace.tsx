"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Search,
  UserPlus,
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Crown,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateTeamDialog } from "@/components/settings/create-team-dialog";
import { EditTeamDialog } from "@/components/settings/edit-team-dialog";

export interface SerializedTeam {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  manager: {
    id: string;
    name: string;
    email: string;
  } | null;
  memberCount: number;
  leadCount: number;
}

interface TeamWorkspaceProps {
  initialTeams: SerializedTeam[];
  total: number;
  currentPage: number;
  totalPages: number;
  initialSearch?: string;
  canManage: boolean;
}

export function TeamWorkspace({
  initialTeams,
  total,
  initialSearch = "",
  canManage,
}: TeamWorkspaceProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<SerializedTeam | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const applySearch = () => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    router.push(`/app/settings/teams?${params.toString()}`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete team '${name}'? Members will be unassigned from this team.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/v1/teams/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to delete team");
      }

      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Team Management
            </h1>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-xs">
              {total} Teams
            </Badge>
            <Link
              href="/app/help?article=teams"
              className="text-slate-500 hover:text-indigo-400 transition ml-1"
              title="Team Management Help Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Organize sales reps and managers into functional teams for scope isolation and group performance tracking.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3.5 shadow-sm shadow-indigo-500/20"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Create Team
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center space-x-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            placeholder="Search teams by name... (Press Enter)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            className="pl-9 bg-slate-950 border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 h-9"
          />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {initialTeams.length === 0 ? (
          <div className="col-span-full p-12 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-slate-500 text-xs">
            <Users className="h-8 w-8 mx-auto mb-2 text-slate-600" />
            No teams found matching the search criteria.
          </div>
        ) : (
          initialTeams.map((team) => (
            <div
              key={team.id}
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/app/settings/teams/${team.id}`}
                      className="text-base font-bold text-slate-100 hover:text-indigo-400 transition"
                    >
                      {team.name}
                    </Link>
                    <div className="mt-1 flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${
                          team.isActive
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-slate-700 bg-slate-800 text-slate-400"
                        }`}
                      >
                        {team.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-[11px] text-slate-500">
                        {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-lg p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-slate-900 border-slate-800 text-slate-200 text-xs w-44"
                    >
                      <DropdownMenuItem
                        onClick={() => router.push(`/app/settings/teams/${team.id}`)}
                        className="flex items-center cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-2 text-slate-400" />
                        View Team Roster
                      </DropdownMenuItem>

                      {canManage && (
                        <>
                          <DropdownMenuItem
                            onClick={() => setEditTeam(team)}
                            className="flex items-center cursor-pointer"
                          >
                            <Edit className="h-3.5 w-3.5 mr-2 text-indigo-400" />
                            Edit Settings
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleDelete(team.id, team.name)}
                            disabled={deletingId === team.id}
                            className="flex items-center cursor-pointer text-rose-400 focus:text-rose-400"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete Team
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {team.description ? (
                  <p className="text-xs text-slate-400 mt-3 line-clamp-2 leading-relaxed">
                    {team.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 italic mt-3">
                    No description provided.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-slate-400">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  <span>Lead:</span>
                  <span className="text-slate-200 font-medium truncate max-w-[120px]">
                    {team.manager ? team.manager.name : "Unassigned"}
                  </span>
                </div>

                <Link
                  href={`/app/settings/teams/${team.id}`}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                >
                  Manage →
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateTeamDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onTeamCreated={() => router.refresh()}
      />

      <EditTeamDialog
        team={editTeam}
        open={Boolean(editTeam)}
        onOpenChange={(open) => !open && setEditTeam(null)}
        onTeamUpdated={() => router.refresh()}
      />
    </div>
  );
}
