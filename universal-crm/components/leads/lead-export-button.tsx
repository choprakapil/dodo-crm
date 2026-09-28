"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

export function LeadExportButton() {
  const searchParams = useSearchParams();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const queryString = searchParams.toString();
      const exportUrl = queryString
        ? `/api/v1/leads/export?${queryString}`
        : "/api/v1/leads/export";

      const res = await fetch(exportUrl);
      if (!res.ok) {
        alert("Failed to export leads");
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("content-disposition");
      let filename = "leads_export.csv";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch {
      alert("Network error during CSV export");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="border-slate-800 text-xs text-slate-300 hover:text-white"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </>
      )}
    </Button>
  );
}
