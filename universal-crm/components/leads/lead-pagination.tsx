"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function LeadPagination({
  page,
  pageSize,
  total,
  totalPages,
  hasNextPage,
  hasPreviousPage,
}: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToPage(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(targetPage));
    router.push(`/app/leads?${params.toString()}`);
  }

  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 px-1 py-2">
      <div>
        Showing <span className="font-semibold text-slate-800">{startIdx}</span> to{" "}
        <span className="font-semibold text-slate-800">{endIdx}</span> of{" "}
        <span className="font-semibold text-slate-800">{total}</span> leads
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPreviousPage}
          onClick={() => goToPage(page - 1)}
          className="h-8 border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 text-xs px-2.5 shadow-2xs"
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          Previous
        </Button>

        <span className="text-slate-500 px-2 font-mono">
          Page {page} of {Math.max(1, totalPages)}
        </span>

        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage}
          onClick={() => goToPage(page + 1)}
          className="h-8 border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 text-xs px-2.5 shadow-2xs"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
