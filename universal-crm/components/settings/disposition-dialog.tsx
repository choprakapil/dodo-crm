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
import { AlertCircle, Loader2 } from "lucide-react";

export interface DispositionData {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  description: string | null;
  color: string | null;
  sortOrder: number;
  depth: number;
  path: string | null;
  isTerminal: boolean;
  requiresFollowUp: boolean;
  followUpMandatory: boolean;
  allowsClose: boolean;
  allowsConvert: boolean;
  cancelActiveFollowUp: boolean;
  isActive: boolean;
}

interface DispositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disposition: DispositionData | null;
  allDispositions: DispositionData[];
  onSaved: () => void;
}

export function DispositionDialog({
  open,
  onOpenChange,
  disposition,
  allDispositions,
  onSaved,
}: DispositionDialogProps) {
  const isEditing = !!disposition;

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [parentId, setParentId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<number>(0);

  const [isTerminal, setIsTerminal] = useState(false);
  const [requiresFollowUp, setRequiresFollowUp] = useState(false);
  const [followUpMandatory, setFollowUpMandatory] = useState(false);
  const [cancelActiveFollowUp, setCancelActiveFollowUp] = useState(false);
  const [allowsClose, setAllowsClose] = useState(true);
  const [allowsConvert, setAllowsConvert] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (disposition) {
      setName(disposition.name);
      setCode(disposition.code || "");
      setDescription(disposition.description || "");
      setColor(disposition.color || "#6366f1");
      setParentId(disposition.parentId || "");
      setSortOrder(disposition.sortOrder);
      setIsTerminal(disposition.isTerminal);
      setRequiresFollowUp(disposition.requiresFollowUp);
      setFollowUpMandatory(disposition.followUpMandatory);
      setCancelActiveFollowUp(disposition.cancelActiveFollowUp);
      setAllowsClose(disposition.allowsClose);
      setAllowsConvert(disposition.allowsConvert);
      setIsActive(disposition.isActive);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setColor("#6366f1");
      setParentId("");
      setSortOrder(0);
      setIsTerminal(false);
      setRequiresFollowUp(false);
      setFollowUpMandatory(false);
      setCancelActiveFollowUp(false);
      setAllowsClose(true);
      setAllowsConvert(false);
      setIsActive(true);
    }
    setError(null);
  }, [disposition, open]);

  // Exclude current disposition and its descendants from parent selection to prevent cycles
  const eligibleParents = allDispositions.filter((d) => {
    if (!disposition) return true;
    if (d.id === disposition.id) return false;
    const currentPath = disposition.path || `/${disposition.id}`;
    const dPath = d.path || `/${d.id}`;
    if (dPath.startsWith(`${currentPath}/`)) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Disposition name is required");
      return;
    }

    if (cancelActiveFollowUp && followUpMandatory) {
      setError("Contradictory rules: Cannot mandate follow-up and cancel follow-ups simultaneously.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        color: color.trim() || null,
        parentId: parentId || null,
        sortOrder: Number(sortOrder) || 0,
        isTerminal,
        requiresFollowUp,
        followUpMandatory,
        cancelActiveFollowUp,
        allowsClose,
        allowsConvert,
        isActive,
      };

      const url = isEditing
        ? `/api/v1/dispositions/${disposition.id}`
        : "/api/v1/dispositions";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save disposition");
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Disposition: ${disposition.name}` : "Create New Disposition"}
          </DialogTitle>
          <DialogDescription>
            Configure call outcome categories, arbitrary depth hierarchy, and automated follow-up lifecycle rules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {error && (
            <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="disp-name">Name *</Label>
              <Input
                id="disp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Connected — Call Back Requested"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disp-code">Code / Identifier (optional)</Label>
              <Input
                id="disp-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. CALL_BACK"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="disp-parent">Parent Disposition (Hierarchy)</Label>
              <select
                id="disp-parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— None (Top-Level Category) —</option>
                {eligibleParents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {"—".repeat(p.depth)} {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="disp-order">Sort Order</Label>
              <Input
                id="disp-order"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="disp-desc">Description</Label>
            <textarea
              id="disp-desc"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Guidance for sales reps on when to select this disposition..."
              rows={2}
              className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="disp-color">Color Tag</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="disp-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 p-1 border rounded cursor-pointer bg-transparent"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#6366f1"
                className="w-32 font-mono text-sm"
              />
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Generic Operational Rules
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={followUpMandatory}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setFollowUpMandatory(val);
                    if (val) {
                      setRequiresFollowUp(true);
                      setCancelActiveFollowUp(false);
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-sm">Follow-up Mandatory</div>
                  <div className="text-xs text-muted-foreground">
                    Agent cannot log this outcome without scheduling a next date/time.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelActiveFollowUp}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setCancelActiveFollowUp(val);
                    if (val) {
                      setFollowUpMandatory(false);
                    }
                  }}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-sm">Cancel Active Follow-ups</div>
                  <div className="text-xs text-muted-foreground">
                    Automatically cancels all active follow-up tasks for this lead.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresFollowUp}
                  onChange={(e) => setRequiresFollowUp(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-sm">Suggest Follow-up</div>
                  <div className="text-xs text-muted-foreground">
                    Pre-checks follow-up scheduler in modal, but not strictly mandatory.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTerminal}
                  onChange={(e) => setIsTerminal(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-sm">Terminal Disposition</div>
                  <div className="text-xs text-muted-foreground">
                    Marks lead communication as finalized.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowsClose}
                  onChange={(e) => setAllowsClose(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-sm">Allows Lead Closing</div>
                  <div className="text-xs text-muted-foreground">
                    Permits lead to be transitioned to closed/won/lost statuses.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-medium text-sm">Active</div>
                  <div className="text-xs text-muted-foreground">
                    Visible and selectable in call outcome forms.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Disposition"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
