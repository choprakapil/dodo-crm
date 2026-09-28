"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AssignSelectorProps {
  leadId: string;
  currentUserId: string | null;
  users: Array<{ id: string; name: string; email: string }>;
  onUpdated?: (newUserId: string | null) => void;
}

export function AssignSelector({
  leadId,
  currentUserId,
  users,
  onUpdated,
}: AssignSelectorProps) {
  const router = useRouter();
  const [userId, setUserId] = useState(currentUserId || "");
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const rawVal = e.target.value;
    const newUserId = rawVal === "" ? null : rawVal;
    setUserId(rawVal);
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/v1/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserId: newUserId }),
      });

      if (!res.ok) {
        setUserId(currentUserId || "");
      } else {
        onUpdated?.(newUserId);
        router.refresh();
      }
    } catch {
      setUserId(currentUserId || "");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={userId}
        disabled={isUpdating}
        onChange={handleChange}
        className="h-7 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] text-slate-300 outline-none transition hover:border-slate-700 disabled:opacity-50 cursor-pointer max-w-[140px] truncate"
      >
        <option value="" className="text-slate-500">
          Unassigned
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id} className="text-slate-200">
            {u.name}
          </option>
        ))}
      </select>
      {isUpdating && (
        <Loader2 className="absolute right-1.5 h-3 w-3 animate-spin text-slate-400 pointer-events-none" />
      )}
    </div>
  );
}
