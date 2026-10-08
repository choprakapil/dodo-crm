"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  Layers,
  Shield,
  Sliders,
  Package,
  Wrench,
  GitBranch,
  Activity,
  Settings,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  KeyRound,
  ShieldAlert,
  LogOut,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PLATFORM_FEATURE_CATALOG } from "@/lib/services/platform-feature.service";

interface CompanyDetails {
  company: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED";
    email: string | null;
    phone: string | null;
    website: string | null;
    timezone: string;
    currency: string;
    dateFormat: string;
    createdAt: string;
    updatedAt: string;
  };
  plan: {
    id: string;
    name: string;
    code: string;
    maxUsers: number;
    maxLeads: number;
    features: Record<string, boolean>;
  } | null;
  quota: {
    users: { current: number; max: number; percentage: number; isExceeded: boolean };
    leads: { current: number; max: number; percentage: number; isExceeded: boolean };
  };
  statistics: {
    users: number;
    teams: number;
    leads: number;
    activities: number;
    followUps: number;
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    metadata: any;
    superAdmin: { email: string; name: string } | null;
    createdAt: string;
    ipAddress?: string;
  }>;
}

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = use(params as any) as { id: string };
  const companyId = resolvedParams.id;
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "teams" | "features" | "limits" | "products" | "services" | "dispositions" | "activity" | "settings"
  >("overview");

  const [details, setDetails] = useState<CompanyDetails | null>(null);
  const [limitsReport, setLimitsReport] = useState<any | null>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [offeringsList, setOfferingsList] = useState<any[]>([]);
  const [dispositionsList, setDispositionsList] = useState<any[]>([]);
  const [featuresData, setFeaturesData] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals / Actions
  const [isSuspending, setIsSuspending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Reset Admin Password Modal
  const [showResetAdminModal, setShowResetAdminModal] = useState(false);
  const [adminTemporaryPassword, setAdminTemporaryPassword] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Change Plan Modal
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string>("STARTER");

  // Load Company Core Data
  const loadDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resDetails, resLimits, resUsers, resOfferings, resDispositions, resFeatures] = await Promise.all([
        fetch(`/api/v1/admin/companies/${companyId}`),
        fetch(`/api/v1/admin/limits?companyId=${companyId}`),
        fetch(`/api/v1/admin/users?companyId=${companyId}`),
        fetch(`/api/v1/admin/crm-config/offerings?companyId=${companyId}`),
        fetch(`/api/v1/admin/crm-config/dispositions?companyId=${companyId}`),
        fetch(`/api/v1/admin/features?companyId=${companyId}`),
      ]);

      const jsonDetails = await resDetails.json();
      if (jsonDetails.success) {
        setDetails(jsonDetails.data);
      } else {
        throw new Error(jsonDetails.error?.message || "Failed to load company details.");
      }

      const jsonLimits = await resLimits.json();
      if (jsonLimits.success) setLimitsReport(jsonLimits.data);

      const jsonUsers = await resUsers.json();
      if (jsonUsers.success) setUsersList(jsonUsers.items || []);

      const jsonOfferings = await resOfferings.json();
      if (jsonOfferings.success) setOfferingsList(jsonOfferings.data || []);

      const jsonDispositions = await resDispositions.json();
      if (jsonDispositions.success) setDispositionsList(jsonDispositions.data || []);

      const jsonFeatures = await resFeatures.json();
      if (jsonFeatures.success) setFeaturesData(jsonFeatures.data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to platform API.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [companyId]);

  // Suspend / Reactivate Action
  const toggleSuspension = async () => {
    if (!details) return;
    setIsSuspending(true);
    const isCurrentlyActive = details.company.status === "ACTIVE";
    const endpoint = isCurrentlyActive
      ? `/api/v1/admin/companies/${companyId}/suspend`
      : `/api/v1/admin/companies/${companyId}/reactivate`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: isCurrentlyActive ? "Suspended by Super Admin operator" : undefined }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isCurrentlyActive ? "Organization suspended and active sessions purged." : "Organization reactivated.");
        loadDetails();
      } else {
        toast.error(json.error?.message || "Action failed.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsSuspending(false);
    }
  };

  // Reset Admin Password
  const handleResetAdminPassword = async () => {
    setIsResettingPassword(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${companyId}/reset-password`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setAdminTemporaryPassword(json.data.temporaryPassword);
        toast.success("Administrator password successfully reset.");
      } else {
        toast.error(json.error?.message || "Failed to reset password.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Revoke All Organization Sessions
  const handleRevokeAllSessions = async () => {
    try {
      const res = await fetch(`/api/v1/admin/companies/${companyId}/revoke-sessions`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Revoked all ${json.data?.revokedCount || 0} active sessions.`);
        loadDetails();
      } else {
        toast.error(json.error?.message || "Failed to revoke sessions.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Change Plan
  const handleChangePlan = async () => {
    try {
      const res = await fetch(`/api/v1/admin/companies/${companyId}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planTier: selectedNewPlan }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Subscription plan updated to ${selectedNewPlan}.`);
        setShowChangePlanModal(false);
        loadDetails();
      } else {
        toast.error(json.error?.message || "Failed to update plan.");
      }
    } catch {
      toast.error("Network error.");
    }
  };

  // Delete Organization
  const handleDeleteCompany = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm.');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/companies/${companyId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmSlug: details?.company.slug }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Organization successfully purged.");
        router.push("/admin/companies");
      } else {
        toast.error(json.error?.message || "Failed to delete organization.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !details) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="text-xs text-slate-500 font-medium">Loading organization cockpit...</span>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="p-8 rounded-2xl border border-rose-200 bg-rose-50 text-center space-y-4 max-w-lg mx-auto mt-12">
        <AlertCircle className="h-8 w-8 text-rose-600 mx-auto" />
        <h2 className="text-base font-bold text-rose-900">Unable to load organization</h2>
        <p className="text-xs text-rose-700">{error || "Organization does not exist."}</p>
        <Link href="/admin/companies">
          <Button variant="outline" className="text-xs">
            Back to Organizations
          </Button>
        </Link>
      </div>
    );
  }

  const { company, plan, quota, statistics, recentAuditLogs } = details;

  return (
    <div className="space-y-6">
      {/* Cockpit Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-xl shadow-2xs">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {company.name}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  company.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200"
                }`}
              >
                {company.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                {plan?.name || "Starter"} Plan
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
              <span>Slug: /{company.slug}</span>
              <span>•</span>
              <span>Currency: {company.currency}</span>
              <span>•</span>
              <span>Timezone: {company.timezone}</span>
            </div>
          </div>
        </div>

        {/* Quick Management Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDetails}
            className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChangePlanModal(true)}
            className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <Layers className="h-3.5 w-3.5 mr-1" /> Change Plan
          </Button>

          <Button
            variant={company.status === "ACTIVE" ? "outline" : "default"}
            size="sm"
            disabled={isSuspending}
            onClick={toggleSuspension}
            className={`h-8 text-xs font-semibold ${
              company.status === "ACTIVE"
                ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {company.status === "ACTIVE" ? "Suspend Account" : "Reactivate Account"}
          </Button>
        </div>
      </div>

      {/* 10-Tab Navigation Bar */}
      <div className="flex border-b border-slate-200 overflow-x-auto space-x-1 bg-white p-1 rounded-xl border shadow-2xs">
        {[
          { id: "overview", label: "Overview", icon: Building2 },
          { id: "users", label: `Users (${statistics.users})`, icon: Users },
          { id: "teams", label: `Teams (${statistics.teams})`, icon: Users },
          { id: "features", label: "Features", icon: Sliders },
          { id: "limits", label: "Limits & Quotas", icon: Shield },
          { id: "products", label: `Products (${offeringsList.filter((o) => o.type === "PRODUCT").length})`, icon: Package },
          { id: "services", label: `Services (${offeringsList.filter((o) => o.type === "SERVICE").length})`, icon: Wrench },
          { id: "dispositions", label: `Dispositions (${dispositionsList.length})`, icon: GitBranch },
          { id: "activity", label: "Audit Logs", icon: Activity },
          { id: "settings", label: "Settings & Security", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition shrink-0 ${
                isActive
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-slate-200 bg-white md:col-span-2 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Organization Profile & Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Company ID</span>
                  <span className="font-mono text-slate-800 font-semibold">{company.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Slug URL</span>
                  <span className="font-mono text-indigo-600 font-semibold">/{company.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Contact Email</span>
                  <span className="text-slate-800 font-medium">{company.email || "Not configured"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Phone Number</span>
                  <span className="text-slate-800 font-medium">{company.phone || "Not configured"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Created Date</span>
                  <span className="text-slate-800 font-medium">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-mono">Last Updated</span>
                  <span className="text-slate-800 font-medium">
                    {new Date(company.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Real-time Usage Gauges */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-slate-800">Primary Capacity Gauges</span>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">Active User Seats</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {quota.users.current} / {quota.users.max} ({quota.users.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          quota.users.percentage >= 90
                            ? "bg-rose-500"
                            : quota.users.percentage >= 80
                            ? "bg-amber-500"
                            : "bg-indigo-600"
                        }`}
                        style={{ width: `${Math.min(100, quota.users.percentage)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">Lead Pipeline Capacity</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {quota.leads.current} / {quota.leads.max} ({quota.leads.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          quota.leads.percentage >= 90
                            ? "bg-rose-500"
                            : quota.leads.percentage >= 80
                            ? "bg-amber-500"
                            : "bg-indigo-600"
                        }`}
                        style={{ width: `${Math.min(100, quota.leads.percentage)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Side Telemetry Card */}
          <Card className="border border-slate-200 bg-white shadow-sm space-y-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-900">
                Tenant Entity Counts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              {[
                { label: "Active Users", count: statistics.users },
                { label: "Organizational Teams", count: statistics.teams },
                { label: "Leads in Pipeline", count: statistics.leads },
                { label: "Logged Activities", count: statistics.activities },
                { label: "Follow-up Tasks", count: statistics.followUps },
              ].map((stat) => (
                <div key={stat.label} className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">{stat.label}:</span>
                  <span className="font-mono font-bold text-slate-900">{stat.count.toLocaleString()}</span>
                </div>
              ))}

              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowResetAdminModal(true)}
                  className="w-full text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset Admin Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: Users */}
      {activeTab === "users" && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Organization User Directory ({usersList.length})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                All tenant users, status, roles, and session controls.
              </CardDescription>
            </div>
            <Link href="/admin/users">
              <Button size="sm" variant="outline" className="text-xs">
                Manage in Global Directory
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {u.role?.name || "User"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          u.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : u.status === "DISABLED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Features */}
      {activeTab === "features" && featuresData && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Effective Feature Toggles
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Features enabled by the {plan?.name || "Starter"} plan and any organization-specific overrides.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PLATFORM_FEATURE_CATALOG.map((feat) => {
                const isEffective = Boolean(featuresData.effective[feat.key]);
                const isOverridden = featuresData.overrides[feat.key] !== undefined;

                return (
                  <div
                    key={feat.key}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${
                      isEffective
                        ? "border-indigo-200 bg-indigo-50/40"
                        : "border-slate-200 bg-white opacity-60"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">{feat.name}</span>
                        {isOverridden && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">
                            Override
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        isEffective
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {isEffective ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: Limits */}
      {activeTab === "limits" && limitsReport && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Platform Capacity & Limit Telemetry
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Configured entity limits, current consumption, and threshold indicators.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Limit Definition</th>
                  <th className="px-4 py-2.5">Plan Default</th>
                  <th className="px-4 py-2.5">Effective Limit</th>
                  <th className="px-4 py-2.5">Current Usage</th>
                  <th className="px-4 py-2.5">Capacity Bar</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {limitsReport.limits.map((l: any) => (
                  <tr key={l.key} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900">{l.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {l.planDefault.toLocaleString()} {l.unit}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {l.effective.toLocaleString()} {l.unit}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-900 font-semibold">
                      {l.current.toLocaleString()} {l.unit}
                    </td>
                    <td className="px-4 py-3 w-48">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            l.percentage >= 90
                              ? "bg-rose-500"
                              : l.percentage >= 80
                              ? "bg-amber-500"
                              : "bg-indigo-600"
                          }`}
                          style={{ width: `${Math.min(100, l.percentage)}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.status === "EXCEEDED"
                            ? "bg-rose-100 text-rose-800"
                            : l.status === "CRITICAL_90"
                            ? "bg-rose-50 text-rose-700"
                            : l.status === "WARNING_80"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 6 & 7: Products & Services */}
      {(activeTab === "products" || activeTab === "services") && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">
              {activeTab === "products" ? "Product Catalog" : "Service Offerings"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">SKU</th>
                  <th className="px-4 py-2.5">Base Price</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offeringsList
                  .filter((o) => o.type === (activeTab === "products" ? "PRODUCT" : "SERVICE"))
                  .map((off) => (
                    <tr key={off.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">{off.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{off.sku || "—"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {off.currency} {off.basePrice.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 uppercase">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 8: Dispositions */}
      {activeTab === "dispositions" && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Hierarchical Call Dispositions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Outcome Name</th>
                  <th className="px-4 py-2.5">Level</th>
                  <th className="px-4 py-2.5">Follow-up Mandatory</th>
                  <th className="px-4 py-2.5">Allows Close</th>
                  <th className="px-4 py-2.5">Allows Convert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispositionsList.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">Level {d.level}</td>
                    <td className="px-4 py-3">
                      {d.followUpMandatory ? (
                        <span className="text-amber-700 font-semibold">Yes (Mandatory)</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{d.allowsClose ? "✓ Yes" : "—"}</td>
                    <td className="px-4 py-3">{d.allowsConvert ? "✓ Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* TAB 9: Activity */}
      {activeTab === "activity" && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">
              Platform Audit Events
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Append-only ledger of Super Admin and platform operations targeting this organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs">
                <Activity className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{log.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Actor: {log.superAdmin?.email || "System"} • IP: {log.ipAddress || "Internal"}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* TAB 10: Settings & Danger Zone */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Organization Security Card */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">
                Security & Session Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                <div>
                  <span className="font-semibold text-slate-900 block">Revoke All Active Sessions</span>
                  <span className="text-slate-500 text-[11px]">
                    Force sign-out on all logged-in devices across this organization.
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleRevokeAllSessions} className="text-xs">
                  <LogOut className="h-3.5 w-3.5 mr-1" /> Force Revoke Sessions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border border-rose-200 bg-rose-50/40 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-rose-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                Danger Zone: Destructive Tenant Operations
              </CardTitle>
              <CardDescription className="text-xs text-rose-700">
                Permanently removing an organization will cascade delete all tenant users, leads, customers, and data.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                className="text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Organization
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset Administrator Password</h3>
            <p className="text-xs text-slate-500">
              This will generate a new temporary password for the tenant Company Admin and invalidate all active sessions.
            </p>

            {adminTemporaryPassword ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <span className="text-xs font-bold text-amber-900 block">New Temporary Password:</span>
                <span className="font-mono font-bold text-indigo-700 text-sm bg-white px-3 py-1.5 rounded border block">
                  {adminTemporaryPassword}
                </span>
                <span className="text-[10px] text-amber-700">Please provide this to the customer securely.</span>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowResetAdminModal(false);
                  setAdminTemporaryPassword(null);
                }}
                className="text-xs"
              >
                Close
              </Button>
              {!adminTemporaryPassword && (
                <Button
                  size="sm"
                  disabled={isResettingPassword}
                  onClick={handleResetAdminPassword}
                  className="bg-indigo-600 text-white text-xs font-semibold"
                >
                  {isResettingPassword ? "Resetting..." : "Confirm Reset"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showChangePlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Change Subscription Plan</h3>
            <p className="text-xs text-slate-500">
              Select the new tier for {company.name}. Quota limits will automatically update.
            </p>

            <select
              value={selectedNewPlan}
              onChange={(e) => setSelectedNewPlan(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold"
            >
              <option value="FREE">Free Tier (2 Seats, 250 Leads)</option>
              <option value="STARTER">Starter Tier (5 Seats, 1,000 Leads)</option>
              <option value="PROFESSIONAL">Professional Tier (25 Seats, 5,000 Leads)</option>
              <option value="ENTERPRISE">Enterprise Tier (100 Seats, 25,000 Leads)</option>
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChangePlanModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleChangePlan}
                className="bg-indigo-600 text-white text-xs font-semibold"
              >
                Apply Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-rose-200 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" /> Delete Organization
            </h3>
            <p className="text-xs text-slate-600">
              This action is permanent and cannot be undone. To confirm, type{" "}
              <strong className="font-mono text-rose-700">DELETE</strong> below:
            </p>

            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="h-9 text-xs font-mono"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteConfirmText !== "DELETE" || isDeleting}
                onClick={handleDeleteCompany}
                className="text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700"
              >
                {isDeleting ? "Purging..." : "Confirm Purge"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
