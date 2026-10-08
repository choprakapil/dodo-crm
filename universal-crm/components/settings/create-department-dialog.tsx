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
import { Building2, Loader2 } from "lucide-react";

interface CreateDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDivisionId?: string;
  onDepartmentCreated?: () => void;
}

interface DivisionOption {
  id: string;
  name: string;
  code?: string | null;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function CreateDepartmentDialog({
  open,
  onOpenChange,
  defaultDivisionId,
  onDepartmentCreated,
}: CreateDepartmentDialogProps) {
  const [divisionId, setDivisionId] = useState(defaultDivisionId || "");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [divisions, setDivisions] = useState<DivisionOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setFetchingData(true);
    try {
      const [divRes, usersRes] = await Promise.all([
        fetch("/api/v1/divisions?limit=100&isActive=true"),
        fetch("/api/v1/users?limit=100&status=ACTIVE"),
      ]);
      const [divData, usersData] = await Promise.all([divRes.json(), usersRes.json()]);

      if (divData.success && Array.isArray(divData.data)) {
        setDivisions(divData.data);
        if (!divisionId && divData.data.length > 0) {
          setDivisionId(defaultDivisionId || divData.data[0].id);
        }
      }
      if (usersData.success && Array.isArray(usersData.data)) {
        setUsers(usersData.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setFetchingData(false);
    }
  }, [defaultDivisionId, divisionId]);

  useEffect(() => {
    if (open) {
      setDivisionId(defaultDivisionId || "");
      setName("");
      setCode("");
      setDescription("");
      setManagerId("");
      setError(null);
      fetchData();
    }
  }, [open, defaultDivisionId, fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divisionId) {
      setError("Please select a parent division");
      return;
    }
    if (!name.trim()) {
      setError("Department name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          divisionId,
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
          managerId: managerId || undefined,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create department");
      }

      onOpenChange(false);
      if (onDepartmentCreated) {
        onDepartmentCreated();
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
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Create New Department
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Functional departmental unit belonging to a Division.
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
            <Label htmlFor="dept-division" className="text-xs text-slate-700 font-medium">
              Parent Division <span className="text-rose-500">*</span>
            </Label>
            <select
              id="dept-division"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={fetchingData}
              required
              className="w-full h-9 rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 px-3 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select Division...</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.code ? `(${d.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dept-name" className="text-xs text-slate-700 font-medium">
              Department Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="dept-name"
              placeholder="e.g. Inbound Lead Gen, Mid-Market Sales"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dept-code" className="text-xs text-slate-700 font-medium">
              Department Code (Optional)
            </Label>
            <Input
              id="dept-code"
              placeholder="e.g. INB-DEPT, MM-SALES"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dept-desc" className="text-xs text-slate-700 font-medium">
              Description (Optional)
            </Label>
            <textarea
              id="dept-desc"
              rows={2}
              placeholder="Scope and focus of this department..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 p-2.5 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dept-manager" className="text-xs text-slate-700 font-medium">
              Department Head / Director (Optional)
            </Label>
            <select
              id="dept-manager"
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
              disabled={loading || !name.trim() || !divisionId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 font-medium shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Department"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
