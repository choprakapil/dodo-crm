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
import { Network, Loader2 } from "lucide-react";

interface CreateDivisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDivisionCreated?: () => void;
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

export function CreateDivisionDialog({
  open,
  onOpenChange,
  onDivisionCreated,
}: CreateDivisionDialogProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [managerId, setManagerId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setFetchingUsers(true);
    try {
      const res = await fetch("/api/v1/users?limit=100&status=ACTIVE");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setUsers(data.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setFetchingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setDescription("");
      setManagerId("");
      setError(null);
      fetchUsers();
    }
  }, [open, fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Division name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/divisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          description: description.trim() || undefined,
          managerId: managerId || undefined,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create division");
      }

      onOpenChange(false);
      if (onDivisionCreated) {
        onDivisionCreated();
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
              <Network className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                Create New Division
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Top-level business unit (e.g. Sales, Operations, Product).
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
            <Label htmlFor="div-name" className="text-xs text-slate-700 font-medium">
              Division Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="div-name"
              placeholder="e.g. Commercial Division, North America"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="div-code" className="text-xs text-slate-700 font-medium">
              Division Code / Key (Optional)
            </Label>
            <Input
              id="div-code"
              placeholder="e.g. COMM-DIV, NA-01"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="bg-slate-50/50 border-slate-200 text-xs text-slate-900 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="div-desc" className="text-xs text-slate-700 font-medium">
              Description (Optional)
            </Label>
            <textarea
              id="div-desc"
              rows={2}
              placeholder="Strategic charter and business scope..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-50/50 border border-slate-200 text-xs text-slate-900 p-2.5 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="div-manager" className="text-xs text-slate-700 font-medium">
              Division Head / VP (Optional)
            </Label>
            <select
              id="div-manager"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              disabled={fetchingUsers}
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
                "Create Division"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
