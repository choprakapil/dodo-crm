"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Download,
  RotateCcw,
  HelpCircle,
  Sparkles,
  Check,
  XCircle,
} from "lucide-react";

interface FieldOption {
  key: string;
  label: string;
  required: boolean;
  isCustom: boolean;
}

interface HeaderDetectionItem {
  header: string;
  originalHeader: string;
  suggestedField: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  status: "AUTO_MATCHED" | "REVIEW_SUGGESTED" | "NEEDS_REVIEW" | "CONFLICT" | "UNMAPPED";
  matchReason: string;
  conflictWith?: string[];
  isCustomField: boolean;
}

interface PreviewData {
  filename: string;
  totalRows: number;
  detectedHeaders: string[];
  suggestedMappings: Record<string, string>;
  headerDetections?: HeaderDetectionItem[];
  conflicts?: Array<{ field: string; headers: string[] }>;
  hasConflicts?: boolean;
  detectionStats?: {
    highConfidenceCount: number;
    reviewCount: number;
    unmappedCount: number;
    conflictCount: number;
  };
  sampleRows: Record<string, string>[];
  availableFields: FieldOption[];
}

interface ImportResult {
  id: string;
  totalRows: number;
  successfulRows: number;
  skippedRows: number;
  updatedRows: number;
  failedRows: number;
  status: string;
  errorSummary?: Array<{ row: number; reason: string }>;
}

