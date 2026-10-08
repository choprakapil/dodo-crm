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
import { Users, Loader2 } from "lucide-react";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDepartmentId?: string;
  onTeamCreated?: () => void;
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

export function CreateTeamDialog({
  open,
  onOpenChange,
  defaultDepartmentId,
  onTeamCreated,
}: CreateTeamDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId || "");
  const [managerId, setManagerId] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetchingData(true);
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
      // Non-blocking
    } finally {
      setFetchingData(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setDepartmentId(defaultDepartmentId || "");
      setManagerId("");
      setError(null);
      fetchData();
    }
  }, [open, defaultDepartmentId, fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Team name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          departmentId: departmentId || undefined,
          managerId: managerId || undefined,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create team");
      }

      onOpenChange(false);
      if (onTeamCreated) {
        onTeamCreated();
      }
    } catch (err: unknown) {
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
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Create New Team
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Organize users into functional sales or operational squads.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-4 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="team-name" className="text-xs text-slate-700 font-medium">
              Team Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="team-name"
              placeholder="e.g. Enterprise Sales, West Coast SDRs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-department" className="text-xs text-slate-700 font-medium">
              Parent Department (Optional)
            </Label>
            <select
              id="team-department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={fetchingData}
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
            <Label htmlFor="team-desc" className="text-xs text-slate-700 font-medium">
              Description (Optional)
            </Label>
            <textarea
              id="team-desc"
              rows={2}
              placeholder="Primary responsibilities and target customer profile..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 p-2.5 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="team-manager" className="text-xs text-slate-700 font-medium">
              Team Manager / Lead (Optional)
            </Label>
            <select
              id="team-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={fetchingData}
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
              disabled={loading || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 font-medium shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Team"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
