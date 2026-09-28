"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export interface CustomFieldDefinition {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  fieldType:
    | "TEXT"
    | "TEXTAREA"
    | "NUMBER"
    | "DATE"
    | "DATETIME"
    | "BOOLEAN"
    | "SELECT"
    | "MULTI_SELECT"
    | "URL"
    | "EMAIL"
    | "PHONE";
  required: boolean;
  active: boolean;
  options?: unknown;
}

interface LeadCustomFieldsInputProps {
  values: Record<string, unknown>;
  onChange: (newValues: Record<string, unknown>) => void;
  disabled?: boolean;
}

export function LeadCustomFieldsInput({
  values,
  onChange,
  disabled = false,
}: LeadCustomFieldsInputProps) {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadFields() {
      try {
        const res = await fetch("/api/v1/custom-fields?entityType=LEAD");
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setFields(json.data || []);
          }
        }
      } catch {
        // Silently handle
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFields();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-3 text-xs text-muted-foreground">
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        Loading custom fields...
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  const handleFieldChange = (key: string, val: unknown) => {
    onChange({
      ...values,
      [key]: val,
    });
  };

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Custom Fields
        </h4>
        <span className="text-[11px] text-muted-foreground">
          {fields.length} field{fields.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((field) => {
          const rawVal = values[field.key];
          const options = Array.isArray(field.options) ? (field.options as string[]) : [];

          return (
            <div key={field.id} className="space-y-1">
              <Label className="text-xs flex items-center justify-between">
                <span>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {field.fieldType.toLowerCase()}
                </span>
              </Label>

              {field.description && (
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {field.description}
                </p>
              )}

              {/* Render input based on fieldType */}
              {field.fieldType === "TEXTAREA" ? (
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  disabled={disabled}
                  required={field.required}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              ) : field.fieldType === "BOOLEAN" ? (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id={`cf_${field.key}`}
                    checked={Boolean(rawVal)}
                    onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor={`cf_${field.key}`} className="text-xs text-foreground cursor-pointer">
                    {Boolean(rawVal) ? "Yes" : "No"}
                  </label>
                </div>
              ) : field.fieldType === "SELECT" ? (
                <select
                  className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                  value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value || null)}
                  disabled={disabled}
                  required={field.required}
                >
                  <option value="">Select option...</option>
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.fieldType === "MULTI_SELECT" ? (
                <div className="space-y-1.5 border border-input rounded-md p-2 bg-muted/20">
                  {options.map((opt) => {
                    const currentArray = Array.isArray(rawVal)
                      ? (rawVal as string[])
                      : typeof rawVal === "string"
                      ? rawVal.split(";").map((s) => s.trim())
                      : [];
                    const isSelected = currentArray.includes(opt);

                    return (
                      <label key={opt} className="flex items-center space-x-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabled}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleFieldChange(field.key, [...currentArray, opt]);
                            } else {
                              handleFieldChange(
                                field.key,
                                currentArray.filter((i) => i !== opt)
                              );
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span>{opt}</span>
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
                  className="h-8 text-xs"
                  value={rawVal !== undefined && rawVal !== null ? String(rawVal) : ""}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  disabled={disabled}
                  required={field.required}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
