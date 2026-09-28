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
import { Edit, Loader2 } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface TeamData {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  manager?: { id: string; name: string } | null;
}

interface EditTeamDialogProps {
  team: TeamData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamUpdated?: () => void;
}

export function EditTeamDialog({
  team,
  open,
  onOpenChange,
  onTeamUpdated,
}: EditTeamDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/v1/users?limit=100&status=ACTIVE");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open && team) {
      setName(team.name);
      setDescription(team.description || "");
      setManagerId(team.manager?.id || "");
      setIsActive(team.isActive);
      setError(null);
      fetchUsers();
    }
  }, [open, team, fetchUsers]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          managerId: managerId || null,
          isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update team");
      }

      onOpenChange(false);
      if (onTeamUpdated) {
        onTeamUpdated();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!team) return null;

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
                Edit Team
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Update team name, description, lead assignment, and active status.
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
            <Label htmlFor="edit-team-name" className="text-xs text-slate-300">
              Team Name <span className="text-rose-400">*</span>
            </Label>
            <Input
              id="edit-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-desc" className="text-xs text-slate-300">
              Description
            </Label>
            <textarea
              id="edit-team-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-100 p-2.5 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-manager" className="text-xs text-slate-300">
              Team Manager / Lead
            </Label>
            <select
              id="edit-team-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={fetching}
              className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">No Manager Assigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="edit-team-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 h-4 w-4"
            />
            <Label htmlFor="edit-team-active" className="text-xs text-slate-300 cursor-pointer">
              Active Team (Visible in assignment selectors)
            </Label>
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
              disabled={loading || fetching || !name.trim()}
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
