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

interface TeamData {
  id: string;
  name: string;
  description: string | null;
  departmentId?: string | null;
  isActive: boolean;
  manager?: {
    id: string;
    name: string;
    email: string;
  } | null;
  members?: unknown[];
}

interface DepartmentOption {
  id: string;
  name: string;
  divisionName?: string;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamData | null;
  onTeamUpdated?: () => void;
}

export function EditTeamDialog({
  open,
  onOpenChange,
  team,
  onTeamUpdated,
}: EditTeamDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [deptRes, usersRes] = await Promise.all([
        fetch("/api/v1/departments?limit=100&isActive=true"),
        fetch("/api/v1/users?limit=100&status=ACTIVE"),
      ]);
      const [deptData, usersData] = await Promise.all([deptRes.json(), usersRes.json()]);

      if (deptData.success && Array.isArray(deptData.data)) {
        setDepartments(deptData.data);
      }
      if (usersData.success && Array.isArray(usersData.data)) {
        setUsers(usersData.data);
      }
    } catch {
      setError("Failed to load options");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (open && team) {
      setName(team.name);
      setDescription(team.description || "");
      setDepartmentId(team.departmentId || "");
      setManagerId(team.manager?.id || "");
      setIsActive(team.isActive);
      setError(null);
      fetchData();
    }
  }, [open, team, fetchData]);

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
          departmentId: departmentId || null,
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
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Edit className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Edit Team
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Update team name, department, description, lead assignment, and active status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-name" className="text-xs text-slate-700 font-medium">
              Team Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-department" className="text-xs text-slate-700 font-medium">
              Parent Department
            </Label>
            <select
              id="edit-team-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={fetching}
              className="w-full h-9 rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 px-3 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">No Department (Unassigned)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.divisionName ? `${d.divisionName} → ` : ""}{d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-desc" className="text-xs text-slate-700 font-medium">
              Description
            </Label>
            <textarea
              id="edit-team-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 p-2.5 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-team-manager" className="text-xs text-slate-700 font-medium">
              Team Manager / Lead
            </Label>
            <select
              id="edit-team-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={fetching}
              className="w-full h-9 rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 px-3 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
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
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <Label htmlFor="edit-team-active" className="text-xs text-slate-700 cursor-pointer">
              Active Team (Visible in assignment selectors)
            </Label>
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
              disabled={loading || fetching || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-medium shadow-xs"
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
