import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { LeadNav } from "@/components/leads/lead-nav";
import { CreateEnquiryForm } from "@/components/leads/create-enquiry-form";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";

export const metadata = {
  title: "Create Enquiry | Universal CRM",
  description: "Create a commercial enquiry with customer resolution, product selection, and price control",
};

export default async function NewEnquiryPage() {
  const authContext = await getAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const config = await LeadService.getLeadConfig(authContext);

  // Serialize offerings to plain objects
  const offeringsSerialized = (config.offerings || []).map(
    (o: {
      id: string;
      name: string;
      type: "PRODUCT" | "SERVICE";
      code: string | null;
      defaultPrice: unknown;
      currency: string;
      allowSalesPriceOverride: boolean;
    }) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      code: o.code,
      defaultPrice: Number(o.defaultPrice),
      currency: o.currency,
      allowSalesPriceOverride: o.allowSalesPriceOverride,
    })
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <LeadNav
        companyName={authContext.company.name}
        companySlug={authContext.company.slug}
        userName={authContext.user.name}
        userEmail={authContext.user.email}
        roleName={authContext.role.name}
      />

      <main className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/app/leads"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Back to Leads"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-indigo-400" />
                <span>Create Enquiry</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Fast commercial enquiry creation with phone resolution, offering selection, and price governance.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          <CreateEnquiryForm
            statuses={config.statuses}
            sources={config.sources}
            users={config.users}
            teams={config.teams}
            offerings={offeringsSerialized}
            tenantAllowSalesPriceOverride={config.tenantAllowSalesPriceOverride}
          />
        </div>
      </main>
    </div>
  );
}
