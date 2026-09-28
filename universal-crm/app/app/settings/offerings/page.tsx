import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { OfferingsWorkspace } from "@/components/settings/offerings-workspace";

export const metadata = {
  title: "Products & Services | Universal CRM",
  description: "Configure product and service offerings, base pricing, and price override rules.",
};

export default async function OfferingsPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const canView =
    authContext.hasPermission("offerings", "view") ||
    authContext.hasPermission("offerings", "manage") ||
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
        <OfferingsWorkspace />
      </main>
    </div>
  );
}
