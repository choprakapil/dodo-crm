import React from "react";

export type BulkActionVariant = "default" | "outline" | "secondary" | "warning" | "destructive";

export type BulkConfirmType = "simple" | "reason" | "select" | "typed_delete";

export interface BulkSelectOption {
  label: string;
  value: string;
  description?: string;
}

export interface BulkAction<T = any> {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: BulkActionVariant;
  destructive?: boolean;
  requiresConfirmation?: boolean;
  confirmType?: BulkConfirmType;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmPlaceholder?: string;
  selectOptions?: BulkSelectOption[];
  selectLabel?: string;
  permission?: string;
  isVisible?: (selectedItems: T[]) => boolean;
  onCustomClick?: (selectedIds: string[]) => void;
  onExecute: (selectedIds: string[], extraData?: any) => Promise<BulkActionResult>;
}

export interface BulkActionResult {
  success: boolean;
  action?: string;
  total: number;
  succeededCount: number;
  skippedCount?: number;
  failedCount: number;
  message?: string;
  succeeded?: string[];
  skipped?: Array<{ id: string; reason: string }>;
  failed?: Array<{ id: string; error: string }>;
}

export interface BulkSelectionState<T = any> {
  selectedIds: Set<string>;
  selectedItems: T[];
  selectedCount: number;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  toggleSelect: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
  selectAllAcrossPages?: () => void;
  isAllAcrossPagesSelected?: boolean;
}
