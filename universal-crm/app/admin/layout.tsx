import { headers } from "next/headers";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";

export const metadata = {
  title: "Platform Console — DODO CRM",
  description: "Super Admin Platform Operations & Multi-Tenant Management",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") || "";
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
  }

  return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
