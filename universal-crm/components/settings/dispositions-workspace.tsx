"use client";

import { useState, useEffect, useCallback } from "react";
import {
  PhoneCall,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  GitFork,
  Clock,
  Ban,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DispositionDialog, DispositionData } from "./disposition-dialog";

export function DispositionsWorkspace() {
  const [dispositions, setDispositions] = useState<DispositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<DispositionData | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  const fetchDispositions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/dispositions?flat=true&includeInactive=true");
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to load dispositions");
      }

      setDispositions(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDispositions();
  }, [fetchDispositions]);

  const handleCreate = () => {
    setSelectedDisposition(null);
    setDialogOpen(true);
  };

  const handleEdit = (disp: DispositionData) => {
    setSelectedDisposition(disp);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete disposition "${name}"?`)) {
      return;
    }

    setActionInProgressId(id);
    try {
      const res = await fetch(`/api/v1/dispositions/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to delete disposition");
      }

      await fetchDispositions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setActionInProgressId(null);
    }
  };

  const filteredDispositions = dispositions.filter((d) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(term) ||
      (d.code && d.code.toLowerCase().includes(term)) ||
      (d.description && d.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-primary" />
            Disposition Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure call outcomes, multi-level hierarchy, and automated follow-up lifecycle engine rules.
          </p>
        </div>
        <Button onClick={handleCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          Add Disposition
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search dispositions by name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Main List */}
      {error && (
        <div className="flex items-center gap-2 p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Loading dispositions...</p>
        </div>
      ) : filteredDispositions.length === 0 ? (
        <div className="text-center p-12 bg-card rounded-lg border">
          <GitFork className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-lg">No Dispositions Found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Get started by creating your first call outcome category.
          </p>
          <Button onClick={handleCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Create Disposition
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-lg border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Disposition Hierarchy</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Operational Rules</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDispositions.map((disp) => {
                  return (
                    <tr key={disp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${disp.depth * 24}px` }}
                        >
                          {disp.depth > 0 && (
                            <span className="text-muted-foreground font-mono text-xs">↳</span>
                          )}
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: disp.color || "#6366f1" }}
                          />
                          <div>
                            <div className="font-medium text-foreground flex items-center gap-2">
                              {disp.name}
                              {disp.depth > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Level {disp.depth}
                                </Badge>
                              )}
                            </div>
                            {disp.description && (
                              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {disp.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {disp.code || "—"}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {disp.followUpMandatory && (
                            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                              <Clock className="h-3 w-3" /> Mandatory Follow-Up
                            </Badge>
                          )}
                          {disp.cancelActiveFollowUp && (
                            <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px] gap-1">
                              <Ban className="h-3 w-3" /> Cancels Follow-Ups
                            </Badge>
                          )}
                          {disp.requiresFollowUp && !disp.followUpMandatory && (
                            <Badge variant="outline" className="text-[10px]">
                              Suggests Follow-Up
                            </Badge>
                          )}
                          {disp.isTerminal && (
                            <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-[10px]">
                              Terminal
                            </Badge>
                          )}
                          {!disp.allowsClose && (
                            <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[10px]">
                              Blocks Close
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {disp.isActive ? (
                          <span className="inline-flex items-center text-xs font-medium text-emerald-600 gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-muted-foreground gap-1">
                            <XCircle className="h-3.5 w-3.5" />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(disp)}
                            className="h-8 w-8 p-0"
                            title="Edit Disposition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(disp.id, disp.name)}
                            disabled={actionInProgressId === disp.id}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete Disposition"
                          >
                            {actionInProgressId === disp.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog */}
      <DispositionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        disposition={selectedDisposition}
        allDispositions={dispositions}
        onSaved={fetchDispositions}
      />
    </div>
  );
}
