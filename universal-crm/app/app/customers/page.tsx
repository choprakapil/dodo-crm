import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { CustomerList } from "@/components/customers/customer-list";

export const metadata = {
  title: "Customers | Universal CRM",
  description: "Customer directory and relationship management",
};

export default async function CustomersPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        <CustomerList />
      </main>
    </div>
  );
}
