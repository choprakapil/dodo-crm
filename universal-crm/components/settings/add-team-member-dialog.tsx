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
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: { name: string };
}

interface AddTeamMemberDialogProps {
  teamId: string;
  existingMemberUserIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded?: () => void;
}

export function AddTeamMemberDialog({
  teamId,
  existingMemberUserIds,
  open,
  onOpenChange,
  onMemberAdded,
}: AddTeamMemberDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/v1/users?limit=100&status=ACTIVE");
      if (res.ok) {
        const data = await res.json();
        const allUsers: UserOption[] = data.data || [];
        // Filter out existing members
        const filtered = allUsers.filter((u) => !existingMemberUserIds.includes(u.id));
        setAvailableUsers(filtered);
        if (filtered.length > 0) {
          setSelectedUserId(filtered[0].id);
        }
      }
    } catch {
      setError("Failed to load users");
    } finally {
      setFetching(false);
    }
  }, [existingMemberUserIds]);

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      setError(null);
      fetchUsers();
    }
  }, [open, fetchUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Please select a user");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to add member to team");
      }

      onOpenChange(false);
      if (onMemberAdded) {
        onMemberAdded();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                Add Team Member
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Select an active user from your organization to add to this team.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="team-member-select" className="text-xs text-slate-300">
              Select User <span className="text-rose-400">*</span>
            </Label>
            {fetching ? (
              <div className="h-9 flex items-center justify-center text-xs text-slate-500">
                Loading available users...
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
                All active users are already members of this team.
              </div>
            ) : (
              <select
                id="team-member-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 px-3 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.name} — {u.email})
                  </option>
                ))}
              </select>
            )}
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
              disabled={loading || availableUsers.length === 0 || !selectedUserId}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add to Team"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
