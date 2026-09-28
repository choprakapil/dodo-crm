"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UserCheck,
  Building,
  Phone,
  Mail,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Star,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface CustomerData {
  id: string;
  name: string;
  displayName: string | null;
  companyName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  phones: Array<{
    id: string;
    rawPhone: string;
    normalizedPhone: string;
    type: string;
    isPrimary: boolean;
  }>;
  emails: Array<{
    id: string;
    email: string;
    type: string;
    isPrimary: boolean;
  }>;
}

interface EnquiryItem {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  amount: number | string | null;
  createdAt: string;
  status: { id: string; name: string; color: string } | null;
  source: { id: string; name: string } | null;
  assignedUser: { id: string; name: string; email: string } | null;
  team: { id: string; name: string } | null;
}

interface CustomerDetailProps {
  customerId: string;
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [enquiries, setEnquiries] = useState<EnquiryItem[]>([]);
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [enquiryPagination, setEnquiryPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  // Edit Customer Profile Dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Phone Dialog
  const [addPhoneOpen, setAddPhoneOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneType, setNewPhoneType] = useState<"MOBILE" | "WORK" | "HOME" | "WHATSAPP">("MOBILE");
  const [newPhonePrimary, setNewPhonePrimary] = useState(false);
  const [addingPhone, setAddingPhone] = useState(false);

  // Add Email Dialog
  const [addEmailOpen, setAddEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newEmailType, setNewEmailType] = useState<"WORK" | "PERSONAL">("WORK");
  const [newEmailPrimary, setNewEmailPrimary] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);

