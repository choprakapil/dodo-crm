"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Plus,
  Search,
  Lock,
  Edit2,
  Trash2,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { RoleBuilderDialog } from "./role-builder-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Permission {
  id: string;
  module: string;
  action: string;
  dataScope: "OWN" | "TEAM" | "COMPANY" | "PLATFORM";
}

interface RoleItem {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  companyId?: string | null;
  permissions: Permission[];
  _count?: {
    users: number;
  };
}

export function RoleWorkspace() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/roles");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to fetch roles");
      }
      setRoles(json.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleOpenCreate = () => {
    setSelectedRole(null);
    setBuilderOpen(true);
  };

  const handleOpenEdit = (role: RoleItem) => {
    setSelectedRole(role);
    setBuilderOpen(true);
  };

  const handleOpenDelete = (role: RoleItem) => {
    setRoleToDelete(role);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const res = await fetch(`/api/v1/roles/${roleToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to delete role");
      }
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
      fetchRoles();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete role");
    } finally {
      setDeleting(false);
    }
  };

  const filteredRoles = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Custom Role
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchRoles} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRoles.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No roles found matching your search.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map((role) => {
            const scopeSummary = role.permissions.reduce(
              (acc, p) => {
                acc[p.dataScope] = (acc[p.dataScope] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            );

            return (
              <Card key={role.id} className="flex flex-col justify-between border hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {role.name}
                        {role.isSystem && (
                          <Badge variant="secondary" className="gap-1 text-xs font-normal">
                            <Lock className="h-3 w-3" /> System
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {role.description || "No description provided."}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pb-4">
                  {/* User assignment stat */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      <strong>{role._count?.users || 0}</strong> assigned user
                      {(role._count?.users || 0) === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Permissions count & scopes */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">Permissions Granted</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {role.permissions.length} actions
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {scopeSummary["COMPANY"] ? (
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                          {scopeSummary["COMPANY"]} Company-wide
                        </Badge>
                      ) : null}
                      {scopeSummary["TEAM"] ? (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          {scopeSummary["TEAM"]} Team
                        </Badge>
                      ) : null}
                      {scopeSummary["OWN"] ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                          {scopeSummary["OWN"]} Own only
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="border-t pt-3 flex items-center justify-end gap-2">
                    {role.isSystem ? (
                      <span className="text-[11px] text-muted-foreground italic mr-auto">
                        System protected role
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(role)}
                          className="h-8 gap-1 text-xs"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(role)}
                          className="h-8 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Role Builder Modal */}
      <RoleBuilderDialog
        role={selectedRole}
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onSaved={fetchRoles}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Custom Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the role{" "}
              <strong className="text-foreground">{roleToDelete?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {roleToDelete?._count?.users && roleToDelete._count.users > 0 ? (
            <div className="p-3 bg-amber-500/10 text-amber-800 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This role currently has <strong>{roleToDelete._count.users}</strong> active user(s).
                You must reassign them to another role before deleting this role.
              </span>
            </div>
          ) : null}

          {deleteError && (
            <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={deleting || Boolean(roleToDelete?._count?.users && roleToDelete._count.users > 0)}
              className="gap-2"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
