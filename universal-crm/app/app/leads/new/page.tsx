import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { LeadService } from "@/lib/services/lead.service";
import { CreateEnquiryForm } from "@/components/leads/create-enquiry-form";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";

export const metadata = {
  title: "Create Enquiry | DODO CRM",
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/app/leads"
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-xs"
            title="Back to Leads"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-indigo-600" />
              <span>Create Enquiry</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Fast commercial enquiry creation with phone resolution, offering selection, and price governance.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <CreateEnquiryForm
          statuses={config.statuses}
          sources={config.sources}
          users={config.users}
          teams={config.teams}
          offerings={offeringsSerialized}
          tenantAllowSalesPriceOverride={config.tenantAllowSalesPriceOverride}
        />
      </div>
    </div>
  );
}

