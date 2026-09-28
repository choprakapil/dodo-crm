import { headers } from "next/headers";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata = {
  title: "Platform Console — Universal CRM",
  description: "Super Admin Platform Operations & Tenant Management",
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
    return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <AdminNav />
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
