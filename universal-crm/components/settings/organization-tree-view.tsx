"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building,
  Network,
  Building2,
  Users,
  ChevronDown,
  ChevronRight,
  Plus,
  Edit,
  Trash2,
  Crown,
  Loader2,
  RefreshCw,
  FolderTree,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateDivisionDialog } from "@/components/settings/create-division-dialog";
import { EditDivisionDialog, DivisionItem } from "@/components/settings/edit-division-dialog";
import { CreateDepartmentDialog } from "@/components/settings/create-department-dialog";
import { EditDepartmentDialog, DepartmentItem } from "@/components/settings/edit-department-dialog";
import { CreateTeamDialog } from "@/components/settings/create-team-dialog";
import { EditTeamDialog } from "@/components/settings/edit-team-dialog";

interface TreeMember {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface TreeTeam {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  manager: { id: string; name: string; email: string } | null;
  memberCount: number;
  leadCount: number;
  members: TreeMember[];
}

interface TreeDepartment {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  manager: { id: string; name: string; email: string } | null;
  teams: TreeTeam[];
}

interface TreeDivision {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  manager: { id: string; name: string; email: string } | null;
  departments: TreeDepartment[];
}

interface TreeStats {
  divisionCount: number;
  departmentCount: number;
  teamCount: number;
  assignedTeamCount: number;
  unassignedTeamCount: number;
}

interface TreeData {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  stats: TreeStats;
  divisions: TreeDivision[];
  unassignedTeams: TreeTeam[];
}

interface OrganizationTreeViewProps {
  canManage: boolean;
}

export function OrganizationTreeView({ canManage }: OrganizationTreeViewProps) {
  const [data, setData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded nodes state
  const [expandedDivisions, setExpandedDivisions] = useState<Record<string, boolean>>({});
  const [expandedDepartments, setExpandedDepartments] = useState<Record<string, boolean>>({});
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  // Dialog states
  const [createDivOpen, setCreateDivOpen] = useState(false);
  const [editDiv, setEditDiv] = useState<DivisionItem | null>(null);

  const [createDeptOpen, setCreateDeptOpen] = useState(false);
  const [createDeptDefaultDivId, setCreateDeptDefaultDivId] = useState<string | undefined>();
  const [editDept, setEditDept] = useState<DepartmentItem | null>(null);

  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTeamDefaultDeptId, setCreateTeamDefaultDeptId] = useState<string | undefined>();
  const [editTeam, setEditTeam] = useState<TreeTeam | null>(null);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/organization/tree");
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error?.message || "Failed to load organizational hierarchy");
      }
      setData(result.data);

      // Default all divisions to expanded on initial load
      const divExp: Record<string, boolean> = {};
      const deptExp: Record<string, boolean> = {};
      result.data.divisions.forEach((div: TreeDivision) => {
        divExp[div.id] = true;
        div.departments.forEach((dept: TreeDepartment) => {
          deptExp[dept.id] = true;
        });
      });
      setExpandedDivisions((prev) => (Object.keys(prev).length === 0 ? divExp : prev));
      setExpandedDepartments((prev) => (Object.keys(prev).length === 0 ? deptExp : prev));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleDivision = (id: string) => {
    setExpandedDivisions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDepartment = (id: string) => {
    setExpandedDepartments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTeam = (id: string) => {
    setExpandedTeams((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    if (!data) return;
    const divExp: Record<string, boolean> = {};
    const deptExp: Record<string, boolean> = {};
    const teamExp: Record<string, boolean> = {};
    data.divisions.forEach((d) => {
      divExp[d.id] = true;
      d.departments.forEach((dept) => {
        deptExp[dept.id] = true;
        dept.teams.forEach((t) => {
          teamExp[t.id] = true;
        });
      });
    });
    data.unassignedTeams.forEach((t) => {
      teamExp[t.id] = true;
    });
    setExpandedDivisions(divExp);
    setExpandedDepartments(deptExp);
    setExpandedTeams(teamExp);
  };

  const collapseAll = () => {
    setExpandedDivisions({});
    setExpandedDepartments({});
    setExpandedTeams({});
  };

  const handleDeleteDivision = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete division "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/divisions/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error?.message || "Failed to delete division");
      }
      fetchTree();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteDepartment = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete department "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/departments/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error?.message || "Failed to delete department");
      }
      fetchTree();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteTeam = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete team "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/teams/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error?.message || "Failed to delete team");
      }
      fetchTree();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "An error occurred");
    }
  };

  if (loading && !data) {
    return (
      <div className="p-16 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center space-y-3 shadow-2xs">
        <Loader2 className="h-7 w-7 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading organizational structure...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs shadow-2xs flex items-center justify-between">
        <span>{error}</span>
        <Button onClick={fetchTree} variant="outline" size="sm" className="text-xs h-8">
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center space-x-2 text-indigo-600">
            <Network className="h-4 w-4" />
            <span className="text-xs font-semibold text-slate-700">Divisions</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{data.stats.divisionCount}</span>
            <span className="text-[11px] text-slate-400">Business Units</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center space-x-2 text-emerald-600">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-semibold text-slate-700">Departments</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{data.stats.departmentCount}</span>
            <span className="text-[11px] text-slate-400">Functional Areas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center space-x-2 text-amber-600">
            <Users className="h-4 w-4" />
            <span className="text-xs font-semibold text-slate-700">Teams</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900">{data.stats.teamCount}</span>
            <span className="text-[11px] text-slate-400">
              {data.stats.assignedTeamCount} in tree, {data.stats.unassignedTeamCount} unassigned
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Hierarchy Actions</span>
            <Button
              onClick={fetchTree}
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
              title="Refresh"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="flex items-center space-x-1.5 pt-1">
            <Button
              onClick={expandAll}
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 text-slate-600 hover:bg-slate-50 flex-1"
            >
              Expand All
            </Button>
            <Button
              onClick={collapseAll}
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 text-slate-600 hover:bg-slate-50 flex-1"
            >
              Collapse
            </Button>
          </div>
        </div>
      </div>

      {/* Main Hierarchy Tree */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
        {/* Company Root Header */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-2xs">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900">{data.company.name}</span>
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] py-0">
                  Organization Root
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500">Tenant identifier: {data.company.slug}</p>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setCreateDivOpen(true)}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 px-3 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Division
              </Button>
              <Button
                onClick={() => {
                  setCreateDeptDefaultDivId(undefined);
                  setCreateDeptOpen(true);
                }}
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-700 hover:bg-white text-xs h-8 px-3"
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                Add Department
              </Button>
            </div>
          )}
        </div>

        {/* Tree Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {data.divisions.length === 0 ? (
            <div className="p-10 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center text-slate-500 text-xs">
              <FolderTree className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-slate-700">No divisions established yet</p>
              <p className="text-slate-400 mt-0.5">
                Create a division to start structuring your organizational hierarchy.
              </p>
              {canManage && (
                <Button
                  onClick={() => setCreateDivOpen(true)}
                  size="sm"
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Create First Division
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.divisions.map((div) => {
                const isExpanded = expandedDivisions[div.id] ?? false;

                return (
                  <div
                    key={div.id}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:border-slate-300 transition"
                  >
                    {/* Division Header */}
                    <div className="p-3.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between gap-2">
                      <div
                        onClick={() => toggleDivision(div.id)}
                        className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                      >
                        <button className="text-slate-400 hover:text-slate-700 p-0.5">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <div className="p-1.5 rounded-md bg-indigo-100/70 text-indigo-700">
                          <Network className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {div.name}
                            </span>
                            {div.code && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 text-slate-500 font-mono">
                                {div.code}
                              </Badge>
                            )}
                            {!div.isActive && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 text-rose-600 bg-rose-50 border-rose-200">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          {div.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{div.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {div.manager && (
                          <div className="hidden sm:flex items-center space-x-1 text-[11px] text-slate-600 bg-white border border-slate-200 rounded-md px-2 py-0.5">
                            <Crown className="h-3 w-3 text-amber-500" />
                            <span className="font-medium">{div.manager.name}</span>
                          </div>
                        )}
                        <Badge variant="outline" className="border-indigo-100 bg-indigo-50 text-indigo-700 text-[10px]">
                          {div.departments.length} {div.departments.length === 1 ? "dept" : "depts"}
                        </Badge>

                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60">
                              <Edit className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 bg-white border-slate-200 text-xs shadow-lg">
                              <DropdownMenuItem
                                onClick={() => {
                                  setCreateDeptDefaultDivId(div.id);
                                  setCreateDeptOpen(true);
                                }}
                                className="cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                Add Department
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setEditDiv(div)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5 mr-2 text-indigo-600" />
                                Edit Division
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteDivision(div.id, div.name)}
                                className="cursor-pointer text-rose-600 focus:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Delete Division
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {/* Departments inside Division */}
                    {isExpanded && (
                      <div className="p-3 sm:p-4 bg-slate-50/20 space-y-3">
                        {div.departments.length === 0 ? (
                          <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-white text-center text-[11px] text-slate-500">
                            <span>No departments in this division.</span>
                            {canManage && (
                              <button
                                onClick={() => {
                                  setCreateDeptDefaultDivId(div.id);
                                  setCreateDeptOpen(true);
                                }}
                                className="ml-2 font-semibold text-indigo-600 hover:text-indigo-700 underline"
                              >
                                + Add Department
                              </button>
                            )}
                          </div>
                        ) : (
                          div.departments.map((dept) => {
                            const isDeptExpanded = expandedDepartments[dept.id] ?? false;

                            return (
                              <div
                                key={dept.id}
                                className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs"
                              >
                                {/* Department Header */}
                                <div className="p-3 bg-emerald-50/30 border-b border-slate-100 flex items-center justify-between gap-2">
                                  <div
                                    onClick={() => toggleDepartment(dept.id)}
                                    className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
                                  >
                                    <button className="text-slate-400 hover:text-slate-700 p-0.5">
                                      {isDeptExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                    <div className="p-1.5 rounded-md bg-emerald-100/70 text-emerald-700">
                                      <Building2 className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="truncate">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-semibold text-slate-900 truncate">
                                          {dept.name}
                                        </span>
                                        {dept.code && (
                                          <Badge variant="outline" className="text-[9px] py-0 px-1 text-slate-500 font-mono">
                                            {dept.code}
                                          </Badge>
                                        )}
                                        {!dept.isActive && (
                                          <Badge variant="outline" className="text-[9px] py-0 px-1 text-rose-600 bg-rose-50 border-rose-200">
                                            Inactive
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2 flex-shrink-0">
                                    {dept.manager && (
                                      <div className="hidden sm:flex items-center space-x-1 text-[10px] text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                                        <Crown className="h-3 w-3 text-amber-500" />
                                        <span>{dept.manager.name}</span>
                                      </div>
                                    )}
                                    <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700 text-[10px]">
                                      {dept.teams.length} {dept.teams.length === 1 ? "team" : "teams"}
                                    </Badge>

                                    {canManage && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger className="h-6 w-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                          <Edit className="h-3 w-3" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44 bg-white border-slate-200 text-xs shadow-lg">
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setCreateTeamDefaultDeptId(dept.id);
                                              setCreateTeamOpen(true);
                                            }}
                                            className="cursor-pointer"
                                          >
                                            <Plus className="h-3.5 w-3.5 mr-2 text-indigo-600" />
                                            Add Team to Dept
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              setEditDept({
                                                ...dept,
                                                divisionId: div.id,
                                                divisionName: div.name,
                                              })
                                            }
                                            className="cursor-pointer"
                                          >
                                            <Edit className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                                            Edit Department
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => handleDeleteDepartment(dept.id, dept.name)}
                                            className="cursor-pointer text-rose-600 focus:text-rose-600"
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Delete Department
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                  </div>
                                </div>

                                {/* Teams inside Department */}
                                {isDeptExpanded && (
                                  <div className="p-3 bg-white space-y-2">
                                    {dept.teams.length === 0 ? (
                                      <div className="p-3 rounded border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
                                        <span>No teams assigned to this department.</span>
                                        {canManage && (
                                          <button
                                            onClick={() => {
                                              setCreateTeamDefaultDeptId(dept.id);
                                              setCreateTeamOpen(true);
                                            }}
                                            className="ml-2 font-medium text-emerald-600 hover:underline"
                                          >
                                            + Assign/Create Team
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      dept.teams.map((team) => {
                                        const isTeamExpanded = expandedTeams[team.id] ?? false;

                                        return (
                                          <div
                                            key={team.id}
                                            className="rounded-md border border-slate-100 bg-slate-50/40 p-2.5 hover:bg-slate-50 transition"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div
                                                onClick={() => toggleTeam(team.id)}
                                                className="flex items-center space-x-2 cursor-pointer flex-1 min-w-0"
                                              >
                                                <button className="text-slate-400 hover:text-slate-700 p-0.5">
                                                  {isTeamExpanded ? (
                                                    <ChevronDown className="h-3 w-3" />
                                                  ) : (
                                                    <ChevronRight className="h-3 w-3" />
                                                  )}
                                                </button>
                                                <Users className="h-3.5 w-3.5 text-indigo-600" />
                                                <Link
                                                  href={`/app/settings/teams/${team.id}`}
                                                  className="text-xs font-medium text-slate-900 hover:text-indigo-600 truncate"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  {team.name}
                                                </Link>
                                              </div>

                                              <div className="flex items-center space-x-2 flex-shrink-0 text-[11px]">
                                                {team.manager && (
                                                  <span className="text-slate-500 hidden sm:inline">
                                                    Lead: <span className="text-slate-800 font-medium">{team.manager.name}</span>
                                                  </span>
                                                )}
                                                <Badge variant="outline" className="text-[9px] py-0 px-1 bg-white">
                                                  {team.memberCount} members
                                                </Badge>
                                                <Badge variant="outline" className="text-[9px] py-0 px-1 bg-white text-slate-500">
                                                  {team.leadCount} leads
                                                </Badge>

                                                <Link
                                                  href={`/app/settings/teams/${team.id}`}
                                                  className="text-slate-400 hover:text-indigo-600"
                                                  title="Open Team Roster"
                                                >
                                                  <ExternalLink className="h-3 w-3" />
                                                </Link>

                                                {canManage && (
                                                  <DropdownMenu>
                                                    <DropdownMenuTrigger className="h-5 w-5 inline-flex items-center justify-center text-slate-400 hover:text-slate-700">
                                                      <Edit className="h-3 w-3" />
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-36 bg-white border-slate-200 text-xs shadow-lg">
                                                      <DropdownMenuItem
                                                        onClick={() => setEditTeam(team)}
                                                        className="cursor-pointer"
                                                      >
                                                        <Edit className="h-3.5 w-3.5 mr-2 text-indigo-600" />
                                                        Edit Team
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem
                                                        onClick={() => handleDeleteTeam(team.id, team.name)}
                                                        className="cursor-pointer text-rose-600 focus:text-rose-600"
                                                      >
                                                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                                                        Delete Team
                                                      </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                  </DropdownMenu>
                                                )}
                                              </div>
                                            </div>

                                            {/* Team Members Roster */}
                                            {isTeamExpanded && (
                                              <div className="mt-2.5 pt-2 border-t border-slate-200/60 pl-6 space-y-1">
                                                {team.members.length === 0 ? (
                                                  <p className="text-[11px] text-slate-400 italic">
                                                    No members currently assigned to this team.
                                                  </p>
                                                ) : (
                                                  <div className="flex flex-wrap gap-1.5">
                                                    {team.members.map((m) => (
                                                      <span
                                                        key={m.id}
                                                        className="inline-flex items-center text-[10px] bg-white border border-slate-200 text-slate-700 rounded px-2 py-0.5"
                                                      >
                                                        {m.name}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Unassigned Teams Section (Backward Compatibility) */}
          {data.unassignedTeams.length > 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-800 text-xs">
                    {data.unassignedTeams.length} Standalone / Unassigned Teams
                  </Badge>
                  <span className="text-xs text-slate-500">
                    (Teams not yet assigned to a department)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {data.unassignedTeams.map((team) => (
                  <div
                    key={team.id}
                    className="p-3 rounded-lg border border-slate-200 bg-white flex flex-col justify-between space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/app/settings/teams/${team.id}`}
                        className="text-xs font-semibold text-slate-900 hover:text-indigo-600"
                      >
                        {team.name}
                      </Link>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 text-slate-500">
                        {team.memberCount} members
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Lead: {team.manager ? team.manager.name : "None"}</span>
                      {canManage && (
                        <button
                          onClick={() => setEditTeam(team)}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          Assign Dept →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog Modals */}
      <CreateDivisionDialog
        open={createDivOpen}
        onOpenChange={setCreateDivOpen}
        onDivisionCreated={fetchTree}
      />

      <EditDivisionDialog
        division={editDiv}
        open={Boolean(editDiv)}
        onOpenChange={(open) => !open && setEditDiv(null)}
        onDivisionUpdated={fetchTree}
      />

      <CreateDepartmentDialog
        open={createDeptOpen}
        defaultDivisionId={createDeptDefaultDivId}
        onOpenChange={setCreateDeptOpen}
        onDepartmentCreated={fetchTree}
      />

      <EditDepartmentDialog
        department={editDept}
        open={Boolean(editDept)}
        onOpenChange={(open) => !open && setEditDept(null)}
        onDepartmentUpdated={fetchTree}
      />

      <CreateTeamDialog
        open={createTeamOpen}
        defaultDepartmentId={createTeamDefaultDeptId}
        onOpenChange={setCreateTeamOpen}
        onTeamCreated={fetchTree}
      />

      <EditTeamDialog
        team={editTeam}
        open={Boolean(editTeam)}
        onOpenChange={(open) => !open && setEditTeam(null)}
        onTeamUpdated={fetchTree}
      />
    </div>
  );
}
