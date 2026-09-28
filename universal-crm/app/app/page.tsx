import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Building2, User, Key, ShieldCheck, HelpCircle, Sparkles } from "lucide-react";

export default async function AppDashboardPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { user, company, role, permissions, session } = authContext;
  const expiresAtFormatted = new Date(session.expiresAt).toISOString();
  const onboardingState = await OnboardingService.getOnboardingState(authContext);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Universal CRM Unified Top Navigation */}
      <LeadNav
        companyName={company.name}
        companySlug={company.slug}
        userName={user.name}
        userEmail={user.email}
        roleName={role.name}
      />

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Onboarding Activation Banner */}
        {!onboardingState.onboardingCompleted && onboardingState.canManage && (
          <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-950/60 to-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg shadow-indigo-950/30">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">First-Time Workspace Onboarding</h2>
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-mono">
                    Setup Required
                  </Badge>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  Welcome to your new tenant workspace. Complete the guided setup to verify your company identity, invite your team, and configure your product/service catalog.
                </p>
              </div>
            </div>
            <Link href="/app/onboarding" className="shrink-0">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 shadow">
                Complete Setup Wizard &rarr;
              </Button>
            </Link>
          </div>
        )}

        {/* Executive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Reports & Analytics Dashboard</span>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 text-xs font-mono">
                Realtime
              </Badge>
              <Link
                href="/app/help?article=dashboard"
                className="text-slate-500 hover:text-indigo-400 transition ml-1"
                title="Dashboard Help Guide"
              >
                <HelpCircle className="h-4 w-4" />
              </Link>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Comprehensive business intelligence, lead velocity, and operational performance for {company.name}.
            </p>
          </div>
        </div>

        {/* Analytics Dashboard Interactive Client Workspace */}
        <AnalyticsDashboard currency={company.currency || "USD"} />

        {/* Collapsible Authenticated Tenant Context Proof (Slice 2 Verification Parity) */}
        <details className="mt-8 group border border-slate-800/80 rounded-xl bg-slate-900/30 overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center justify-between select-none">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Multi-Tenant Identity & Session Verification</span>
            </span>
            <span className="text-[11px] text-slate-500 group-open:rotate-180 transition-transform">
              ▼
            </span>
          </summary>

          <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/60 mt-2">
            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-indigo-400" /> User Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-slate-400 font-mono">
                <div>ID: <span className="text-slate-200">{user.id}</span></div>
                <div>Name: <span className="text-slate-200">{user.name}</span></div>
                <div>Role: <span className="text-indigo-300 font-bold">{role.name}</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-violet-400" /> Tenant Boundary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-slate-400 font-mono">
                <div>ID: <span className="text-slate-200">{company.id}</span></div>
                <div>Slug: <span className="text-slate-200">{company.slug}</span></div>
                <div>Timezone: <span className="text-slate-200">{company.timezone}</span></div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-amber-400" /> Session Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-slate-400 font-mono">
                <div>Session: <span className="text-slate-200">{session.id}</span></div>
                <div>Expires: <span className="text-slate-200">{expiresAtFormatted.slice(0, 16)}</span></div>
                <div>Perms: <span className="text-slate-200">{permissions.length} modules</span></div>
              </CardContent>
            </Card>
          </div>
        </details>
      </main>
    </div>
  );
}
