import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { CustomFieldWorkspace } from "@/components/custom-fields/custom-field-workspace";

export const metadata = {
  title: "Custom Fields Settings — Universal CRM",
};

export default async function CustomFieldsSettingsPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  // Check permission
  if (
    !authContext.hasPermission("custom_fields", "view") &&
    !authContext.hasPermission("settings", "view")
  ) {
    redirect("/app");
  }

  const fields = await CustomFieldService.listCustomFields(authContext, "LEAD", true);

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
        <CustomFieldWorkspace initialFields={fields} />
      </main>
    </div>
  );
}