  // Delete Customer Confirmation Dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomer = useCallback(async (page = enquiryPage) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}?enquiryPage=${page}&enquiryLimit=10`);
      const data = await res.json();
      if (data.success) {
        setCustomer(data.data);
        setEnquiries(data.enquiries);
        setEnquiryPagination(data.enquiryPagination);
        // Sync edit fields
        setEditName(data.data.name);
        setEditDisplayName(data.data.displayName || "");
        setEditCompany(data.data.companyName || "");
        setEditNotes(data.data.notes || "");
      } else {
        toast.error(data.error?.message || "Customer not found");
      }
    } catch {
      toast.error("Network error while loading customer profile");
    } finally {
      setLoading(false);
    }
  }, [customerId, enquiryPage]);

  useEffect(() => {
    fetchCustomer(enquiryPage);
  }, [fetchCustomer, enquiryPage]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error("Customer name cannot be empty");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          displayName: editDisplayName.trim() || null,
          companyName: editCompany.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Customer profile updated successfully");
        setEditOpen(false);
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to update customer");
      }
    } catch {
      toast.error("Network error while updating customer profile");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAddPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setAddingPhone(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/phones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newPhone.trim(),
          type: newPhoneType,
          isPrimary: newPhonePrimary,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Phone added successfully");
        setAddPhoneOpen(false);
        setNewPhone("");
        setNewPhonePrimary(false);
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to add phone");
      }
    } catch {
      toast.error("Network error while adding phone");
    } finally {
      setAddingPhone(false);
    }
  }

  async function handleSetPrimaryPhone(phoneId: string) {
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/phones/${phoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Primary phone updated");
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to update primary phone");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function handleDeletePhone(phoneId: string) {
    if (!confirm("Are you sure you want to remove this phone number?")) return;

    try {
      const res = await fetch(`/api/v1/customers/${customerId}/phones/${phoneId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Phone removed successfully");
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to remove phone");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("Email address is required");
      return;
    }

    setAddingEmail(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          type: newEmailType,
          isPrimary: newEmailPrimary,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Email added successfully");
        setAddEmailOpen(false);
        setNewEmail("");
        setNewEmailPrimary(false);
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to add email");
      }
    } catch {
      toast.error("Network error while adding email");
    } finally {
      setAddingEmail(false);
    }
  }

  async function handleSetPrimaryEmail(emailId: string) {
    try {
      const res = await fetch(`/api/v1/customers/${customerId}/emails/${emailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Primary email updated");
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to update primary email");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function handleDeleteEmail(emailId: string) {
    if (!confirm("Are you sure you want to remove this email address?")) return;

    try {
      const res = await fetch(`/api/v1/customers/${customerId}/emails/${emailId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Email removed successfully");
        fetchCustomer(enquiryPage);
      } else {
        toast.error(data.error?.message || "Failed to remove email");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function handleDeleteCustomer() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/customers/${customerId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        toast.success(
          `Customer deleted. Preserved ${data.enquiriesPreserved || 0} historical enquiries.`
        );
        router.push("/app/customers");
      } else {
        toast.error(data.error?.message || "Failed to delete customer");
      }
    } catch {
      toast.error("Network error while deleting customer");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading && !customer) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Loading customer profile...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold text-white">Customer not found</h2>
        <Link
          href="/app/customers"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-400 mt-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/app/customers"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Link>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200"
          >
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
            Edit Profile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            className="border-rose-900/40 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5 text-rose-400" />
            Delete Customer
          </Button>
        </div>
      </div>

      {/* Main Grid: Left side identity & contacts, Right side enquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Identity & Contact Cards */}
        <div className="space-y-6 lg:col-span-1">
          {/* Identity Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 font-bold text-lg">
                {customer.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">
                  {customer.name}
                </h2>
                {customer.displayName && (
                  <p className="text-xs text-slate-400">({customer.displayName})</p>
                )}
                {customer.companyName && (
                  <p className="inline-flex items-center gap-1.5 text-xs text-indigo-300 mt-1 font-medium">
                    <Building className="h-3 w-3 text-indigo-400" />
                    {customer.companyName}
                  </p>
                )}
              </div>
            </div>

            {customer.notes && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Notes
                </span>
                <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                  {customer.notes}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              Customer since: {new Date(customer.createdAt).toLocaleDateString()}
            </div>
          </div>

          {/* Phone Numbers Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Phone className="h-4 w-4 text-indigo-400" />
                Phone Numbers ({customer.phones.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddPhoneOpen(true)}
                className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 px-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="divide-y divide-slate-800/60">
              {customer.phones.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-slate-200">
                        {p.normalizedPhone}
                      </span>
                      {p.isPrimary && (
                        <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800 text-[10px] px-1.5 py-0 h-4">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {p.type.toLowerCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {!p.isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimaryPhone(p.id)}
                        className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-amber-400 hover:bg-slate-900"
                        title="Set as primary phone"
                      >
                        <Star className="h-3 w-3" />
                      </Button>
                    )}
                    {customer.phones.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePhone(p.id)}
                        className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-slate-900"
                        title="Remove phone"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emails Card */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-400" />
                Email Addresses ({customer.emails.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAddEmailOpen(true)}
                className="h-7 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 px-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>

            <div className="divide-y divide-slate-800/60">
              {customer.emails.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 italic">No emails registered</p>
              ) : (
                customer.emails.map((e) => (
                  <div key={e.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-200 truncate">
                          {e.email}
                        </span>
                        {e.isPrimary && (
                          <Badge className="bg-indigo-950 text-indigo-300 border-indigo-800 text-[10px] px-1.5 py-0 h-4">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {e.type.toLowerCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {!e.isPrimary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetPrimaryEmail(e.id)}
                          className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-amber-400 hover:bg-slate-900"
                          title="Set as primary email"
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEmail(e.id)}
                        className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-slate-900"
                        title="Remove email"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Authorized Enquiries Workspace */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Authorized Enquiries</span>
                  <Badge className="bg-indigo-600/30 text-indigo-300 border-indigo-500/40 text-xs">
                    {enquiryPagination.total} Total
                  </Badge>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Filtered according to your RBAC and Data Scope assignment.
                </p>
              </div>

              <Link href={`/app/leads`}>
                <Button size="sm" variant="outline" className="border-slate-700 hover:bg-slate-800 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Enquiry
                </Button>
              </Link>
            </div>

            {enquiries.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                <p>No enquiries found under your authorized data scope for this customer.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Enquiry Title</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Assignee</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Value</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {enquiries.map((enq) => (
                      <tr key={enq.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          <Link
                            href={`/app/leads/${enq.id}`}
                            className="hover:text-indigo-400 transition-colors"
                          >
                            {enq.name}
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          {enq.status ? (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{
                                backgroundColor: `${enq.status.color}20`,
                                color: enq.status.color,
                              }}
                            >
                              {enq.status.name}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {enq.assignedUser?.name || <span className="text-slate-600">Unassigned</span>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-semibold ${
                              enq.priority === "URGENT"
                                ? "text-rose-400"
                                : enq.priority === "HIGH"
                                ? "text-amber-400"
                                : "text-slate-400"
                            }`}
                          >
                            {enq.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-200">
                          {enq.amount ? `$${Number(enq.amount).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {new Date(enq.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/app/leads/${enq.id}`}
                            className="text-indigo-400 hover:text-indigo-300"
                          >
                            <ExternalLink className="h-3.5 w-3.5 inline" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Enquiry Pagination */}
            {enquiryPagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs text-slate-400">
                <span>
                  Page {enquiryPagination.page} of {enquiryPagination.totalPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={enquiryPage <= 1}
                    onClick={() => setEnquiryPage((p) => p - 1)}
                    className="h-7 px-2 border-slate-800 bg-slate-900"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={enquiryPage >= enquiryPagination.totalPages}
                    onClick={() => setEnquiryPage((p) => p + 1)}
                    className="h-7 px-2 border-slate-800 bg-slate-900"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-indigo-400" />
              Edit Customer Profile
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateProfile} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-300">
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-300">Display Name</Label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-300">Organization</Label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300">Notes</Label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 text-white text-xs p-2.5"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Phone Modal */}
      <Dialog open={addPhoneOpen} onOpenChange={setAddPhoneOpen}>
        <DialogContent className="sm:max-w-sm bg-slate-950 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Phone className="h-4 w-4 text-indigo-400" />
              Add Phone Number
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddPhone} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-300">
                Phone Number <span className="text-rose-500">*</span>
              </Label>
              <Input
                required
                placeholder="e.g. +1 555-0199 or 9876543210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-700 text-white font-mono text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300">Type</Label>
              <select
                value={newPhoneType}
                onChange={(e) => setNewPhoneType(e.target.value as "MOBILE" | "WORK" | "HOME" | "WHATSAPP")}
                className="mt-1 w-full h-9 rounded-md bg-slate-900 border border-slate-700 text-white text-xs px-2"
              >
                <option value="MOBILE">Mobile</option>
                <option value="WORK">Work</option>
                <option value="HOME">Home</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPrimaryPhone"
                checked={newPhonePrimary}
                onChange={(e) => setNewPhonePrimary(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <Label htmlFor="isPrimaryPhone" className="text-xs text-slate-300 cursor-pointer">
                Set as primary phone number
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddPhoneOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingPhone}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {addingPhone ? "Adding..." : "Add Phone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Email Modal */}
      <Dialog open={addEmailOpen} onOpenChange={setAddEmailOpen}>
        <DialogContent className="sm:max-w-sm bg-slate-950 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-indigo-400" />
              Add Email Address
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddEmail} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-300">
                Email Address <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="email"
                required
                placeholder="e.g. john@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-700 text-white text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300">Type</Label>
              <select
                value={newEmailType}
                onChange={(e) => setNewEmailType(e.target.value as "WORK" | "PERSONAL")}
                className="mt-1 w-full h-9 rounded-md bg-slate-900 border border-slate-700 text-white text-xs px-2"
              >
                <option value="WORK">Work</option>
                <option value="PERSONAL">Personal</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPrimaryEmail"
                checked={newEmailPrimary}
                onChange={(e) => setNewEmailPrimary(e.target.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
              />
              <Label htmlFor="isPrimaryEmail" className="text-xs text-slate-300 cursor-pointer">
                Set as primary email address
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddEmailOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addingEmail}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {addingEmail ? "Adding..." : "Add Email"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Customer Confirmation Modal */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-rose-900/60 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Soft Delete Customer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-slate-300">
            <p>
              Are you sure you want to delete customer{" "}
              <strong className="text-white">{customer.name}</strong>?
            </p>
            <div className="p-3 bg-slate-900/80 rounded-md border border-slate-800 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Safety Guarantee:</p>
              <p>
                Deleting this customer identity will <strong>NOT</strong> delete any enquiries,
                activities, tasks, or audit logs. Historical business records will remain completely intact.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleDeleteCustomer}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {deleting ? "Deleting..." : "Confirm Soft Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
