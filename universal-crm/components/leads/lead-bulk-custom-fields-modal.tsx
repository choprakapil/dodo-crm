"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  SlidersHorizontal,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BulkActionResult } from "@/components/bulk/types";
import { CustomFieldDefinition } from "./lead-custom-fields-input";

interface LeadBulkCustomFieldsModalProps {
  isOpen: boolean;
  selectedIds: string[];
  onClose: () => void;
  onComplete: (result: BulkActionResult) => void;
}

type FieldActionType = "SET" | "CLEAR";

interface FieldState {
  included: boolean;
  action: FieldActionType;
  value: any;
}

export function LeadBulkCustomFieldsModal({
  isOpen,
  selectedIds,
  onClose,
  onComplete,
}: LeadBulkCustomFieldsModalProps) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Load custom fields on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    async function loadFields() {
      try {
        const res = await fetch("/api/v1/custom-fields?entityType=LEAD");
        if (!res.ok) {
          throw new Error("Failed to load custom fields");
        }
        const json = await res.json();
        if (isMounted) {
          const list: CustomFieldDefinition[] = json.data || [];
          setFields(list);

          // Initialize field states
          const initialStates: Record<string, FieldState> = {};
          for (const f of list) {
            initialStates[f.key] = {
              included: false,
              action: "SET",
              value: f.fieldType === "BOOLEAN" ? false : f.fieldType === "MULTI_SELECT" ? [] : "",
            };
          }
          setFieldStates(initialStates);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Failed to load custom fields");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadFields();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const selectedCount = selectedIds.length;

  const toggleIncludeField = (key: string) => {
    setFieldStates((prev) => {
      const current = prev[key] || {
        included: false,
        action: "SET",
        value: "",
      };
      return {
        ...prev,
        [key]: {
          ...current,
          included: !current.included,
        },
      };
    });
  };

  const updateFieldAction = (key: string, action: FieldActionType) => {
    setFieldStates((prev) => {
      const current = prev[key] || {
        included: true,
        action: "SET",
        value: "",
      };
      return {
        ...prev,
        [key]: {
          ...current,
          action,
        },
      };
    });
  };

  const updateFieldValue = (key: string, value: any) => {
    setFieldStates((prev) => {
      const current = prev[key] || {
        included: true,
        action: "SET",
        value: "",
      };
      return {
        ...prev,
        [key]: {
          ...current,
          value,
        },
      };
    });
  };

  // Filtered fields based on search
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return fields;
    const q = searchQuery.toLowerCase();
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
    );
  }, [fields, searchQuery]);

  // Selected modifications summary
  const plannedModifications = useMemo(() => {
    const list: Array<{
      field: CustomFieldDefinition;
      action: FieldActionType;
      value: any;
    }> = [];

    for (const field of fields) {
      const state = fieldStates[field.key];
      if (state && state.included) {
        list.push({
          field,
          action: state.action,
          value: state.value,
        });
      }
    }

    return list;
  }, [fields, fieldStates]);

  const handleSubmit = async () => {
    if (plannedModifications.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const customFieldUpdates = plannedModifications.map((m) => ({
        key: m.field.key,
        action: m.action,
        value: m.action === "CLEAR" ? null : m.value,
      }));

      const res = await fetch("/api/v1/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "EDIT_CUSTOM_FIELDS",
          leadIds: selectedIds,
          customFieldUpdates,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || "Bulk update failed");
      }

      onClose();
      onComplete(json);
    } catch (err: any) {
      setError(err?.message || "Failed to execute bulk update");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 shrink-0">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Bulk Edit Custom Fields
                </h3>
                <Badge
                  variant="outline"
                  className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[11px] font-semibold px-2 py-0.5"
                >
                  {selectedCount} Lead{selectedCount !== 1 ? "s" : ""} Selected
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Update or clear specific custom fields for all selected leads. Unselected fields remain untouched.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold">Operation Failed</p>
                <p className="text-rose-700 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mb-2" />
              <span>Loading custom field definitions...</span>
            </div>
          ) : fields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
              <Info className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-semibold text-slate-700">No Custom Fields Configured</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                No active custom fields are defined for Leads. Go to Settings &gt; Custom Fields to create custom attributes.
              </p>
            </div>
          ) : (
            <>
              {/* Field Search & Controls */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Input
                    placeholder="Search custom fields..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs bg-slate-50/50"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                  {plannedModifications.length} of {fields.length} selected
                </span>
              </div>

              {/* Fields List */}
              <div className="space-y-3">
                {filteredFields.map((field) => {
                  const state = fieldStates[field.key] || {
                    included: false,
                    action: "SET",
                    value: "",
                  };
                  const options = Array.isArray(field.options) ? (field.options as string[]) : [];

                  return (
                    <div
                      key={field.id}
                      className={`rounded-xl border transition-all duration-150 p-3.5 ${
                        state.included
                          ? "border-indigo-200 bg-indigo-50/30 shadow-xs"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none flex-1">
                          <input
                            type="checkbox"
                            checked={state.included}
                            onChange={() => toggleIncludeField(field.key)}
                            disabled={isSubmitting}
                            className="h-4 w-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-slate-900">
                                {field.label}
                              </span>
                              {field.required && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 px-1.5 py-0 font-medium"
                                >
                                  Required
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-slate-50 text-slate-600 border-slate-200 px-1.5 py-0 font-mono lowercase"
                              >
                                {field.fieldType}
                              </Badge>
                            </div>
                            {field.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                                {field.description}
                              </p>
                            )}
                          </div>
                        </label>

                        {/* Action Mode Toggle */}
                        {state.included && (
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => updateFieldAction(field.key, "SET")}
                              disabled={isSubmitting}
                              className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                                state.action === "SET"
                                  ? "bg-white text-indigo-700 shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Set Value
                            </button>
                            <button
                              type="button"
                              onClick={() => updateFieldAction(field.key, "CLEAR")}
                              disabled={isSubmitting || field.required}
                              title={field.required ? "Required field cannot be cleared" : undefined}
                              className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-colors flex items-center gap-1 ${
                                state.action === "CLEAR"
                                  ? "bg-rose-600 text-white shadow-2xs"
                                  : field.required
                                  ? "text-slate-400 opacity-50 cursor-not-allowed"
                                  : "text-slate-600 hover:text-rose-600"
                              }`}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                              Clear
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Expanded Input Controls when Included */}
                      {state.included && (
                        <div className="mt-3 pt-3 border-t border-slate-200/70">
                          {state.action === "CLEAR" ? (
                            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50/80 p-2.5 rounded-lg border border-rose-100 font-medium">
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                This field will be cleared / removed from all {selectedCount} selected lead(s).
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {/* Field Type Specific Controls */}
                              {field.fieldType === "TEXTAREA" ? (
                                <textarea
                                  className="w-full min-h-[60px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                  value={state.value ?? ""}
                                  onChange={(e) => updateFieldValue(field.key, e.target.value)}
                                  disabled={isSubmitting}
                                  placeholder={`Enter ${field.label.toLowerCase()} for all selected leads...`}
                                />
                              ) : field.fieldType === "BOOLEAN" ? (
                                <div className="flex items-center gap-3">
                                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`bool_${field.key}`}
                                      checked={state.value === true}
                                      onChange={() => updateFieldValue(field.key, true)}
                                      disabled={isSubmitting}
                                      className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>Yes / True</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                                    <input
                                      type="radio"
                                      name={`bool_${field.key}`}
                                      checked={state.value === false}
                                      onChange={() => updateFieldValue(field.key, false)}
                                      disabled={isSubmitting}
                                      className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>No / False</span>
                                  </label>
                                </div>
                              ) : field.fieldType === "SELECT" ? (
                                <select
                                  className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                  value={state.value ?? ""}
                                  onChange={(e) => updateFieldValue(field.key, e.target.value || null)}
                                  disabled={isSubmitting}
                                >
                                  <option value="">Select option to apply...</option>
                                  {options.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : field.fieldType === "MULTI_SELECT" ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border border-slate-200 rounded-lg p-2.5 bg-slate-50/50">
                                  {options.map((opt) => {
                                    const currentArray: string[] = Array.isArray(state.value)
                                      ? state.value
                                      : [];
                                    const isChecked = currentArray.includes(opt);

                                    return (
                                      <label
                                        key={opt}
                                        className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          disabled={isSubmitting}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              updateFieldValue(field.key, [...currentArray, opt]);
                                            } else {
                                              updateFieldValue(
                                                field.key,
                                                currentArray.filter((i) => i !== opt)
                                              );
                                            }
                                          }}
                                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="truncate">{opt}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <Input
                                  type={
                                    field.fieldType === "NUMBER"
                                      ? "number"
                                      : field.fieldType === "DATE"
                                      ? "date"
                                      : field.fieldType === "DATETIME"
                                      ? "datetime-local"
                                      : field.fieldType === "EMAIL"
                                      ? "email"
                                      : field.fieldType === "PHONE"
                                      ? "tel"
                                      : field.fieldType === "URL"
                                      ? "url"
                                      : "text"
                                  }
                                  className="h-8 text-xs bg-white"
                                  value={state.value ?? ""}
                                  onChange={(e) => updateFieldValue(field.key, e.target.value)}
                                  disabled={isSubmitting}
                                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Planned Changes Confirmation Preview Card */}
              {plannedModifications.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Planned Changes ({plannedModifications.length} field{plannedModifications.length !== 1 ? "s" : ""})
                    </span>
                    <span className="text-[10px] text-indigo-600 font-normal">
                      Applying to {selectedCount} lead(s)
                    </span>
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {plannedModifications.map((m) => (
                      <li key={m.field.key} className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{m.field.label}:</span>
                        {m.action === "CLEAR" ? (
                          <span className="text-rose-600 font-semibold text-[11px]">
                            [Clear Value]
                          </span>
                        ) : (
                          <span className="text-indigo-700 font-mono text-[11px]">
                            {Array.isArray(m.value)
                              ? m.value.join(", ") || "(empty)"
                              : typeof m.value === "boolean"
                              ? m.value
                                ? "Yes"
                                : "No"
                              : String(m.value || "(empty)")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-500 pt-1 border-t border-indigo-100">
                    Note: Only the fields listed above will be updated. All other existing custom fields on the selected leads remain unchanged.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
            className="text-xs"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || plannedModifications.length === 0}
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-2xs"
          >
            {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Apply Changes ({plannedModifications.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
