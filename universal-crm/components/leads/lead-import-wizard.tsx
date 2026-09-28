"use client";

import { useState } from "react";
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
  Loader2,
  Download,
  RotateCcw,
  HelpCircle,
} from "lucide-react";

interface FieldOption {
  key: string;
  label: string;
  required: boolean;
  isCustom: boolean;
}

interface PreviewData {
  filename: string;
  totalRows: number;
  detectedHeaders: string[];
  suggestedMappings: Record<string, string>;
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
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
            <span>Import Leads from CSV</span>
            <Link
              href="/app/help?article=import-export"
              className="text-slate-500 hover:text-indigo-400 transition ml-1"
              title="Import & Export Help Guide"
            >
              <HelpCircle className="h-4 w-4" />
            </Link>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
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
                  ? "bg-indigo-600 text-white"
                  : step > s.num
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800/60 text-slate-500"
              }`}
            >
              <span>{s.num}.</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="h-4 w-4 text-indigo-400" /> Select CSV File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-8 text-center bg-slate-950/40 transition">
                <FileSpreadsheet className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                <p className="text-xs text-slate-300 font-medium">
                  Drag and drop your .csv file here, or click to browse
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supported format: RFC 4180 CSV (up to 10 MB / 50,000 rows)
                </p>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="mt-4 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Or paste raw CSV text:</label>
                <textarea
                  className="w-full min-h-[120px] rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 font-mono outline-none focus:border-indigo-500"
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
                  className="border-slate-800 text-xs text-slate-300 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Download Sample CSV
                </Button>

                <Button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing || !csvContent.trim()}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
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
          <Card className="border-slate-800 bg-slate-900/40 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Import Rules & Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-400 leading-relaxed">
              <div className="space-y-1">
                <div className="text-slate-200 font-medium">1. Required Field</div>
                <div>Every row must contain a valid <strong>Lead Name</strong>.</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-200 font-medium">2. Duplicate Protection</div>
                <div>Duplicates are matched by Email or Phone. You choose to skip, update, or create on step 3.</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-200 font-medium">3. Custom Fields</div>
                <div>Custom fields defined for your company are automatically detected and mapped.</div>
              </div>
              <div className="space-y-1">
                <div className="text-slate-200 font-medium">4. Tenant Isolation</div>
                <div>All imported leads strictly belong to your active company account.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: PREVIEW & MAP */}
      {step === 2 && previewData && (
        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-white">
                  Map CSV Columns to CRM Fields
                </CardTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  File: <strong className="text-slate-200">{previewData.filename}</strong> (
                  {previewData.totalRows} detected rows)
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Mapping Table */}
              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">CSV Column Header</th>
                      <th className="py-2.5 px-4 font-semibold">Sample Row 1</th>
                      <th className="py-2.5 px-4 font-semibold">CRM Field Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {previewData.detectedHeaders.map((header) => {
                      const sampleVal = previewData.sampleRows[0]?.[header] ?? "";
                      const currentMappedKey = columnMappings[header] || "";

                      return (
                        <tr key={header} className="hover:bg-slate-800/20">
                          <td className="py-2.5 px-4 font-medium text-white">{header}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                            {sampleVal || <span className="text-slate-600 italic">—</span>}
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
                              className="w-full max-w-xs h-8 rounded-lg border border-slate-800 bg-slate-950 px-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500"
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
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Sample Rows Preview (First 5 Rows)
                </h4>
                <div className="rounded-lg border border-slate-800 overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-[10px] text-slate-400">
                      <tr>
                        {previewData.detectedHeaders.map((h) => (
                          <th key={h} className="py-2 px-3">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {previewData.sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20">
                          {previewData.detectedHeaders.map((h) => (
                            <td key={h} className="py-2 px-3 text-[11px] truncate max-w-[150px]">
                              {row[h] || <span className="text-slate-600">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="border-slate-800 text-xs text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                </Button>

                <Button
                  type="button"
                  onClick={handleProceedToSettings}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
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
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur max-w-2xl mx-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white">
              Duplicate Handling Strategy
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
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
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="duplicateStrategy"
                    value={opt.id}
                    checked={duplicateStrategy === opt.id}
                    onChange={() => setDuplicateStrategy(opt.id as "SKIP" | "UPDATE" | "CREATE")}
                    className="mt-0.5 h-4 w-4 border-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-white">{opt.title}</div>
                    <div className="text-[11px] text-slate-400">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
              Ready to import <strong>{previewData?.totalRows}</strong> rows into{" "}
              <strong>Acme Corp</strong>. All operations will be validated server-side.
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep(2)}
                className="border-slate-800 text-xs text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Mapping
              </Button>

              <Button
                type="button"
                onClick={handleExecuteImport}
                disabled={isExecuting}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white"
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
        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur max-w-3xl mx-auto">
          <CardHeader className="pb-3 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <CardTitle className="text-base font-bold text-white">Import Completed</CardTitle>
            <p className="text-xs text-slate-400">
              Status: <span className="font-mono text-emerald-300">{result.status}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  Total
                </div>
                <div className="text-lg font-bold text-white mt-1">{result.totalRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
                <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold">
                  Created
                </div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  {result.successfulRows}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10">
                <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold">
                  Updated
                </div>
                <div className="text-lg font-bold text-blue-400 mt-1">{result.updatedRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10">
                <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                  Skipped
                </div>
                <div className="text-lg font-bold text-amber-400 mt-1">{result.skippedRows}</div>
              </div>
              <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10">
                <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold">
                  Failed
                </div>
                <div className="text-lg font-bold text-rose-400 mt-1">{result.failedRows}</div>
              </div>
            </div>

            {/* Error table if failed > 0 */}
            {result.failedRows > 0 && result.errorSummary && result.errorSummary.length > 0 && (
              <div className="space-y-2 border border-rose-500/20 bg-rose-500/5 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" /> Error Details ({result.failedRows} rows failed)
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={downloadErrorCsv}
                    className="border-rose-500/30 text-rose-300 text-xs hover:bg-rose-500/10"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Download Errors CSV
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-950 text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-slate-300 text-[11px]">
                      {result.errorSummary.slice(0, 50).map((err, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-mono text-slate-400">{err.row}</td>
                          <td className="py-2 px-3 text-rose-300">{err.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setCsvContent("");
                  setResult(null);
                }}
                className="border-slate-800 text-xs text-slate-400 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Import Another File
              </Button>

              <Link href="/app/leads">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-xs text-white">
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
