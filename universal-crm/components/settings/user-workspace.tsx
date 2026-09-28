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
  KeyRound,
  Eye,
  ShieldCheck,
  UserX,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InviteUserDialog } from "@/components/settings/invite-user-dialog";
import { EditUserDialog } from "@/components/settings/edit-user-dialog";
import { ResetUserPasswordDialog } from "@/components/settings/reset-user-password-dialog";
import { UserStatusDialog } from "@/components/settings/user-status-dialog";

export interface SerializedUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  teams: {
    id: string;
    name: string;
  }[];
  assignedLeadsCount: number;
}

interface UserWorkspaceProps {
  initialUsers: SerializedUser[];
  total: number;
  currentPage: number;
  totalPages: number;
  initialSearch?: string;
  initialStatus?: string;
  canManage: boolean;
  currentUserId: string;
}

export function UserWorkspace({
  initialUsers,
  total,
  currentPage,
  totalPages,
  initialSearch = "",
  initialStatus = "ALL",
  canManage,
  currentUserId,
}: UserWorkspaceProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);

  // Modal states
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<SerializedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    id: string;
    name: string;
    targetStatus: "ACTIVE" | "DISABLED";
  } | null>(null);

  const applyFilters = (newSearch?: string, newStatus?: string, page = 1) => {
    const params = new URLSearchParams();
    const s = newSearch !== undefined ? newSearch : searchTerm;
    const st = newStatus !== undefined ? newStatus : statusFilter;

    if (s.trim()) params.set("search", s.trim());
    if (st && st !== "ALL") params.set("status", st);
    if (page > 1) params.set("page", page.toString());

    router.push(`/app/settings/users?${params.toString()}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              User Management
            </h1>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-xs">
              {total} Total Users
            </Badge>
            <Link
              href="/app/help?article=users"
              className="text-slate-500 hover:text-indigo-400 transition ml-1"
              title="User Management Help Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage organization members, assign roles and teams, send invitations, and manage user lifecycle.
          </p>
        </div>

        {canManage && (
          <Button
            onClick={() => setInviteOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3.5 shadow-sm shadow-indigo-500/20"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Invite User
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            placeholder="Search by name, email, or phone... (Press Enter)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 bg-slate-950 border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 h-9"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {["ALL", "ACTIVE", "INVITED", "DISABLED"].map((st) => (
            <Button
              key={st}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter(st);
                applyFilters(undefined, st, 1);
              }}
              className={`text-xs h-8 px-3 rounded-lg capitalize ${
                statusFilter === st
                  ? "bg-slate-800 text-slate-100 font-semibold border border-slate-700"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              {st.toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Teams</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Leads</th>
                <th className="py-3 px-4">Joined / Invited</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {initialUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <Users className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                    No users matching the criteria found.
                  </td>
                </tr>
              ) : (
                initialUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  return (
                    <tr key={user.id} className="hover:bg-slate-850/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600/40 to-violet-600/30 border border-indigo-500/30 flex items-center justify-center font-bold text-xs text-indigo-300">
                            {user.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <Link
                                href={`/app/settings/users/${user.id}`}
                                className="font-semibold text-slate-200 hover:text-indigo-400 transition"
                              >
                                {user.name}
                              </Link>
                              {isCurrentUser && (
                                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[9px] px-1 py-0">
                                  You
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className="bg-slate-800 border-slate-700 text-slate-200 text-[11px] font-normal"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1 text-indigo-400" />
                          {user.role.name}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        {user.teams.length === 0 ? (
                          <span className="text-slate-500 italic">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.teams.map((t) => (
                              <Badge
                                key={t.id}
                                variant="outline"
                                className="border-slate-700 bg-slate-800/60 text-slate-300 text-[10px] px-1.5 py-0"
                              >
                                {t.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-2 py-0.5 font-medium ${
                            user.status === "ACTIVE"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : user.status === "INVITED"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : "border-slate-700 bg-slate-800 text-slate-400"
                          }`}
                        >
                          {user.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {user.assignedLeadsCount}
                      </td>

                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-lg p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-slate-900 border-slate-800 text-slate-200 text-xs w-48"
                          >
                            <DropdownMenuItem
                              onClick={() => router.push(`/app/settings/users/${user.id}`)}
                              className="flex items-center cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5 mr-2 text-slate-400" />
                              View Profile
                            </DropdownMenuItem>

                            {canManage && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setEditUser(user)}
                                  className="flex items-center cursor-pointer"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-2 text-indigo-400" />
                                  Edit Details & Role
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() =>
                                    setResetTarget({ id: user.id, name: user.name })
                                  }
                                  className="flex items-center cursor-pointer"
                                >
                                  <KeyRound className="h-3.5 w-3.5 mr-2 text-amber-400" />
                                  Reset Password
                                </DropdownMenuItem>

                                {!isCurrentUser && (
                                  <>
                                    {user.status === "ACTIVE" ? (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setStatusTarget({
                                            id: user.id,
                                            name: user.name,
                                            targetStatus: "DISABLED",
                                          })
                                        }
                                        className="flex items-center cursor-pointer text-rose-400 focus:text-rose-400"
                                      >
                                        <UserX className="h-3.5 w-3.5 mr-2" />
                                        Disable Account
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setStatusTarget({
                                            id: user.id,
                                            name: user.name,
                                            targetStatus: "ACTIVE",
                                          })
                                        }
                                        className="flex items-center cursor-pointer text-emerald-400 focus:text-emerald-400"
                                      >
                                        <UserCheck className="h-3.5 w-3.5 mr-2" />
                                        Reactivate Account
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => applyFilters(undefined, undefined, currentPage - 1)}
                className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 h-8 px-2.5"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => applyFilters(undefined, undefined, currentPage + 1)}
                className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 h-8 px-2.5"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onUserInvited={() => router.refresh()}
      />

      <EditUserDialog
        user={editUser}
        open={Boolean(editUser)}
        onOpenChange={(open) => !open && setEditUser(null)}
        onUserUpdated={() => router.refresh()}
      />

      <ResetUserPasswordDialog
        userId={resetTarget?.id ?? null}
        userName={resetTarget?.name ?? null}
        open={Boolean(resetTarget)}
        onOpenChange={(open) => !open && setResetTarget(null)}
      />

      <UserStatusDialog
        userId={statusTarget?.id ?? null}
        userName={statusTarget?.name ?? null}
        targetStatus={statusTarget?.targetStatus ?? null}
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        onStatusChanged={() => router.refresh()}
      />
    </div>
  );
}
