import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadNav } from "@/components/leads/lead-nav";
import { CustomerDetail } from "@/components/customers/customer-detail";

export const metadata = {
  title: "Customer Profile | Universal CRM",
  description: "Customer profile, contact information, and authorized enquiry history",
};

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const { id } = await params;

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
        <CustomerDetail customerId={id} />
      </main>
    </div>
  );
}
