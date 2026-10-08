"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  GitBranch,
  ShieldAlert,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CornerDownRight,
  Trash2,
  PowerOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export interface DispositionItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
  depth?: number;
  path?: string | null;
  isActive?: boolean;
  level?: number;
  companyId?: string;
  _count?: {
    children?: number;
    leads?: number;
  };
}

interface DispositionHierarchyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disposition: DispositionItem | null;
  allDispositions: DispositionItem[];
  onHierarchyUpdated: () => void;
  actionType?: "delete" | "deactivate" | "manage";
  isAdminMode?: boolean;
  onDeleteParent?: (id: string) => Promise<void>;
}

export function DispositionHierarchyModal({
  open,
  onOpenChange,
  disposition,
  allDispositions,
  onHierarchyUpdated,
  actionType = "manage",
  isAdminMode = false,
  onDeleteParent,
}: DispositionHierarchyModalProps) {
  const [children, setChildren] = useState<DispositionItem[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [selectedTargetParentId, setSelectedTargetParentId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);
  const [cascadingDeactivate, setCascadingDeactivate] = useState(false);
  const [deletingParent, setDeletingParent] = useState(false);

  // Fetch live children information from server
  const fetchChildren = async (dispId: string) => {
    setLoadingChildren(true);
    try {
      const url = isAdminMode
        ? `/api/v1/admin/crm-config/dispositions/${dispId}/hierarchy`
        : `/api/v1/dispositions/${dispId}/children`;
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setChildren(json.data.children || []);
      } else {
        // Fallback to filtering in-memory
        const filtered = allDispositions.filter((d) => d.parentId === dispId);
        setChildren(filtered);
      }
    } catch {
      const filtered = allDispositions.filter((d) => d.parentId === dispId);
      setChildren(filtered);
    } finally {
      setLoadingChildren(false);
    }
  };

  useEffect(() => {
    if (open && disposition) {
      fetchChildren(disposition.id);
      setSelectedTargetParentId("");
    } else {
      setChildren([]);
    }
  }, [open, disposition]);

  // Exclude current disposition and all its descendants to prevent circular loops
  const eligibleDestinationParents = useMemo(() => {
    if (!disposition) return [];
    const sourcePath = disposition.path || `/${disposition.id}`;

    return allDispositions.filter((d) => {
      // Cannot select self
      if (d.id === disposition.id) return false;
      // In admin mode, ensure same company if companyId exists
      if (disposition.companyId && d.companyId && d.companyId !== disposition.companyId) {
        return false;
      }
      // Cannot select any direct child
      if (d.parentId === disposition.id) return false;
      // Cannot select any descendant
      const dPath = d.path || `/${d.id}`;
      if (dPath.startsWith(`${sourcePath}/`)) return false;

      return true;
    });
  }, [disposition, allDispositions]);

  const handleReassignChildren = async () => {
    if (!disposition) return;
    setReassigning(true);
    try {
      const url = isAdminMode
        ? `/api/v1/admin/crm-config/dispositions/${disposition.id}/reassign-children`
        : `/api/v1/dispositions/${disposition.id}/reassign-children`;

      const targetId = selectedTargetParentId.trim() === "" ? null : selectedTargetParentId.trim();

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetParentId: targetId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to reassign child dispositions");
      }

      toast.success(
        json.message || `Successfully reassigned ${children.length} child disposition(s).`
      );
      onHierarchyUpdated();
      await fetchChildren(disposition.id);
    } catch (err: any) {
      toast.error(err.message || "Reassignment failed");
    } finally {
      setReassigning(false);
    }
  };

  const handleCascadeDeactivate = async () => {
    if (!disposition) return;
    setCascadingDeactivate(true);
    try {
      if (isAdminMode) {
        const res = await fetch("/api/v1/admin/crm-config/dispositions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DEACTIVATE",
            dispositionIds: [disposition.id, ...children.map((c) => c.id)],
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Failed to deactivate dispositions");
        }
      } else {
        const res = await fetch(`/api/v1/dispositions/${disposition.id}/deactivate-cascade`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Failed to cascade deactivate");
        }
      }

      toast.success(`Successfully deactivated "${disposition.name}" and all sub-dispositions.`);
      onHierarchyUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Deactivation failed");
    } finally {
      setCascadingDeactivate(false);
    }
  };

  const handleDeleteEmptyParent = async () => {
    if (!disposition) return;
    if (children.length > 0) {
      toast.error("Cannot delete disposition while child sub-dispositions exist.");
      return;
    }

    setDeletingParent(true);
    try {
      if (onDeleteParent) {
        await onDeleteParent(disposition.id);
      } else {
        const url = isAdminMode
          ? "/api/v1/admin/crm-config/dispositions/bulk"
          : `/api/v1/dispositions/${disposition.id}`;
        
        const method = isAdminMode ? "POST" : "DELETE";
        const body = isAdminMode
          ? JSON.stringify({ action: "DELETE", dispositionIds: [disposition.id] })
          : undefined;

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body,
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Deletion failed");
        }
      }

      toast.success(`Disposition "${disposition.name}" deleted successfully.`);
      onHierarchyUpdated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete disposition");
    } finally {
      setDeletingParent(false);
    }
  };

  if (!disposition) return null;

  const hasChildren = children.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600">
            <GitBranch className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-slate-900">
              Disposition Hierarchy Protection
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Safe parent-child outcome management and relational hierarchy controls for DODO CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Parent Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: disposition.color || "#4F46E5" }}
              />
              <div>
                <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span>{disposition.name}</span>
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                    Level {disposition.depth ?? disposition.level ?? 0}
                  </Badge>
                  {disposition.code && (
                    <span className="text-xs text-slate-400 font-mono">({disposition.code})</span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {disposition.description || "No description provided"}
                </div>
              </div>
            </div>

            <Badge
              className={`text-[10px] uppercase font-bold ${
                disposition.isActive !== false
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {disposition.isActive !== false ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Context Warning Banner */}
          {hasChildren ? (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-lg text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  {actionType === "delete"
                    ? "Deletion Blocked: Child Dispositions Detected"
                    : actionType === "deactivate"
                    ? "Deactivation Warning: Child Dispositions Detected"
                    : "Active Hierarchy Sub-Tree"}
                </span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>{disposition.name}</strong> has{" "}
                <strong className="text-amber-900">{children.length} child disposition{children.length > 1 ? "s" : ""}</strong>.
                {actionType === "delete" &&
                  " To preserve data integrity and prevent broken outcome paths, you cannot delete this disposition until its child outcomes are reassigned or removed."}
                {actionType === "deactivate" &&
                  " Deactivating this parent alone may leave child dispositions pointing to an inactive root. You can either reassign children to another active parent or cascade deactivation to all children."}
                {actionType === "manage" &&
                  " You can inspect the child sub-dispositions below and reassign them to another valid parent or promote them to top-level."}
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                This disposition currently has <strong>0 child dispositions</strong>. It is safe to delete or modify directly.
              </span>
            </div>
          )}

          {/* Child Dispositions Listing */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CornerDownRight className="h-3.5 w-3.5 text-slate-400" />
                Direct Child Sub-Dispositions ({children.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchChildren(disposition.id)}
                className="h-6 px-2 text-[11px] text-slate-500 hover:text-slate-900"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingChildren ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {loadingChildren ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1 text-indigo-600" />
                Loading child hierarchy...
              </div>
            ) : children.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No child sub-dispositions attached to this parent.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="p-2.5 px-3.5 flex items-center justify-between text-xs hover:bg-slate-50/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-400 font-mono text-[10px]">↳</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: child.color || "#64748b" }}
                      />
                      <span className="font-medium text-slate-800 truncate">{child.name}</span>
                      {child.code && (
                        <span className="text-[10px] text-slate-400 font-mono">({child.code})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {child._count?.children && child._count.children > 0 ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {child._count.children} sub-child
                        </Badge>
                      ) : null}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          child.isActive !== false
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {child.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action 1: Reassignment Workflow */}
          {hasChildren && (
            <div className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-lg space-y-3">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 text-indigo-600" />
                Option A: Reassign All Children to Another Parent
              </div>
              <p className="text-[11px] text-slate-500">
                Move all {children.length} child dispositions to another valid parent category or promote them to top-level.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="target-parent" className="text-[11px] text-slate-600">
                    Select New Destination Parent
                  </Label>
                  <select
                    id="target-parent"
                    value={selectedTargetParentId}
                    onChange={(e) => setSelectedTargetParentId(e.target.value)}
                    className="w-full h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">— Promote to Top-Level (No Parent) —</option>
                    {eligibleDestinationParents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {"—".repeat(p.depth ?? p.level ?? 0)} {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={handleReassignChildren}
                  disabled={reassigning}
                  size="sm"
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  {reassigning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GitBranch className="h-3.5 w-3.5" />
                  )}
                  Reassign Children
                </Button>
              </div>
            </div>
          )}

          {/* Action 2: Cascade Deactivation (when deactivating or managing) */}
          {hasChildren && actionType !== "delete" && (
            <div className="p-3.5 bg-slate-50/60 border border-slate-200 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <PowerOff className="h-3.5 w-3.5 text-amber-600" />
                Option B: Cascade Deactivation
              </div>
              <p className="text-[11px] text-slate-500">
                Deactivate &quot;{disposition.name}&quot; along with all {children.length} child sub-dispositions simultaneously.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCascadeDeactivate}
                disabled={cascadingDeactivate}
                className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5"
              >
                {cascadingDeactivate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PowerOff className="h-3.5 w-3.5" />
                )}
                Deactivate Parent &amp; All Children
              </Button>
            </div>
          )}

          {/* Action 3: Safe Parent Deletion */}
          {actionType === "delete" && (
            <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-lg space-y-2">
              <div className="text-xs font-semibold text-rose-900 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                Final Step: Delete Parent Disposition
              </div>
              <p className="text-[11px] text-rose-700">
                {hasChildren
                  ? "This button will unlock as soon as all child sub-dispositions are reassigned above."
                  : `Are you sure you want to delete "${disposition.name}"? If leads are already attached, it will be safely archived to preserve historical records.`}
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteEmptyParent}
                disabled={hasChildren || deletingParent}
                className="h-8 text-xs gap-1.5"
              >
                {deletingParent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {hasChildren ? "Blocked by Child Hierarchy" : "Confirm Delete Parent"}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
