import React from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { WorkspaceShell } from "@/components/navigation/workspace-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { user, company, role } = authContext;

  return (
    <WorkspaceShell
      companyName={company.name}
      companySlug={company.slug}
      userName={user.name}
      userEmail={user.email}
      roleName={role.name}
    >
      {children}
    </WorkspaceShell>
  );
}
