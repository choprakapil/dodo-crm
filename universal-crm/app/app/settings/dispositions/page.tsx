import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { DispositionsWorkspace } from "@/components/settings/dispositions-workspace";

export const metadata = {
  title: "Dispositions | DODO CRM",
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
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      <SettingsNav />
      <DispositionsWorkspace />
    </div>
  );
}
