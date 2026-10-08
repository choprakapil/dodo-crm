"use client";

import { useState, useEffect } from "react";
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
  role: {
    name: string;
  };
}

interface AddTeamMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  existingMemberUserIds: string[];
  onMemberAdded: () => void;
}

export function AddTeamMemberDialog({
  open,
  onOpenChange,
  teamId,
  existingMemberUserIds,
  onMemberAdded,
}: AddTeamMemberDialogProps) {
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [fetching, setFetching] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
    } else {
      setSelectedUserId("");
      setError(null);
    }
  }, [open]);

  const fetchUsers = async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users?limit=100&status=ACTIVE");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const filtered = data.data.filter(
          (u: UserOption) => !existingMemberUserIds.includes(u.id)
        );
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
  };

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
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to add team member");
      }

      onMemberAdded();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Add Team Member
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Select an active user from your organization to add to this team.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleAdd} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="team-member-select" className="text-xs text-slate-700 font-medium">
              Select User <span className="text-rose-500">*</span>
            </Label>
            {fetching ? (
              <div className="h-9 flex items-center justify-center text-xs text-slate-500">
                Loading available users...
              </div>
            ) : availableUsers.length === 0 ? (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                All active users are already members of this team.
              </div>
            ) : (
              <select
                id="team-member-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full h-9 rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 px-3 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              >
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.name} — {u.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <DialogFooter className="pt-3 gap-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || availableUsers.length === 0 || !selectedUserId}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-medium shadow-xs"
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
