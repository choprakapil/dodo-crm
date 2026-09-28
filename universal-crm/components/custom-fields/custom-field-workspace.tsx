"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Plus,
  Sliders,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";

export interface CustomFieldItem {
  id: string;
  key: string;
  label: string;
  description: string | null;
  fieldType: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  options: unknown;
  createdAt: string | Date;
}

interface CustomFieldWorkspaceProps {
  initialFields: CustomFieldItem[];
}

const FIELD_TYPES = [
  { value: "TEXT", label: "Single-line Text" },
  { value: "TEXTAREA", label: "Multi-line Text (Textarea)" },
  { value: "NUMBER", label: "Numeric Value" },
  { value: "DATE", label: "Date" },
  { value: "DATETIME", label: "Date & Time" },
  { value: "BOOLEAN", label: "Yes / No (Boolean)" },
  { value: "SELECT", label: "Single Select Dropdown" },
  { value: "MULTI_SELECT", label: "Multi-Select Checkboxes" },
  { value: "EMAIL", label: "Email Address" },
  { value: "PHONE", label: "Phone Number" },
  { value: "URL", label: "Web Link (URL)" },
];

export function CustomFieldWorkspace({ initialFields }: CustomFieldWorkspaceProps) {
  const router = useRouter();
  const [fields, setFields] = useState<CustomFieldItem[]>(initialFields);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [required, setRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [optionsText, setOptionsText] = useState("");

  const resetDialog = () => {
    setEditingId(null);
    setLabel("");
    setKey("");
    setDescription("");
    setFieldType("TEXT");
    setRequired(false);
    setActive(true);
    setOptionsText("");
    setError(null);
  };

  const handleOpenCreate = () => {
    resetDialog();
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (field: CustomFieldItem) => {
    setEditingId(field.id);
    setLabel(field.label);
    setKey(field.key);
    setDescription(field.description || "");
    setFieldType(field.fieldType);
    setRequired(field.required);
    setActive(field.active);
    const opts = Array.isArray(field.options) ? (field.options as string[]) : [];
    setOptionsText(opts.join(", "));
    setError(null);
    setIsDialogOpen(true);
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    if (!editingId) {
      // Auto-generate key from label
      const generated = newLabel
        .toLowerCase()
        .replace(/[^a-z0-9_ ]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      setKey(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Field label is required");
      return;
    }
    if (!editingId && !key.trim()) {
      setError("Field key is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    const parsedOptions =
      fieldType === "SELECT" || fieldType === "MULTI_SELECT"
        ? optionsText
            .split(/[\n,]/)
            .map((o) => o.trim())
            .filter((o) => o.length > 0)
        : undefined;

    try {
      if (editingId) {
        // Update existing field
        const res = await fetch(`/api/v1/custom-fields/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            description: description.trim() || null,
            required,
            active,
            options: parsedOptions,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message || "Failed to update custom field");
          setIsSaving(false);
          return;
        }

        setFields((prev) =>
          prev.map((f) => (f.id === editingId ? { ...f, ...data.data } : f))
        );
      } else {
        // Create new field
        const res = await fetch("/api/v1/custom-fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            key: key.trim(),
            description: description.trim() || undefined,
            fieldType,
            required,
            active,
            options: parsedOptions,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message || "Failed to create custom field");
          setIsSaving(false);
          return;
        }

        setFields((prev) => [...prev, data.data]);
      }

      setIsDialogOpen(false);
      resetDialog();
      router.refresh();
    } catch {
      setError("Network or server error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate and remove this custom field?")) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/custom-fields/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFields((prev) => prev.filter((f) => f.id !== id));
        router.refresh();
      }
    } catch {
      alert("Failed to delete custom field");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-400" />
            <span>Lead Custom Fields</span>
            <Link
              href="/app/help?article=custom-fields"
              className="text-slate-500 hover:text-indigo-400 transition ml-1"
              title="Custom Fields Help Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure custom data attributes for your company&apos;s leads.
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom Field
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-3 px-4 font-semibold">Field Label & Key</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Required</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Options / Details</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {fields.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No custom fields configured yet. Click &quot;+ Add Custom Field&quot; to get started.
                  </td>
                </tr>
              ) : (
                fields.map((field) => {
                  const opts = Array.isArray(field.options) ? (field.options as string[]) : [];

                  return (
                    <tr key={field.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{field.label}</div>
                        <div className="font-mono text-[10px] text-indigo-400/90">{field.key}</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="border-slate-700 bg-slate-800/80 text-slate-200 text-[10px] font-mono"
                        >
                          {field.fieldType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {field.required ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Yes
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Optional</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {field.active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 text-[11px]">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-400 max-w-xs truncate">
                        {opts.length > 0 ? (
                          <span>{opts.join(", ")}</span>
                        ) : field.description ? (
                          <span>{field.description}</span>
                        ) : (
                          <span className="text-slate-600 italic">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(field)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10"
                          title="Edit Custom Field"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(field.id)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete Custom Field"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-white">
                {editingId ? "Edit Custom Field" : "Create Custom Field"}
              </h2>
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Field Label *</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="e.g. Property Type, Budget, Patient Category"
                  value={label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  required
                />
              </div>

              {!editingId && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    Field Key *{" "}
                    <span className="text-[10px] text-slate-500">
                      (snake_case, unique within entity)
                    </span>
                  </Label>
                  <Input
                    className="h-9 text-xs font-mono"
                    placeholder="e.g. property_type"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Description (Optional)</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="Help text for CRM users"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {!editingId && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Field Type</Label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(fieldType === "SELECT" || fieldType === "MULTI_SELECT") && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">
                    Dropdown Options *{" "}
                    <span className="text-[10px] text-slate-500">
                      (comma- or newline-separated)
                    </span>
                  </Label>
                  <textarea
                    className="w-full min-h-[70px] rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
                    placeholder="Residential, Commercial, Industrial"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={required}
                    onChange={(e) => setRequired(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Required on Lead creation</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : editingId ? (
                    "Save Changes"
                  ) : (
                    "Create Field"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
