"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  Mail,
  Building,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";

interface CustomerItem {
  id: string;
  name: string;
  displayName: string | null;
  companyName: string | null;
  notes: string | null;
  createdAt: string;
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
  _count: {
    enquiries: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function CustomerList() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPhoneType, setNewPhoneType] = useState<"MOBILE" | "WORK" | "HOME" | "WHATSAPP">("MOBILE");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const fetchCustomers = useCallback(
    async (pageToFetch = 1, searchQuery = search) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: pageToFetch.toString(),
          limit: "20",
        });
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        const res = await fetch(`/api/v1/customers?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setCustomers(data.data);
          setPagination(data.pagination);
        } else {
          toast.error(data.error?.message || "Failed to load customers");
        }
      } catch {
        toast.error("Network error while loading customers");
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    fetchCustomers(1, search);
  }, [fetchCustomers, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Name and primary phone number are required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/v1/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          displayName: newDisplayName.trim() || undefined,
          companyName: newCompany.trim() || undefined,
          phone: newPhone.trim(),
          phoneType: newPhoneType,
          email: newEmail.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Customer ${data.data.name} created successfully`);
        setCreateOpen(false);
        // Reset form
        setNewName("");
        setNewDisplayName("");
        setNewCompany("");
        setNewPhone("");
        setNewEmail("");
        setNewNotes("");
        fetchCustomers(1, search);
      } else {
        toast.error(data.error?.message || "Failed to create customer");
      }
    } catch {
      toast.error("Network error while creating customer");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <UserCheck className="h-6 w-6 text-indigo-400" />
            Customers
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage long-term customer relationships and identity profiles.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search by customer name, phone number, email, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-950/80 border-slate-800 text-slate-200 placeholder:text-slate-500 focus-visible:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
            <p className="text-sm">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Inbox className="h-10 w-10 text-slate-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No customers found</h3>
            <p className="text-sm text-slate-500 max-w-sm mt-1 mb-5">
              {search
                ? `No customers match "${search}". Try searching by phone or name.`
                : "No customers exist in your organization yet."}
            </p>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(true)}
              className="border-slate-700 hover:bg-slate-800 text-slate-200"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create First Customer
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Organization</th>
                  <th className="py-3.5 px-4">Primary Contact</th>
                  <th className="py-3.5 px-4 text-center">Enquiries</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {customers.map((c) => {
                  const primaryPhone = c.phones.find((p) => p.isPrimary) || c.phones[0];
                  const primaryEmail = c.emails.find((e) => e.isPrimary) || c.emails[0];

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-900/40 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-medium text-white">
                        <Link
                          href={`/app/customers/${c.id}`}
                          className="hover:text-indigo-400 transition-colors flex flex-col"
                        >
                          <span className="font-semibold">{c.name}</span>
                          {c.displayName && (
                            <span className="text-xs text-slate-400 font-normal">
                              {c.displayName}
                            </span>
                          )}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4 text-slate-300">
                        {c.companyName ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                            <Building className="h-3.5 w-3.5 text-slate-500" />
                            {c.companyName}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          {primaryPhone && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-200">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {primaryPhone.normalizedPhone}
                            </span>
                          )}
                          {primaryEmail && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                              <Mail className="h-3 w-3 text-slate-500" />
                              {primaryEmail.email}
                            </span>
                          )}
                          {!primaryPhone && !primaryEmail && (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant="secondary"
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs px-2 py-0.5"
                        >
                          {c._count.enquiries} {c._count.enquiries === 1 ? "enquiry" : "enquiries"}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/app/customers/${c.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors p-1"
                        >
                          View Profile
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 bg-slate-900/40 text-xs text-slate-400">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-300">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-300">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-semibold text-slate-300">{pagination.total}</span>{" "}
              customers
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchCustomers(pagination.page - 1, search)}
                className="h-7 w-7 p-0 border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchCustomers(pagination.page + 1, search)}
                className="h-7 w-7 p-0 border-slate-800 bg-slate-950 hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-400" />
              Add Customer
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-300">
                Full Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                required
                placeholder="e.g. John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-300">Display Name</Label>
                <Input
                  placeholder="e.g. JD"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-300">Organization / Company</Label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="mt-1 bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
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
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300">Email Address</Label>
              <Input
                type="email"
                placeholder="e.g. john@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1 bg-slate-900 border-slate-700 text-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-300">Notes</Label>
              <textarea
                rows={2}
                placeholder="Customer relationship notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 text-white text-sm p-2"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="border-slate-700 hover:bg-slate-800 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Customer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
