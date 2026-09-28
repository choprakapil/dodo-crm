"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, ShieldCheck, Loader2 } from "lucide-react";
import { AddTeamMemberDialog } from "@/components/settings/add-team-member-dialog";

export interface TeamMemberUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  role: { id: string; name: string };
}

interface TeamRosterProps {
  teamId: string;
  members: TeamMemberUser[];
  canManage: boolean;
}

export function TeamRoster({ teamId, members, canManage }: TeamRosterProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleRemove = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName} from this team?`)) {
      return;
    }

    setRemovingId(userId);
    try {
      const res = await fetch(`/api/v1/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to remove member");
      }

      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">
            Team Members ({members.length})
          </h2>
          <p className="text-xs text-slate-400">
            Assigned agents and managers who share this team data scope.
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 px-3"
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Add Member
          </Button>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Member</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              {canManage && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {members.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 4 : 3}
                  className="py-8 text-center text-slate-500"
                >
                  No members assigned to this team yet.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-850/40 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[11px] text-slate-300">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/app/settings/users/${member.id}`}
                          className="font-medium text-slate-200 hover:text-indigo-400 transition"
                        >
                          {member.name}
                        </Link>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <Badge
                      variant="secondary"
                      className="bg-slate-800 border-slate-700 text-slate-300 text-[11px] font-normal"
                    >
                      <ShieldCheck className="h-3 w-3 mr-1 text-indigo-400" />
                      {member.role.name}
                    </Badge>
                  </td>

                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        member.status === "ACTIVE"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-slate-700 bg-slate-800 text-slate-400"
                      }`}
                    >
                      {member.status}
                    </Badge>
                  </td>

                  {canManage && (
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(member.id, member.name)}
                        disabled={removingId === member.id}
                        className="text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 h-7 px-2 text-xs"
                      >
                        {removingId === member.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserMinus className="h-3.5 w-3.5 mr-1" />
                            Remove
                          </>
                        )}
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddTeamMemberDialog
        teamId={teamId}
        existingMemberUserIds={members.map((m) => m.id)}
        open={addOpen}
        onOpenChange={setAddOpen}
        onMemberAdded={() => router.refresh()}
      />
    </div>
  );
}
