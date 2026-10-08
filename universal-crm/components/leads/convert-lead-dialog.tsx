"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Phone,
  Building,
} from "lucide-react";
import Link from "next/link";

import { convertLeadToCustomer } from "@/lib/actions/lead-conversion";

interface ConvertLeadDialogProps {
  leadId: string;
  leadName: string;
  phone: string | null;
  company: string | null;
  disposition: {
    id: string;
    name: string;
    allowsConvert: boolean;
  } | null;
  isAlreadyConverted?: boolean;
  existingCustomerId?: string | null;
}

export function ConvertLeadDialog({
  leadId,
  leadName,
  phone,
  company,
  disposition,
  isAlreadyConverted = false,
  existingCustomerId = null,
}: ConvertLeadDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedCustomerId, setConvertedCustomerId] = useState<string | null>(
    existingCustomerId
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isBlockedByDisposition = disposition && !disposition.allowsConvert;
  const isBlockedByMissingPhone = !phone || !phone.trim();

  async function handleConvert() {
    if (isBlockedByDisposition) {
      setError(
        `Conversion is blocked: Current disposition "${disposition?.name}" does not permit conversion. Update the disposition to an approved outcome first.`
      );
      return;
    }

    if (isBlockedByMissingPhone) {
      setError("Conversion requires a valid phone number on the lead.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await convertLeadToCustomer(leadId);

      if (!res.success || !res.data) {
        throw new Error(res.error || res.message || "Failed to convert lead to customer");
      }

      setConvertedCustomerId(res.data.customerId);
      setSuccessMessage(
        res.data.isNewCustomer
          ? `Created new Customer "${res.data.customerName}" successfully!`
          : `Linked to existing Customer "${res.data.customerName}" successfully!`
      );
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (isAlreadyConverted && existingCustomerId) {
    return (
      <Link href={`/app/customers/${existingCustomerId}`}>
        <Button
          size="sm"
          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold shadow-sm"
        >
          <UserCheck className="h-3.5 w-3.5 mr-1.5" />
          <span>View Customer Profile</span>
        </Button>
      </Link>
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setOpen(true);
          setError(null);
          setSuccessMessage(null);
        }}
        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm"
      >
        <UserCheck className="h-3.5 w-3.5 mr-1.5" />
        <span>Convert to Customer</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <UserCheck className="h-4 w-4" />
              </div>
              <span>Convert Lead to Customer</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Establish a long-term customer relationship. All lead history, activities, and contact records will be preserved.
            </DialogDescription>
          </DialogHeader>

          {/* Success State */}
          {successMessage && convertedCustomerId ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold">{successMessage}</span>
                  <p className="text-[11px] text-emerald-700">
                    Lead status has transitioned to Converted and phone identity has been normalized.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="border-slate-200 text-xs text-slate-700 hover:text-slate-900 bg-white"
                >
                  Close
                </Button>
                <Link href={`/app/customers/${convertedCustomerId}`}>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                  >
                    <span>Open Customer Profile</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              {/* Lead Summary */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{leadName}</span>
                  {disposition ? (
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        disposition.allowsConvert
                          ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                          : "border-amber-200 text-amber-700 bg-amber-50"
                      }`}
                    >
                      Disposition: {disposition.name}
                    </Badge>
                  ) : (
                    <span className="text-[11px] text-slate-400">No disposition</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-slate-500 text-[11px]">
                  {phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span>{phone}</span>
                    </span>
                  )}
                  {company && (
                    <span className="flex items-center gap-1">
                      <Building className="h-3 w-3 text-slate-400" />
                      <span>{company}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Disposition Gatekeeping Warning */}
              {isBlockedByDisposition && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Disposition Gatekeeping Active</span>
                    <span className="text-[11px] text-amber-700">
                      The current disposition &quot;{disposition.name}&quot; does not allow conversion. You must log an approved conversion disposition before proceeding.
                    </span>
                  </div>
                </div>
              )}

              {/* Missing Phone Warning */}
              {isBlockedByMissingPhone && (
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Missing Phone Number</span>
                    <span className="text-[11px] text-rose-700">
                      Customer identity resolution requires a primary phone number. Please edit this lead and add a phone number first.
                    </span>
                  </div>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Rule Summary */}
              <div className="space-y-1.5 text-slate-600 text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-800 block">Conversion Guarantees:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-500">
                  <li>Resolves existing customer by normalized E.164 phone to avoid duplicates.</li>
                  <li>Links this lead as a commercial enquiry under the customer profile.</li>
                  <li>Transitions lead stage to Converted and records audit logs.</li>
                </ul>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 bg-white"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={loading || Boolean(isBlockedByDisposition) || Boolean(isBlockedByMissingPhone)}
                  onClick={handleConvert}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                >
                  {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Confirm Conversion
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
