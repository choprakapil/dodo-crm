"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  MessageSquare,
  Download,
  Trash2,
} from "lucide-react";
import { getTelUrl, getWhatsAppUrl, getMailtoUrl } from "@/lib/utils/contact-actions";
import {
  useBulkSelection,
  BulkCheckbox,
  BulkActionToolbar,
  BulkAction,
} from "@/components/bulk";

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

  const {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  } = useBulkSelection<CustomerItem>({
    items: customers,
    getItemId: (c) => c.id,
  });

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
    const timer = setTimeout(() => {
      fetchCustomers(1, search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, fetchCustomers]);

  const bulkActions: BulkAction<CustomerItem>[] = useMemo(() => [
    {
      id: "export",
      label: "Export CSV",
      icon: Download,
      variant: "outline",
      onExecute: async (ids) => {
        const selected = customers.filter((c) => ids.includes(c.id));
        const csvRows = [
          ["ID", "Name", "Display Name", "Organization", "Primary Phone", "Primary Email", "Enquiries Count", "Created At"].join(","),
          ...selected.map((c) => {
            const pPhone = c.phones.find((p) => p.isPrimary) || c.phones[0];
            const pEmail = c.emails.find((e) => e.isPrimary) || c.emails[0];
            return [
              `"${c.id}"`,
              `"${c.name.replace(/"/g, '""')}"`,
              `"${(c.displayName || "").replace(/"/g, '""')}"`,
              `"${(c.companyName || "").replace(/"/g, '""')}"`,
              `"${pPhone ? pPhone.normalizedPhone || pPhone.rawPhone : ""}"`,
              `"${pEmail ? pEmail.email : ""}"`,
              `"${c._count?.enquiries || 0}"`,
              `"${c.createdAt}"`,
            ].join(",");
          }),
        ];

        const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `customers_export_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return {
          success: true,
          total: ids.length,
          succeededCount: ids.length,
          failedCount: 0,
        };
      },
    },
    {
      id: "delete",
      label: `Delete (${selectedCount})`,
      icon: Trash2,
      variant: "destructive",
      destructive: true,
      requiresConfirmation: true,
      confirmType: "typed_delete",
      confirmTitle: "Delete Selected Customers",
      confirmDescription: "Selected customers will be safely soft-deleted. Associated lead histories and notes will be preserved.",
      onExecute: async (ids) => {
        const res = await fetch("/api/v1/customers/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "DELETE",
            customerIds: ids,
          }),
        });
        const data = await res.json();
        fetchCustomers(pagination.page, search);
        return data;
      },
    },
  ], [customers, selectedCount, pagination.page, search, fetchCustomers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Name and Phone number are required");
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
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
              Customers
            </h1>
            <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-100 text-xs font-mono">
              {pagination.total} accounts
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified customer relationships, contact points, and conversion histories.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium h-8 shadow-xs self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Customer
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200/90 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search by name, phone, email, or organization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-slate-50/60 border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 h-8 focus-visible:ring-1 focus-visible:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-lg border border-slate-200/90 bg-white overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
            <p className="text-xs">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Inbox className="h-8 w-8 text-slate-300 mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">No customers found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              {search
                ? `No customers match "${search}". Try searching by phone or name.`
                : "No customer accounts exist yet."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Customer
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200/90 bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-10 py-2.5 px-4">
                      <BulkCheckbox
                        checked={isAllSelected}
                        indeterminate={isSomeSelected}
                        onChange={toggleSelectAll}
                        aria-label="Select all visible customers"
                      />
                    </th>
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Organization</th>
                    <th className="py-2.5 px-4">Primary Contact</th>
                    <th className="py-2.5 px-4 text-center">Enquiries</th>
                    <th className="py-2.5 px-4">Created</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {customers.map((c) => {
                    const primaryPhone = c.phones.find((p) => p.isPrimary) || c.phones[0];
                    const primaryEmail = c.emails.find((e) => e.isPrimary) || c.emails[0];
                    const initials = c.name
                      ? c.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                      : "C";
                    const isSelected = selectedIds.has(c.id);

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50/70 transition-colors group ${
                          isSelected ? "bg-indigo-50/40" : ""
                        }`}
                      >
                        <td className="w-10 py-2.5 px-4">
                          <BulkCheckbox
                            checked={isSelected}
                            onChange={() => toggleSelect(c.id)}
                            aria-label={`Select ${c.name}`}
                          />
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <div className="flex items-center gap-2.5">
                            <div className="h-6 w-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-semibold text-indigo-700 shrink-0">
                              {initials}
                            </div>
                            <Link
                              href={`/app/customers/${c.id}`}
                              className="hover:text-indigo-600 transition-colors flex flex-col min-w-0"
                            >
                              <span className="font-medium truncate">{c.name}</span>
                              {c.displayName && (
                                <span className="text-[11px] text-slate-500 font-normal truncate">
                                  {c.displayName}
                                </span>
                              )}
                            </Link>
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-slate-600">
                          {c.companyName ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              <Building className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate max-w-[140px]">{c.companyName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4">
                          <div className="flex flex-col gap-1">
                            {primaryPhone && (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-800">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  {primaryPhone.normalizedPhone}
                                </span>
                                {getTelUrl(primaryPhone.normalizedPhone || primaryPhone.rawPhone) && (
                                  <a
                                    href={getTelUrl(primaryPhone.normalizedPhone || primaryPhone.rawPhone)!}
                                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium transition"
                                  >
                                    Call
                                  </a>
                                )}
                                {getWhatsAppUrl(primaryPhone.normalizedPhone || primaryPhone.rawPhone) && (
                                  <a
                                    href={getWhatsAppUrl(primaryPhone.normalizedPhone || primaryPhone.rawPhone)!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-green-600 hover:text-green-700 font-medium transition"
                                  >
                                    WA
                                  </a>
                                )}
                              </div>
                            )}
                            {primaryEmail && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                                  {primaryEmail.email}
                                </span>
                              </div>
                            )}
                            {!primaryPhone && !primaryEmail && (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-700 border border-slate-200/80 font-mono text-[10px] px-2 py-0.5"
                          >
                            {c._count.enquiries} {c._count.enquiries === 1 ? "enquiry" : "enquiries"}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-4 text-[11px] text-slate-500 font-mono">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>

                        <td className="py-2.5 px-4 text-right">
                          <Link
                            href={`/app/customers/${c.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors p-1"
                          >
                            <span>Profile</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards (<640px) */}
            <div className="sm:hidden divide-y divide-slate-100 p-2 space-y-2">
              {customers.map((c) => {
                const primaryPhone = c.phones.find((p) => p.isPrimary) || c.phones[0];
                const primaryEmail = c.emails.find((e) => e.isPrimary) || c.emails[0];
                const telUrl = primaryPhone ? getTelUrl(primaryPhone.rawPhone) : null;
                const waUrl = primaryPhone ? getWhatsAppUrl(primaryPhone.rawPhone) : null;
                const mailUrl = primaryEmail ? getMailtoUrl(primaryEmail.email) : null;
                const isSelected = selectedIds.has(c.id);

                return (
                  <div
                    key={c.id}
                    className={`p-3 bg-white rounded-lg border border-slate-200/90 shadow-xs space-y-2.5 ${
                      isSelected ? "bg-indigo-50/30 border-indigo-200" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <BulkCheckbox
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={`Select ${c.name}`}
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/app/customers/${c.id}`}
                            className="font-medium text-slate-900 hover:text-indigo-600 transition text-xs flex items-center gap-1"
                          >
                            <span className="truncate">{c.name}</span>
                            <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          </Link>
                          {c.companyName && (
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                              <Building className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{c.companyName}</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] px-1.5 py-0.5 shrink-0"
                      >
                        {c._count.enquiries} deals
                      </Badge>
                    </div>

                    {/* Quick Contact Action Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100">
                      {telUrl ? (
                        <a
                          href={telUrl}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 text-emerald-700 text-xs font-medium transition"
                        >
                          <Phone className="h-3 w-3 text-emerald-600" />
                          <span>Call</span>
                        </a>
                      ) : (
                        <span className="flex items-center justify-center py-1.5 px-2 rounded-md bg-slate-50 text-slate-400 text-xs">
                          No Phone
                        </span>
                      )}

                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-green-50 hover:bg-green-100 border border-green-200/60 text-green-700 text-xs font-medium transition"
                        >
                          <MessageSquare className="h-3 w-3 text-green-600" />
                          <span>WhatsApp</span>
                        </a>
                      ) : (
                        <span className="flex items-center justify-center py-1.5 px-2 rounded-md bg-slate-50 text-slate-400 text-xs">
                          No WA
                        </span>
                      )}

                      {mailUrl ? (
                        <a
                          href={mailUrl}
                          className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-md bg-sky-50 hover:bg-sky-100 border border-sky-200/60 text-sky-700 text-xs font-medium transition"
                        >
                          <Mail className="h-3 w-3 text-sky-600" />
                          <span>Email</span>
                        </a>
                      ) : (
                        <span className="flex items-center justify-center py-1.5 px-2 rounded-md bg-slate-50 text-slate-400 text-xs">
                          No Email
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {!loading && pagination.total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200/90 px-4 py-2.5 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Showing{" "}
              <span className="font-medium text-slate-900">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-slate-900">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-medium text-slate-900">{pagination.total}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchCustomers(pagination.page - 1, search)}
                className="h-7 w-7 p-0 border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="px-1 text-[11px] font-mono text-slate-700">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchCustomers(pagination.page + 1, search)}
                className="h-7 w-7 p-0 border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Universal Floating Bulk Action Toolbar */}
      <BulkActionToolbar
        selectedCount={selectedCount}
        selectedIds={Array.from(selectedIds)}
        actions={bulkActions}
        onClearSelection={clearSelection}
        onActionComplete={() => {
          clearSelection();
          fetchCustomers(pagination.page, search);
        }}
        entityName="customers"
      />

      {/* Create Customer Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              Add Customer
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-medium text-slate-700">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                required
                placeholder="e.g. Dr. Rajesh Khanna"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 h-8 bg-slate-50/50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label className="text-xs font-medium text-slate-700">Display Name</Label>
                <Input
                  placeholder="e.g. Dr. Rajesh"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="mt-1 h-8 bg-slate-50/50 border-slate-200 text-xs text-slate-900"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Organization</Label>
                <Input
                  placeholder="e.g. Apex Hospital"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="mt-1 h-8 bg-slate-50/50 border-slate-200 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2">
                <Label className="text-xs font-medium text-slate-700">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  required
                  placeholder="+91 9876543200"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-1 h-8 bg-slate-50/50 border-slate-200 text-xs text-slate-900 font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700">Type</Label>
                <select
                  value={newPhoneType}
                  onChange={(e) => setNewPhoneType(e.target.value as "MOBILE" | "WORK" | "HOME" | "WHATSAPP")}
                  className="mt-1 w-full h-8 rounded-md bg-slate-50/50 border border-slate-200 text-slate-900 text-xs px-2"
                >
                  <option value="MOBILE">Mobile</option>
                  <option value="WORK">Work</option>
                  <option value="HOME">Home</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Email Address</Label>
              <Input
                type="email"
                placeholder="rajesh@apex.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1 h-8 bg-slate-50/50 border-slate-200 text-xs text-slate-900"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700">Notes</Label>
              <textarea
                rows={2}
                placeholder="Customer relationship notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="mt-1 w-full rounded-md bg-slate-50/50 border border-slate-200 text-slate-900 text-xs p-2 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                className="h-8 border-slate-200 hover:bg-slate-50 text-slate-700 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={creating}
                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium"
              >
                {creating ? "Creating..." : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
