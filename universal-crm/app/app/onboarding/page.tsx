/**
 * Tenant Onboarding Page
 *
 * Route: /app/onboarding
 * First-time company setup and activation wizard for administrators.
 */

import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { OnboardingService } from "@/lib/services/onboarding.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { user, company, role } = authContext;

  // Retrieve current onboarding state
  const state = await OnboardingService.getOnboardingState(authContext);

  // If user is not authorized to manage company setup, redirect to workspace
  if (!state.canManage) {
    redirect("/app");
  }

  // If company has already completed onboarding, redirect to workspace
  if (state.onboardingCompleted) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Universal CRM Navigation */}
      <LeadNav
        companyName={company.name}
        companySlug={company.slug}
        userName={user.name}
        userEmail={user.email}
        roleName={role.name}
      />

      <main className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <OnboardingWizard initialState={state} />
      </main>
    </div>
  );
}
