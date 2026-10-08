import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadImportWizard } from "@/components/leads/lead-import-wizard";

export const metadata = {
  title: "Import Leads — DODO CRM",
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
    <div className="max-w-7xl mx-auto space-y-6">
      <LeadImportWizard />
    </div>
  );
}

