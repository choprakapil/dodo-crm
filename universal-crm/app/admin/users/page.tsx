"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  KeyRound,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  UserCheck,
  ChevronRight,
  Shield,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useBulkSelection, BulkCheckbox, BulkActionToolbar, BulkAction } from "@/components/bulk";

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "INVITED" | "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  teams: Array<{ id: string; name: string }>;
  activeSessions: number;
}

export default function GlobalUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // Role Promotion Modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  // Universal Bulk Selection Hook
  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection<UserItem>({
    items: users,
  });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      let url = `/api/v1/admin/users?limit=50`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setUsers(json.items || []);
        setTotalCount(json.pagination?.total || 0);
      }
    } catch {
      toast.error("Failed to fetch global users.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearSelection();
    loadUsers();
  };

  // Toggle Single User Status (ACTIVE <-> DISABLED)
  const handleToggleStatus = async (user: UserItem) => {
    const newStatus = user.status === "DISABLED" ? "ACTIVE" : "DISABLED";
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`User status updated to ${newStatus}.`);
        loadUsers();
      } else {
        toast.error(json.error?.message || "Action failed.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Reset Single Password Action
  const handleResetPassword = async () => {
    if (!selectedUser) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${selectedUser.id}/reset-password`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setTemporaryPassword(json.data.temporaryPassword);
        toast.success("User password reset and active sessions revoked.");
      } else {
        toast.error(json.error?.message || "Failed to reset password.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Revoke User Sessions
  const handleRevokeSessions = async (userId: string) => {
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/sessions`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Active user sessions revoked.");
        loadUsers();
      } else {
        toast.error(json.error?.message || "Action failed.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Open Role Modal
  const openRoleModal = async (user: UserItem) => {
    setSelectedUser(user);
    try {
      const res = await fetch(`/api/v1/admin/crm-config/roles?companyId=${user.company.id}`);
      const json = await res.json();
      if (json.success) {
        setAvailableRoles(json.data || []);
        setSelectedRoleId(user.role.id);
        setShowRoleModal(true);
      }
    } catch {
      toast.error("Failed to load company roles.");
    }
  };

  // Change Role Action
  const handleChangeRole = async () => {
    if (!selectedUser || !selectedRoleId) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/users/${selectedUser.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: selectedRoleId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Role updated successfully.");
        setShowRoleModal(false);
        loadUsers();
      } else {
        toast.error(json.error?.message || "Failed to update role.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2000);
    toast.success("Password copied");
  };

  // Declarative Bulk Actions for Users
  const bulkActions: BulkAction<UserItem>[] = useMemo(() => [
    {
      id: "activate",
      label: "Activate",
      icon: UserCheck,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Activate Selected Users",
      confirmDescription: `Restore active login permissions for ${selectedCount} user account(s).`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/users/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ACTIVATE",
            userIds: ids,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "deactivate",
      label: "Deactivate",
      icon: XCircle,
      variant: "warning",
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Deactivate Selected Users",
      confirmDescription: `Revoke active sessions and disable access for ${selectedCount} user account(s).`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/users/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DEACTIVATE",
            userIds: ids,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "reset_passwords",
      label: "Reset Passwords",
      icon: KeyRound,
      variant: "outline",
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Reset Temporary Passwords",
      confirmDescription: `Generate new temporary passwords and revoke active sessions for ${selectedCount} user(s).`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/users/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "RESET_PASSWORD",
            userIds: ids,
          }),
        });
        return await res.json();
      },
    },
    {
      id: "export",
      label: "Export CSV",
      icon: Download,
      variant: "outline",
      onExecute: async (ids) => {
        const headers = ["ID", "Name", "Email", "Phone", "Status", "Organization", "Role", "Active Sessions", "Last Login", "Created Date"];
        const rows = selectedItems.map((u) => [
          `"${u.id}"`,
          `"${u.name.replace(/"/g, '""')}"`,
          `"${u.email}"`,
          `"${u.phone || ""}"`,
          `"${u.status}"`,
          `"${u.company.name.replace(/"/g, '""')}"`,
          `"${u.role.name}"`,
          u.activeSessions,
          `"${u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "Never"}"`,
          `"${new Date(u.createdAt).toISOString()}"`,
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dodo_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return {
          success: true,
          total: ids.length,
          succeededCount: ids.length,
          failedCount: 0,
        };
      },
    },
    {
      id: "delete",
      label: `Delete (${selectedCount})`,
      icon: Trash2,
      variant: "destructive",
      destructive: true,
      requiresConfirmation: true,
      confirmType: "simple",
      confirmTitle: "Delete Selected Users",
      confirmDescription: `Soft-delete ${selectedCount} user account(s) and revoke their active sessions.`,
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/admin/users/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DELETE",
            userIds: ids,
          }),
        });
        return await res.json();
      },
    },
  ], [selectedCount, selectedItems]);

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Global Users Directory
          </h1>
          <p className="text-xs text-slate-500">
            Cross-tenant identity management, password resets, role escalation guards, and session revocation.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadUsers}
          disabled={isLoading}
          className="h-8 text-xs border-slate-200"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <Card className="border border-slate-200 bg-white shadow-2xs">
        <CardContent className="p-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search user name, email, phone, or organization..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                clearSelection();
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 w-full sm:w-44"
            >
              <option value="">All User Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
              <option value="INVITED">INVITED</option>
            </select>

            <Button type="submit" size="sm" className="h-9 bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 w-full sm:w-auto">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Total Users: {totalCount}
          </CardTitle>
          <span className="text-[11px] text-slate-400 font-mono">Platform Scoped Ledger</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <BulkCheckbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                      onChange={toggleSelectAll}
                      ariaLabel="Select all visible users"
                    />
                  </th>
                  <th className="px-4 py-3">User & Contact</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Active Sessions</th>
                  <th className="px-4 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
                      Loading platform users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400">
                      No users match your criteria.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isSelected = selectedIds.has(user.id);
                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors ${
                          isSelected ? "bg-indigo-50/60 hover:bg-indigo-50/80" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <BulkCheckbox
                            checked={isSelected}
                            onChange={() => toggleSelect(user.id)}
                            ariaLabel={`Select ${user.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{user.name}</div>
                          <div className="text-[11px] text-slate-500">{user.email}</div>
                          {user.phone && <div className="text-[10px] text-slate-400">{user.phone}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/companies/${user.company.id}`} className="font-medium text-indigo-600 hover:underline">
                            {user.company.name}
                          </Link>
                          <div className="text-[10px] text-slate-400 font-mono">{user.company.slug}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {user.role.isSystem && <Shield className="h-3 w-3 text-indigo-600" />}
                            {user.role.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              user.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : user.status === "DISABLED"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${user.activeSessions > 0 ? "text-slate-900" : "text-slate-400"}`}>
                              {user.activeSessions} active
                            </span>
                            {user.activeSessions > 0 && (
                              <button
                                onClick={() => handleRevokeSessions(user.id)}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-medium underline"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-[11px]">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(user)}
                              className={`h-7 px-2 text-[11px] ${
                                user.status === "DISABLED"
                                  ? "text-emerald-700 hover:bg-emerald-50"
                                  : "text-amber-700 hover:bg-amber-50"
                              }`}
                            >
                              {user.status === "DISABLED" ? "Activate" : "Deactivate"}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setShowResetModal(true);
                              }}
                              className="h-7 px-2 text-[11px] text-indigo-700 hover:bg-indigo-50"
                            >
                              <KeyRound className="h-3 w-3 mr-1" /> Reset
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRoleModal(user)}
                              className="h-7 px-2 text-[11px] text-slate-700 hover:bg-slate-100"
                            >
                              <Edit className="h-3 w-3 mr-1" /> Role
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Universal Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        selectedIds={Array.from(selectedIds)}
        actions={bulkActions}
        onClearSelection={clearSelection}
        onActionComplete={loadUsers}
        entityName="users"
        totalMatchingCount={totalCount}
      />

      {/* Single Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Reset User Password</h3>
                <p className="text-xs text-slate-500">
                  Target: <span className="font-semibold text-slate-700">{selectedUser.email}</span>
                </p>
              </div>
            </div>

            {temporaryPassword ? (
              <div className="space-y-3 pt-2">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Temporary Password Generated:
                  </div>
                  <div className="flex items-center justify-between rounded bg-white p-2 font-mono text-sm font-bold text-slate-900 border border-emerald-200">
                    <span>{temporaryPassword}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copyToClipboard(temporaryPassword)}>
                      {copiedPass ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <Button
                  className="w-full bg-slate-900 text-xs"
                  onClick={() => {
                    setShowResetModal(false);
                    setTemporaryPassword(null);
                    loadUsers();
                  }}
                >
                  Close & Done
                </Button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  Generating a temporary password will immediately invalidate all active sessions for this user.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="outline" size="sm" onClick={() => setShowResetModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" className="bg-indigo-600 text-white" disabled={isActionLoading} onClick={handleResetPassword}>
                    {isActionLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Generate New Password
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Single Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Change Role Assignment</h3>
                <p className="text-xs text-slate-500">
                  Organization: <span className="font-semibold text-slate-700">{selectedUser.company.name}</span>
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Select Role</label>
              <select
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900"
              >
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isSystem ? "(System Role)" : "(Custom Role)"}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowRoleModal(false)}>
                Cancel
              </Button>
              <Button size="sm" className="bg-indigo-600 text-white" disabled={isActionLoading} onClick={handleChangeRole}>
                {isActionLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm Role Change
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
