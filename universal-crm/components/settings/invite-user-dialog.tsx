"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Copy, Check, UserPlus } from "lucide-react";

interface RoleOption {
  id: string;
  name: string;
  description?: string;
}

interface TeamOption {
  id: string;
  name: string;
}

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserInvited?: () => void;
}

export function InviteUserDialog({
  open,
  onOpenChange,
  onUserInvited,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchOptions = useCallback(async () => {
    setFetchingOptions(true);
    try {
      const [rolesRes, teamsRes] = await Promise.all([
        fetch("/api/v1/roles"),
        fetch("/api/v1/teams?limit=100"),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        const list = rolesData.data || [];
        setRoles(list);
        if (list.length > 0 && !roleId) {
          // Default to Sales Rep or first non-admin role
          const defaultRole = list.find((r: RoleOption) => r.name === "Sales Rep") || list[0];
          setRoleId(defaultRole.id);
        }
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.data || []);
      }
    } catch {
      setError("Failed to load roles and teams");
    } finally {
      setFetchingOptions(false);
    }
  }, [roleId]);

  useEffect(() => {
    if (open) {
      setError(null);
      setInviteLink(null);
      setCopied(false);
      fetchOptions();
    }
  }, [open, fetchOptions]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !roleId) {
      setError("Email and role are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          roleId,
          teamId: teamId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to invite user");
      }

      setInviteLink(data.data.inviteLink);
      if (onUserInvited) {
        onUserInvited();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setName("");
    setRoleId("");
    setTeamId("");
    setInviteLink(null);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                Invite New User
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Send an invitation link with 7-day validity to join your organization.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4 py-3">
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              <p className="font-semibold mb-1">Invitation Created Successfully!</p>
              <p className="text-slate-300">
                An invitation email has been dispatched to <span className="font-mono text-emerald-200">{email}</span>. You can also share the direct link below:
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-300">Direct Invitation Link</Label>
              <div className="flex items-center space-x-2">
                <Input
                  readOnly
                  value={inviteLink}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-300 font-mono select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 h-9 px-3 shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                onClick={handleClose}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4 py-2">
            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs text-slate-300">
                Work Email <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-name" className="text-xs text-slate-300">
                Full Name (Optional)
              </Label>
              <Input
                id="invite-name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs text-slate-300">
                  Role <span className="text-rose-400">*</span>
                </Label>
                <select
                  id="invite-role"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  disabled={fetchingOptions}
                  className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-team" className="text-xs text-slate-300">
                  Assign Team (Optional)
                </Label>
                <select
                  id="invite-team"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={fetchingOptions}
                  className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">No Team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || fetchingOptions}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 font-medium"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Sending Invite...
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5 mr-1.5" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
