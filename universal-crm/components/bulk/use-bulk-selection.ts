"use client";

import { useState, useMemo, useCallback } from "react";
import { BulkSelectionState } from "./types";

export interface UseBulkSelectionOptions<T> {
  items: T[];
  getItemId?: (item: T) => string;
}

export function useBulkSelection<T extends { id?: string } = any>(
  options: UseBulkSelectionOptions<T>
): BulkSelectionState<T> {
  const { items, getItemId = (item: any) => item.id || "" } = options;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visibleIds = useMemo(() => {
    return items.map(getItemId).filter(Boolean);
  }, [items, getItemId]);

  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(getItemId(item)));
  }, [items, selectedIds, getItemId]);

  const selectedCount = selectedIds.size;

  const isAllSelected = useMemo(() => {
    if (visibleIds.length === 0) return false;
    return visibleIds.every((id) => selectedIds.has(id));
  }, [visibleIds, selectedIds]);

  const isSomeSelected = useMemo(() => {
    if (isAllSelected) return false;
    return visibleIds.some((id) => selectedIds.has(id));
  }, [visibleIds, selectedIds, isAllSelected]);

  const toggleSelect = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    []
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allCurrentVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allCurrentVisibleSelected) {
        // Deselect current visible items
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      } else {
        // Select all current visible items
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    selectedItems,
    selectedCount,
    isAllSelected,
    isSomeSelected,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
  };
}
