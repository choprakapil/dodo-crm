/**
 * Industry Template Types & Contracts (Phase B.3)
 *
 * Defines the contract for code-defined, versioned, declarative templates.
 * System templates are blueprints that configure standard tenant-owned CRM entities
 * (CustomFields, Dispositions, LeadSources, LeadStatuses, Offerings) without hardcoded
 * industry logic in core CRM services.
 */

import { CustomFieldType } from "@prisma/client";

export interface TemplateMetadata {
  key: string;
  name: string;
  description: string;
  version: number;
  category: string;
  active: boolean;
  iconName?: string;
  highlights?: string[];
}

export interface TemplateCustomFieldConfig {
  entityType: "LEAD" | "CUSTOMER";
  key: string;
  label: string;
  description?: string;
  fieldType: CustomFieldType;
  required?: boolean;
  sortOrder?: number;
  options?: string[];
}

export interface TemplateDispositionConfig {
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
  requiresNotes?: boolean;
  followUpMandatory?: boolean;
  defaultFollowUpDays?: number;
  cancelActiveFollowUp?: boolean;
  allowEnquiryCreation?: boolean;
  triggersConversion?: boolean;
}

export interface TemplateLeadSourceConfig {
  name: string;
}

export interface TemplateLeadStatusConfig {
  name: string;
  displayOrder: number;
  color?: string;
  isDefault?: boolean;
}

export interface TemplateOfferingConfig {
  name: string;
  code: string;
  description?: string;
  type: "PRODUCT" | "SERVICE";
  price?: number;
  category?: string;
}

export interface TemplateApplyOptions {
  forceSwitch?: boolean;
}

export interface IndustryTemplateDefinition {
  metadata: TemplateMetadata;
  configuration: {
    customFields: TemplateCustomFieldConfig[];
    dispositions: TemplateDispositionConfig[];
    leadSources: TemplateLeadSourceConfig[];
    leadStatuses?: TemplateLeadStatusConfig[];
    offerings?: TemplateOfferingConfig[];
    historyPreviewFields?: string[];
  };
}

export type TemplateItemStatus = "CREATE" | "SKIP_MATCH" | "CONFLICT";

export interface TemplateItemAnalysis<T = any> {
  name: string;
  key?: string;
  type: "CUSTOM_FIELD" | "DISPOSITION" | "LEAD_SOURCE" | "LEAD_STATUS" | "OFFERING";
  status: TemplateItemStatus;
  reason?: string;
  definition: T;
}

export interface TemplatePreviewReport {
  template: TemplateMetadata;
  companyId: string;
  canApply: boolean;
  summary: {
    fieldsToCreate: number;
    fieldsSkipped: number;
    dispositionsToCreate: number;
    dispositionsSkipped: number;
    sourcesToCreate: number;
    sourcesSkipped: number;
    statusesToCreate: number;
    statusesSkipped: number;
    offeringsToCreate: number;
    offeringsSkipped: number;
    conflictsCount: number;
  };
  items: TemplateItemAnalysis[];
  conflicts: Array<{
    type: string;
    key: string;
    existing: string;
    template: string;
    message: string;
  }>;
  isTemplateSwitch?: boolean;
  currentTemplateKey?: string | null;
}

export interface TemplateApplicationResult {
  success: boolean;
  templateKey: string;
  templateVersion: number;
  appliedAt: Date;
  action?: "template.applied" | "template.reapplied" | "template.upgraded" | "template.switched";
  created: {
    customFields: number;
    dispositions: number;
    leadSources: number;
    leadStatuses: number;
    offerings: number;
  };
  skipped: {
    customFields: number;
    dispositions: number;
    leadSources: number;
    leadStatuses: number;
    offerings: number;
  };
}
