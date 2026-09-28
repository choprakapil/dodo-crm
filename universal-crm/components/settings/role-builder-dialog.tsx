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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2 } from "lucide-react";
import { SYSTEM_MODULES } from "@/lib/services/role.service";

interface RolePermissionItem {
  module: string;
  action: string;
  dataScope: "OWN" | "TEAM" | "COMPANY" | "PLATFORM";
}

interface RoleData {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: {
    id?: string;
    module: string;
    action: string;
    dataScope: "OWN" | "TEAM" | "COMPANY" | "PLATFORM";
  }[];
}

interface RoleBuilderDialogProps {
  role: RoleData | null; // null for create mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function RoleBuilderDialog({
  role,
  open,
  onOpenChange,
  onSaved,
}: RoleBuilderDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<RolePermissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setDescription(role.description || "");
        setSelectedPermissions(
          role.permissions.map((p) => ({
            module: p.module,
            action: p.action,
            dataScope: p.dataScope,
          }))
        );
      } else {
        setName("");
        setDescription("");
        setSelectedPermissions([
          { module: "leads", action: "view", dataScope: "OWN" },
          { module: "leads", action: "create", dataScope: "OWN" },
        ]);
      }
      setError(null);
    }
  }, [open, role]);

  const hasPerm = (module: string, action: string) => {
    return selectedPermissions.some((p) => p.module === module && p.action === action);
  };

  const getScope = (module: string, action: string): "OWN" | "TEAM" | "COMPANY" => {
    const item = selectedPermissions.find((p) => p.module === module && p.action === action);
    return item?.dataScope === "PLATFORM" ? "COMPANY" : (item?.dataScope || "COMPANY");
  };

  const togglePerm = (module: string, action: string) => {
    setSelectedPermissions((prev) => {
      const exists = prev.some((p) => p.module === module && p.action === action);
      if (exists) {
        return prev.filter((p) => !(p.module === module && p.action === action));
      } else {
        return [...prev, { module, action, dataScope: "COMPANY" }];
      }
    });
  };

  const setScope = (module: string, action: string, scope: "OWN" | "TEAM" | "COMPANY") => {
    setSelectedPermissions((prev) =>
      prev.map((p) => {
        if (p.module === module && p.action === action) {
          return { ...p, dataScope: scope };
        }
        return p;
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Role name is required");
      return;
    }

    if (selectedPermissions.length === 0) {
      setError("Please grant at least one permission");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const isEditing = Boolean(role);
      const url = isEditing ? `/api/v1/roles/${role!.id}` : "/api/v1/roles";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: selectedPermissions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save role");
      }

      onOpenChange(false);
      if (onSaved) {
        onSaved();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                {role ? `Edit Role: ${role.name}` : "Create Custom Role"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Define role identity and configure granular permissions with explicit data scopes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 flex-1 overflow-y-auto pr-1 py-2">
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="role-name" className="text-xs text-slate-300">
                Role Name <span className="text-rose-400">*</span>
              </Label>
              <Input
                id="role-name"
                placeholder="e.g. Regional Lead, Support Specialist"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={role?.isSystem}
                required
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
              {role?.isSystem && (
                <p className="text-[10px] text-slate-500">
                  System role names cannot be altered.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role-desc" className="text-xs text-slate-300">
                Description (Optional)
              </Label>
              <Input
                id="role-desc"
                placeholder="Brief summary of responsibilities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs text-slate-100"
              />
            </div>
          </div>

          {/* Permissions Matrix */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-200">
                Permission Matrix ({selectedPermissions.length} selected)
              </Label>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-[10px]">
                module.action + scope
              </Badge>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {SYSTEM_MODULES.map((mod) => (
                <div
                  key={mod.module}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                      {mod.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      module: {mod.module}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {mod.actions.map((act) => {
                      const enabled = hasPerm(mod.module, act);
                      const currentScope = getScope(mod.module, act);
                      return (
                        <div
                          key={act}
                          className={`p-2 rounded-lg border text-xs transition flex flex-col justify-between space-y-1.5 ${
                            enabled
                              ? "bg-slate-900 border-indigo-500/40 text-slate-100"
                              : "bg-slate-950 border-slate-800/60 text-slate-400"
                          }`}
                        >
                          <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() => togglePerm(mod.module, act)}
                              className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-950 h-3.5 w-3.5"
                            />
                            <span className="capitalize font-medium">{act}</span>
                          </label>

                          {enabled && (
                            <div className="flex items-center space-x-1 pl-5">
                              <span className="text-[10px] text-slate-500">Scope:</span>
                              <select
                                value={currentScope}
                                onChange={(e) =>
                                  setScope(
                                    mod.module,
                                    act,
                                    e.target.value as "OWN" | "TEAM" | "COMPANY"
                                  )
                                }
                                className="h-6 text-[10px] bg-slate-950 border border-slate-700 text-indigo-300 rounded px-1"
                              >
                                <option value="OWN">OWN</option>
                                <option value="TEAM">TEAM</option>
                                <option value="COMPANY">COMPANY</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 gap-2 border-t border-slate-800">
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
              disabled={loading || selectedPermissions.length === 0 || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : role ? (
                "Update Role"
              ) : (
                "Create Role"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
