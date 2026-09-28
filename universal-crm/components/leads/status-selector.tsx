"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface StatusSelectorProps {
  leadId: string;
  currentStatusId: string | null;
  statuses: Array<{ id: string; name: string; color: string }>;
  onUpdated?: (newStatusId: string) => void;
}

export function StatusSelector({
  leadId,
  currentStatusId,
  statuses,
  onUpdated,
}: StatusSelectorProps) {
  const router = useRouter();
  const [statusId, setStatusId] = useState(currentStatusId || "");
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatusId = e.target.value;
    setStatusId(newStatusId);
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: newStatusId }),
      });

      if (!res.ok) {
        // Revert on error
        setStatusId(currentStatusId || "");
      } else {
        onUpdated?.(newStatusId);
        router.refresh();
      }
    } catch {
      setStatusId(currentStatusId || "");
    } finally {
      setIsUpdating(false);
    }
  }

  const currentStatus = statuses.find((s) => s.id === statusId);

  return (
    <div className="relative inline-flex items-center">
      <select
        value={statusId}
        disabled={isUpdating}
        onChange={handleChange}
        style={{
          borderColor: currentStatus?.color ? `${currentStatus.color}40` : undefined,
          backgroundColor: currentStatus?.color ? `${currentStatus.color}15` : undefined,
          color: currentStatus?.color || "#cbd5e1",
        }}
        className="h-7 rounded-md border px-2 text-[11px] font-medium outline-none transition disabled:opacity-50 cursor-pointer"
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
            {s.name}
          </option>
        ))}
      </select>
      {isUpdating && (
        <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin text-slate-400 pointer-events-none" />
      )}
    </div>
  );
}
