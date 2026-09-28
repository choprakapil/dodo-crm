import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { DispositionsWorkspace } from "@/components/settings/dispositions-workspace";

export const metadata = {
  title: "Dispositions | Universal CRM",
  description: "Configure call outcomes, multi-level hierarchy, and automated follow-up lifecycle engine rules.",
};

export default async function DispositionsPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const canView =
    authContext.hasPermission("dispositions", "view") ||
    authContext.hasPermission("dispositions", "manage") ||
    authContext.hasPermission("settings", "manage") ||
    authContext.role.name === "Admin";

  if (!canView) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <SettingsNav />
        <DispositionsWorkspace />
      </main>
    </div>
  );
}
