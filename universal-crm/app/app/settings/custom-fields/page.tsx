import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { CustomFieldService } from "@/lib/services/custom-field.service";
import { SettingsNav } from "@/components/settings/settings-nav";
import { CustomFieldWorkspace } from "@/components/custom-fields/custom-field-workspace";

export const metadata = {
  title: "Custom Fields Settings — DODO CRM",
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
    <div className="flex-1 space-y-6 p-4 sm:p-8 max-w-7xl mx-auto">
      <SettingsNav />
      <CustomFieldWorkspace initialFields={fields} />
    </div>
  );
}
