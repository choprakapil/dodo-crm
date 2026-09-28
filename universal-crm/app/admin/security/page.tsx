"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  KeyRound,
  Laptop,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function AdminSecurityPage() {
  const [adminProfile, setAdminProfile] = useState<{ email: string; name: string } | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [isSubmittingPw, setIsSubmittingPw] = useState(false);

  // Session Revocation State
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProfileAndSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const [meRes, sessRes] = await Promise.all([
        fetch("/api/v1/admin/auth/me"),
        fetch("/api/v1/admin/security/sessions"),
      ]);

      const meJson = await meRes.json();
      if (meJson.success) {
        setAdminProfile(meJson.data.superAdmin);
      }

      const sessJson = await sessRes.json();
      if (sessJson.success) {
        setSessions(sessJson.data);
      }
    } catch {
      // Error handling
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileAndSessions();
  }, [fetchProfileAndSessions]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters long.");
      return;
    }

    setIsSubmittingPw(true);
    try {
      const res = await fetch("/api/v1/admin/security/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setPwError(json.error?.message || "Failed to update password.");
        return;
      }

      setPwSuccess(json.message || "Password successfully changed!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      fetchProfileAndSessions();
    } catch {
      setPwError("An unexpected network error occurred.");
    } finally {
      setIsSubmittingPw(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/admin/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProfileAndSessions();
      } else {
        alert(json.error?.message || "Failed to revoke session.");
      }
    } catch {
      alert("Failed to revoke session.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm("Are you sure you want to log out of all other active sessions?")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/admin/security/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeOthers: true }),
      });
      const json = await res.json();
      if (json.success) {
        fetchProfileAndSessions();
      } else {
        alert(json.error?.message || "Failed to revoke sessions.");
      }
    } catch {
      alert("Failed to revoke sessions.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Security & Profile
        </h1>
        <p className="text-xs text-slate-500">
          Manage platform administrator credentials, authentication devices, and active sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Profile & Password Change */}
        <div className="space-y-6 lg:col-span-1">
          {/* Profile Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Administrator Identity
            </h2>
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Name</span>
                <span className="font-semibold text-slate-800">{adminProfile?.name || "Platform Super Admin"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Email</span>
                <span className="font-semibold text-slate-800">{adminProfile?.email || "superadmin@universalcrm.com"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Role</span>
                <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  SUPER ADMIN
                </span>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="h-4 w-4 text-slate-700" />
              Change Platform Password
            </h2>

            {pwError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{pwError}</span>
              </div>
            )}

            {pwSuccess && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{pwSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 shadow-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <Button
                type="submit"
                disabled={isSubmittingPw}
                size="sm"
                className="w-full bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-500 mt-2"
              >
                {isSubmittingPw ? "Updating Password..." : "Update Password"}
              </Button>
            </form>
          </div>
        </div>

        {/* Right Column: Active Sessions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Laptop className="h-4 w-4 text-slate-700" />
                Active Platform Sessions
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review browser and API sessions authenticated with Super Admin privileges.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProfileAndSessions}
                disabled={isLoadingSessions}
                className="h-7 text-xs"
              >
                <RefreshCw className={`mr-1.5 h-3 w-3 ${isLoadingSessions ? "animate-spin" : ""}`} />
                Refresh
              </Button>

              {sessions.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRevokeOtherSessions}
                  disabled={actionLoading}
                  className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  <LogOut className="mr-1.5 h-3 w-3" />
                  Sign Out Other Sessions
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isLoadingSessions ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-indigo-600 mb-1.5" />
                Loading sessions...
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-lg border p-3.5 text-xs transition-colors ${
                    s.isCurrent ? "border-indigo-200 bg-indigo-50/40" : "border-slate-100 bg-slate-50/50"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {s.userAgent ? s.userAgent.slice(0, 60) : "Browser Client"}
                      </span>
                      {s.isCurrent && (
                        <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          Current Device
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                      <span>IP: {s.ipAddress || "127.0.0.1"}</span>
                      <span>•</span>
                      <span>Created: {new Date(s.createdAt).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>Expires: {new Date(s.expiresAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(s.id)}
                      disabled={actionLoading}
                      className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                No active sessions found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
