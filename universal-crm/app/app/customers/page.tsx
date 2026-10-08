import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { CustomerList } from "@/components/customers/customer-list";

export const metadata = {
  title: "Customers | Dodo CRM",
  description: "Customer directory and relationship management",
};

export default async function CustomersPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <CustomerList />
    </div>
  );
}
