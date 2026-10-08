import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { SettingsNav } from "@/components/settings/settings-nav";
import { OfferingsWorkspace } from "@/components/settings/offerings-workspace";

export const metadata = {
  title: "Products & Services | DODO CRM",
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
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      <SettingsNav />
      <OfferingsWorkspace />
    </div>
  );
}
