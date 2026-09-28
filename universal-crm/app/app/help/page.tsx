import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading documentation...</div>}>
          <HelpCenterWorkspace
            userRole={authContext.role.name}
            hasAdminAccess={hasAdminAccess}
            hasManagerAccess={hasManagerAccess}
          />
        </Suspense>
      </main>
    </div>
  );
}
