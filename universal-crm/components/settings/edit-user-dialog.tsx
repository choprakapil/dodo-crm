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
import { Loader2, Edit } from "lucide-react";

interface RoleOption {
  id: string;
  name: string;
}

interface TeamOption {
  id: string;
  name: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  status: string;
  role: { id: string; name: string };
  teams: { id: string; name: string }[];
}

interface EditUserDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated?: () => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated,
}: EditUserDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"ACTIVE" | "DISABLED">("ACTIVE");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = useCallback(async () => {
    setFetching(true);
    try {
      const [rolesRes, teamsRes] = await Promise.all([
        fetch("/api/v1/roles"),
        fetch("/api/v1/teams?limit=100"),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData.data || []);
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData.data || []);
      }
    } catch {
      setError("Failed to load roles and teams");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open && user) {
      setName(user.name);
      setPhone(user.phone || "");
      setRoleId(user.role.id);
      setSelectedTeamIds(user.teams.map((t) => t.id));
      setStatus(user.status === "DISABLED" ? "DISABLED" : "ACTIVE");
      setError(null);
      fetchOptions();
    }
  }, [open, user, fetchOptions]);

  const handleToggleTeam = (teamId: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          roleId,
          teamIds: selectedTeamIds,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update user");
      }

      onOpenChange(false);
      if (onUserUpdated) {
        onUserUpdated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Edit className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                Edit User
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update account details, role permissions, and team assignments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Email Address (Immutable)</Label>
            <Input
              disabled
              value={user.email}
              className="bg-slate-950/60 border-slate-800/80 text-xs text-slate-400 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name" className="text-xs text-slate-300">
                Full Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-phone" className="text-xs text-slate-300">
                Phone
              </Label>
              <Input
                id="edit-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1..."
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-xs text-slate-300">
                Role <span className="text-rose-400">*</span>
              </Label>
              <select
                id="edit-role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={fetching}
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
              <Label htmlFor="edit-status" className="text-xs text-slate-300">
                Status
              </Label>
              <select
                id="edit-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "DISABLED")}
                className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="DISABLED">DISABLED</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-slate-300">Team Memberships</Label>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 max-h-36 overflow-y-auto space-y-2">
              {teams.length === 0 ? (
                <div className="text-xs text-slate-500">No teams available</div>
              ) : (
                teams.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center space-x-2.5 text-xs text-slate-300 cursor-pointer hover:text-slate-100 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(t.id)}
                      onChange={() => handleToggleTeam(t.id)}
                      className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 h-3.5 w-3.5"
                    />
                    <span>{t.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300 text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || fetching}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
