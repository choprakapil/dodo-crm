import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { CustomerDetail } from "@/components/customers/customer-detail";

export const metadata = {
  title: "Customer Profile | Dodo CRM",
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <CustomerDetail customerId={id} />
    </div>
  );
}