export function LeadImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Upload state
  const [csvContent, setCsvContent] = useState("");
  const [filename, setFilename] = useState("leads.csv");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Mapping state
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});

  // Step 3: Duplicate strategy
  const [duplicateStrategy, setDuplicateStrategy] = useState<"SKIP" | "UPDATE" | "CREATE">("SKIP");
  const [isExecuting, setIsExecuting] = useState(false);

  // Step 4: Result state
  const [result, setResult] = useState<ImportResult | null>(null);

  // Client-side computed destination collisions
  const destinationCollisions = useMemo(() => {
    const counts = new Map<string, string[]>();
    for (const [csvCol, crmKey] of Object.entries(columnMappings)) {
      if (!crmKey) continue;
      const list = counts.get(crmKey) || [];
      list.push(csvCol);
      counts.set(crmKey, list);
    }
    const duplicates: Array<{ field: string; columns: string[] }> = [];
    for (const [field, columns] of counts.entries()) {
      if (columns.length > 1) {
        duplicates.push({ field, columns });
      }
    }
    return duplicates;
  }, [columnMappings]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      setError(null);
    };
    reader.readAsText(file);
  };

  // Step 1 -> Step 2: Preview
  const handlePreview = async () => {
    if (!csvContent.trim()) {
      setError("Please select or paste CSV content first");
      return;
    }

    setIsPreviewing(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/leads/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, filename }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Failed to parse CSV preview");
        setIsPreviewing(false);
        return;
      }

      setPreviewData(data.data);
      setColumnMappings(data.data.suggestedMappings || {});
      setStep(2);
    } catch {
      setError("Failed to connect to import service");
    } finally {
      setIsPreviewing(false);
    }
  };

  // Step 2 -> Step 3: Verify Mapping
  const handleProceedToSettings = () => {
    // Check for duplicate destination mapping collisions
    if (destinationCollisions.length > 0) {
      const first = destinationCollisions[0];
      const fieldObj = previewData?.availableFields.find((f) => f.key === first.field);
      const fieldName = fieldObj?.label || first.field;
      setError(
        `Duplicate destination mapping: multiple columns (${first.columns.join(", ")}) are mapped to "${fieldName}". Please map each destination field at most once.`
      );
      return;
    }

    // Verify required "name" field is mapped
    const hasNameMapping = Object.values(columnMappings).includes("name");
    if (!hasNameMapping) {
      setError('Please map at least one CSV column to the required CRM field "Lead Name"');
      return;
    }
    setError(null);
    setStep(3);
  };

  // Step 3 -> Step 4: Execute Import
  const handleExecuteImport = async () => {
    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent,
          filename,
          columnMappings,
          duplicateStrategy,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || "Import execution failed");
        setIsExecuting(false);
        return;
      }

      setResult(data.data);
      setStep(4);
    } catch {
      setError("An unexpected network error occurred during import");
    } finally {
      setIsExecuting(false);
    }
  };

  // Download Sample Template
  const downloadSampleTemplate = () => {
    const sample =
      "name,email,phone,company,deal_value,priority,status,source\nJohn Doe,john@example.com,+1 555-0100,Acme Inc,25000,HIGH,New,Website\nJane Smith,jane@example.com,+1 555-0101,Global Corp,75000,URGENT,Contacted,Referral\n";
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_import_sample_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Error CSV
  const downloadErrorCsv = () => {
    if (!result?.errorSummary || result.errorSummary.length === 0) return;

    let csv = "Row Number,Error Reason\n";
    for (const err of result.errorSummary) {
      const escaped = `"${err.reason.replace(/"/g, '""')}"`;
      csv += `${err.row},${escaped}\n`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_errors_${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Wizard Header / Steps Indicator */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
            <span>Import Leads from CSV</span>
            <Link
              href="/app/help?article=import-export"
              className="text-slate-400 hover:text-indigo-600 transition ml-1"
              title="Import & Export Help Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Bulk ingest contacts, deal metrics, and custom field values with automatic duplicate protection.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {[
            { num: 1, label: "Upload" },
            { num: 2, label: "Map" },
            { num: 3, label: "Settings" },
            { num: 4, label: "Result" },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                step === s.num
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : step > s.num
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <span>{s.num}.</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-600" /> Select CSV File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-300 rounded-xl p-8 text-center bg-slate-50/50 transition">
                <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <p className="text-xs text-slate-700 font-medium">
                  Drag and drop your .csv file here, or click to browse
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supported format: RFC 4180 CSV (up to 10 MB / 50,000 rows)
                </p>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="mt-4 text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 font-medium">Or paste raw CSV text:</label>
                <textarea
                  className="w-full min-h-[120px] rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 font-mono outline-none focus:border-indigo-500"
                  placeholder="name,email,phone,company&#10;Alice,alice@example.com,+1 555-0199,TechCorp"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleTemplate}
                  className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Sample CSV
                </Button>

                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing || !csvContent.trim()}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white shadow-xs"
                >
                  {isPreviewing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      Preview & Map <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Side Instructions */}
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Import Rules & Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="space-y-1">
                <div className="text-slate-900 font-medium">1. Required Field</div>
                <div>Every row must contain a valid <strong>Lead Name</strong>.</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-900 font-medium">2. Duplicate Protection</div>
                <div>Duplicates are matched by Email or Phone. You choose to skip, update, or create on step 3.</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-900 font-medium">3. Custom Fields</div>
                <div>Custom fields defined for your company are automatically detected and mapped.</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-900 font-medium">4. Tenant Isolation</div>
                <div>All imported leads strictly belong to your active company account.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: PREVIEW & MAP */}
      {step === 2 && previewData && (
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>Intelligent Column Mapping</span>
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    File: <strong className="text-slate-800">{previewData.filename}</strong> (
                    {previewData.totalRows} detected rows, {previewData.detectedHeaders.length} columns)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setColumnMappings(previewData.suggestedMappings || {})}
                    className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset to Auto-detected
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setColumnMappings({})}
                    className="border-slate-200 text-xs text-rose-600 hover:bg-rose-50 shadow-2xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              {/* Intelligent Detection Summary Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 mt-3 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Auto-detection summary:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                  <Check className="h-3 w-3" />
                  {previewData.detectionStats?.highConfidenceCount ??
                    Object.keys(previewData.suggestedMappings || {}).length}{" "}
                  Auto-matched
                </span>
                {(previewData.detectionStats?.reviewCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {previewData.detectionStats?.reviewCount} Review Suggested
                  </span>
                )}
                {(previewData.detectionStats?.conflictCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                    <AlertCircle className="h-3 w-3" />
                    {previewData.detectionStats?.conflictCount} Column Conflict
                  </span>
                )}
                {(previewData.detectionStats?.unmappedCount ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px]">
                    {previewData.detectionStats?.unmappedCount} Unmapped
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Duplicate Destination Collision Warning Banner */}
              {destinationCollisions.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <strong className="font-semibold block text-rose-900">
                      Destination Mapping Collision Detected
                    </strong>
                    {destinationCollisions.map((col, idx) => {
                      const fObj = previewData.availableFields.find((f) => f.key === col.field);
                      return (
                        <div key={idx} className="mt-0.5">
                          Multiple columns (<strong>{col.columns.join(", ")}</strong>) are mapped to
                          &ldquo;{fObj?.label || col.field}&rdquo;. Please map each CRM destination field
                          at most once.
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Initial Server Conflicts Warning Banner */}
              {previewData.hasConflicts && destinationCollisions.length === 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong className="font-semibold block text-amber-900">
                      Duplicate Header Matches Identified
                    </strong>
                    Multiple CSV headers appear to describe the same CRM field. Please review the
                    highlighted columns below and select your preferred destination mapping.
                  </div>
                </div>
              )}

              {/* Mapping Table */}
              <div className="rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">CSV Column Header</th>
                      <th className="py-2.5 px-4 font-semibold">Match Status</th>
                      <th className="py-2.5 px-4 font-semibold">Sample Row 1</th>
                      <th className="py-2.5 px-4 font-semibold">Destination CRM Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.detectedHeaders.map((header) => {
                      const sampleVal = previewData.sampleRows[0]?.[header] ?? "";
                      const currentMappedKey = columnMappings[header] || "";
                      const detection = previewData.headerDetections?.find((d) => d.header === header);

                      // Check if this column is part of a collision
                      const isColliding = destinationCollisions.some(
                        (c) => c.field === currentMappedKey && c.columns.includes(header)
                      );

                      // Determine badge
                      let badge = null;
                      if (currentMappedKey && currentMappedKey !== detection?.suggestedField) {
                        badge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Manual Override
                          </span>
                        );
                      } else if (detection?.status === "CONFLICT" || isColliding) {
                        badge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            Conflict
                          </span>
                        );
                      } else if (detection?.status === "AUTO_MATCHED") {
                        badge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Auto-matched (High)
                          </span>
                        );
                      } else if (detection?.status === "REVIEW_SUGGESTED") {
                        badge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            Review Suggested
                          </span>
                        );
                      } else if (detection?.status === "NEEDS_REVIEW") {
                        badge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                            Needs Review
                          </span>
                        );
                      } else {
                        badge = (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Unmapped
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={header}
                          className={`hover:bg-slate-50 transition ${
                            isColliding ? "bg-rose-50/50" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 font-medium text-slate-900">
                            <div className="font-semibold text-slate-900">{header}</div>
                            {detection?.matchReason && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {detection.matchReason}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4">{badge}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                            {sampleVal || <span className="text-slate-400 italic">—</span>}
                          </td>
                          <td className="py-2.5 px-4">
                            <select
                              value={currentMappedKey}
                              onChange={(e) => {
                                const val = e.target.value;
                                setColumnMappings((prev) => {
                                  const updated = { ...prev };
                                  if (val) {
                                    updated[header] = val;
                                  } else {
                                    delete updated[header];
                                  }
                                  return updated;
                                });
                              }}
                              className={`w-full max-w-xs h-8 rounded-lg border bg-white px-2.5 text-xs text-slate-800 outline-none transition shadow-2xs ${
                                isColliding
                                  ? "border-rose-400 focus:border-rose-500"
                                  : "border-slate-200 focus:border-indigo-500"
                              }`}
                            >
                              <option value="">(Ignore Column)</option>
                              <optgroup label="Core Lead Fields">
                                {previewData.availableFields
                                  .filter((f) => !f.isCustom)
                                  .map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label} {f.required ? "*" : ""}
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Company Custom Fields">
                                {previewData.availableFields
                                  .filter((f) => f.isCustom)
                                  .map((f) => (
                                    <option key={f.key} value={f.key}>
                                      {f.label} {f.required ? "*" : ""}
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Sample Rows Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Sample Rows Preview (First 5 Rows)
                </h4>
                <div className="rounded-lg border border-slate-200 overflow-x-auto shadow-2xs">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500">
                      <tr>
                        {previewData.detectedHeaders.map((h) => (
                          <th key={h} className="py-2 px-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {previewData.detectedHeaders.map((h) => (
                            <td key={h} className="py-2 px-3 text-[11px] truncate max-w-[150px]">
                              {row[h] || <span className="text-slate-400">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>

                <Button
                  type="button"
                  onClick={handleProceedToSettings}
                  size="sm"
                  disabled={destinationCollisions.length > 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white disabled:opacity-50 shadow-xs"
                >
                  Continue to Settings <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 3: SETTINGS & CONFIRMATION */}
      {step === 3 && (
        <Card className="border-slate-200 bg-white shadow-xs max-w-2xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-900">
              Duplicate Handling Strategy
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose how to handle leads with matching emails or phone numbers already in your database.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {[
                {
                  id: "SKIP",
                  title: "Skip Duplicates (Recommended)",
                  desc: "Keep existing lead records intact and do not import matching rows.",
                },
                {
                  id: "UPDATE",
                  title: "Update Existing Leads",
                  desc: "Overwrite mapped fields with new values from CSV. Unmapped fields remain unchanged.",
                },
                {
                  id: "CREATE",
                  title: "Create Anyway",
                  desc: "Always create new lead records even if email or phone already exists.",
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                    duplicateStrategy === opt.id
                      ? "border-indigo-600 bg-indigo-50/50 shadow-2xs"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value={opt.id}
                    checked={duplicateStrategy === opt.id}
                    onChange={() => setDuplicateStrategy(opt.id as "SKIP" | "UPDATE" | "CREATE")}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-900">{opt.title}</div>
                    <div className="text-[11px] text-slate-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-900">
              Ready to import <strong>{previewData?.totalRows}</strong> rows into{" "}
              <strong>your CRM workspace</strong>. All operations will be validated server-side.
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Mapping
              </Button>

              <Button
                type="button"
                onClick={handleExecuteImport}
                disabled={isExecuting}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white shadow-xs"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Processing Import...
                  </>
                ) : (
                  "Execute Import"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: RESULT */}
      {step === 4 && result && (
        <Card className="border-slate-200 bg-white shadow-xs max-w-3xl mx-auto">
          <CardHeader className="pb-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <CardTitle className="text-base font-bold text-slate-900">Import Completed</CardTitle>
            <p className="text-xs text-slate-500">
              Status: <span className="font-mono text-emerald-700 font-semibold">{result.status}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Total
                </div>
                <div className="text-lg font-bold text-slate-900 mt-1">{result.totalRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
                  Created
                </div>
                <div className="text-lg font-bold text-emerald-700 mt-1">
                  {result.successfulRows}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                <div className="text-[10px] uppercase tracking-wider text-blue-700 font-semibold">
                  Updated
                </div>
                <div className="text-lg font-bold text-blue-700 mt-1">{result.updatedRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">
                  Skipped
                </div>
                <div className="text-lg font-bold text-amber-700 mt-1">{result.skippedRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-rose-200 bg-rose-50">
                <div className="text-[10px] uppercase tracking-wider text-rose-700 font-semibold">
                  Failed
                </div>
                <div className="text-lg font-bold text-rose-700 mt-1">{result.failedRows}</div>
              </div>
            </div>

            {/* Error table if failed > 0 */}
            {result.failedRows > 0 && result.errorSummary && result.errorSummary.length > 0 && (
              <div className="space-y-2 border border-rose-200 bg-rose-50/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Error Details ({result.failedRows} rows failed)
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadErrorCsv}
                    className="border-rose-300 text-rose-700 text-xs hover:bg-rose-100/50 shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Download Errors CSV
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 text-[11px]">
                      {result.errorSummary.slice(0, 50).map((err, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono text-slate-500">{err.row}</td>
                          <td className="py-2 px-3 text-rose-600">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setCsvContent("");
                  setResult(null);
                }}
                className="border-slate-200 text-xs text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Import Another File
              </Button>

              <Link href="/app/leads">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-xs text-white shadow-xs">
                  View Leads List <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

