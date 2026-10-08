import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Building2,
  User,
  Key,
  ShieldCheck,
  Plus,
  Kanban,
  Clock,
  UserCheck,
  Sparkles,
} from "lucide-react";

export default async function AppDashboardPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { user, company, role, permissions, session } = authContext;
  const expiresAtFormatted = new Date(session.expiresAt).toISOString();
  const onboardingState = await OnboardingService.getOnboardingState(authContext);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Onboarding Activation Banner if tenant not completed */}
      {!onboardingState.onboardingCompleted && onboardingState.canManage && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5 shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold text-slate-900">First-Time Workspace Onboarding</h2>
                <Badge variant="outline" className="text-[10px] border-indigo-200 bg-indigo-50 text-indigo-700 font-medium">
                  Setup Required
                </Badge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
                Configure your company identity, invite team members, and verify your product/service catalog.
              </p>
            </div>
          </div>
          <Link href="/app/onboarding" className="shrink-0">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3.5 h-8 shadow-2xs">
              Complete Setup Wizard &rarr;
            </Button>
          </Link>
        </div>
      )}

      {/* Executive Header with Restrained Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Reports &amp; Analytics Dashboard
            </h1>
            <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50 text-[10px] font-semibold">
              Live
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Operational performance, pipeline velocity, and conversion health for <span className="font-medium text-slate-700">{company.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/app/leads/new">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium h-8 shadow-2xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>New Lead</span>
            </Button>
          </Link>
          <Link href="/app/pipeline">
            <Button variant="outline" size="sm" className="border-slate-200 bg-white text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 h-8 shadow-2xs">
              <Kanban className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <span>Pipeline</span>
            </Button>
          </Link>
          <Link href="/app/follow-ups">
            <Button variant="outline" size="sm" className="border-slate-200 bg-white text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 h-8 shadow-2xs">
              <Clock className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <span>Follow-ups</span>
            </Button>
          </Link>
          <Link href="/app/customers">
            <Button variant="outline" size="sm" className="border-slate-200 bg-white text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 h-8 shadow-2xs">
              <UserCheck className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              <span>Customers</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Analytics Dashboard Interactive Client Workspace */}
      <AnalyticsDashboard currency={company.currency || "INR"} />

      {/* Multi-Tenant Security & Session Metadata */}
      <details className="mt-8 group border border-slate-200/90 rounded-xl bg-slate-50/60 overflow-hidden shadow-2xs">
        <summary className="px-4 py-3 cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-slate-800">Multi-Tenant Identity & Session Verification</span>
          </span>
          <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>

        <div className="p-4 pt-1 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-200/80 mt-1">
          <Card className="border-slate-200/90 bg-white shadow-2xs">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-slate-500" /> User Identity
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1 text-xs text-slate-600 font-mono">
              <div>ID: <span className="text-slate-900">{user.id}</span></div>
              <div>Name: <span className="text-slate-900">{user.name}</span></div>
              <div>Role: <span className="text-indigo-700 font-bold">{role.name}</span></div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 bg-white shadow-2xs">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-slate-500" /> Tenant Boundary
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1 text-xs text-slate-600 font-mono">
              <div>ID: <span className="text-slate-900">{company.id}</span></div>
              <div>Slug: <span className="text-slate-900">{company.slug}</span></div>
              <div>Currency: <span className="text-slate-900">{company.currency}</span></div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/90 bg-white shadow-2xs">
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-semibold text-slate-800 flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-slate-500" /> Session Security
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1 text-xs text-slate-600 font-mono">
              <div>Session: <span className="text-slate-900">{session.id}</span></div>
              <div>Expires: <span className="text-slate-900">{expiresAtFormatted.slice(0, 16)}</span></div>
              <div>Perms: <span className="text-slate-900">{permissions.length} modules</span></div>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}
