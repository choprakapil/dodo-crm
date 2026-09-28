/**
 * Lead Export Query Validation Schema
 */

import { z } from "zod";
import { LeadPriority } from "@prisma/client";

export const leadExportQuerySchema = z.object({
  search: z.string().trim().optional(),
  statusId: z.string().trim().optional(),
  sourceId: z.string().trim().optional(),
  priority: z.nativeEnum(LeadPriority).optional(),
  assignedUserId: z.string().trim().optional(),
  teamId: z.string().trim().optional(),
});

export type LeadExportQuery = z.infer<typeof leadExportQuerySchema>;
