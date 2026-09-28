import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { LeadImportWizard } from "@/components/leads/lead-import-wizard";

export const metadata = {
  title: "Import Leads — Universal CRM",
};

export default async function LeadImportPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  if (!authContext.hasPermission("leads", "create")) {
    redirect("/app/leads");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        <LeadImportWizard />
      </main>
    </div>
  );
}
