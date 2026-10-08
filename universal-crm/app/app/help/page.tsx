import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { HelpCenterWorkspace } from "@/components/help/help-center-workspace";
import { Suspense } from "react";

export default async function HelpPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const roleName = authContext.role.name.toLowerCase();
  const hasAdminAccess =
    roleName === "admin" ||
    authContext.permissions.some(
      (p) => p.module === "settings" && (p.action === "manage" || p.action === "view")
    );

  const hasManagerAccess =
    hasAdminAccess ||
    roleName === "manager" ||
    authContext.permissions.some((p) => p.module === "teams" && p.action === "view");

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading documentation...</div>}>
        <HelpCenterWorkspace
          userRole={authContext.role.name}
          hasAdminAccess={hasAdminAccess}
          hasManagerAccess={hasManagerAccess}
        />
      </Suspense>
    </div>
  );
}

