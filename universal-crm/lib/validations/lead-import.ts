/**
 * Lead Import Validation Schemas
 */

import { z } from "zod";

export const leadImportPreviewSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  filename: z.string().min(1).default("import.csv"),
});

export const duplicateStrategyEnum = z.enum(["SKIP", "UPDATE", "CREATE"]);

export const leadImportExecuteSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
  filename: z.string().min(1).default("import.csv"),
  columnMappings: z.record(z.string(), z.string()),
  duplicateStrategy: duplicateStrategyEnum.default("SKIP"),
});

export type LeadImportPreviewInput = z.infer<typeof leadImportPreviewSchema>;
export type LeadImportExecuteInput = z.infer<typeof leadImportExecuteSchema>;
export type DuplicateStrategy = z.infer<typeof duplicateStrategyEnum>;
