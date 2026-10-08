/**
 * Intelligent CSV Header Detector & Auto-Mapping Engine for DODO CRM
 *
 * Provides deterministic, multi-level matching:
 * 1. Exact canonical core field names (HIGH confidence)
 * 2. Exact normalized core field names (HIGH confidence)
 * 3. High-confidence known aliases (HIGH confidence)
 * 4. Exact tenant custom field keys and labels (HIGH confidence)
 * 5. Normalized tenant custom field keys and labels (HIGH / MEDIUM confidence)
 * 6. Semantic & secondary aliases (MEDIUM confidence)
 * 7. Ambiguous headers (LOW confidence / NEEDS_REVIEW)
 * 8. Duplicate destination conflict detection (CONFLICT status)
 * 9. Unmatched headers (UNMAPPED status)
 */

export type HeaderConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type HeaderMatchStatus =
  | "AUTO_MATCHED"
  | "REVIEW_SUGGESTED"
  | "NEEDS_REVIEW"
  | "CONFLICT"
  | "UNMAPPED";

export interface HeaderDetectionResult {
  header: string;
  originalHeader: string;
  suggestedField: string | null;
  confidence: HeaderConfidence;
  status: HeaderMatchStatus;
  matchReason: string;
  conflictWith?: string[];
  isCustomField: boolean;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  fieldType?: string;
  required?: boolean;
}

export interface CoreFieldDefinition {
  key: string;
  label: string;
  required: boolean;
  exactNames: string[];
  highConfidenceAliases: string[];
  mediumConfidenceAliases: string[];
  ambiguousAliases?: string[];
}

export interface IntelligentDetectionSummary {
  detections: HeaderDetectionResult[];
  suggestedMappings: Record<string, string>;
  conflicts: Array<{ field: string; headers: string[] }>;
  hasConflicts: boolean;
  unmappedCount: number;
  highConfidenceCount: number;
  reviewCount: number;
  conflictCount: number;
}

/**
 * Normalizes CSV headers for consistent comparison.
 * Strips special characters, hyphens, underscores, extra spaces, and lowercases.
 */
export function normalizeHeader(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .toLowerCase()
    .trim()
    .replace(/[\-_:./\\()[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Standard DODO CRM Lead Core Fields & Alias Registry
 */
export const CORE_IMPORT_FIELDS: Record<string, CoreFieldDefinition> = {
  name: {
    key: "name",
    label: "Lead Name",
    required: true,
    exactNames: [
      "name",
      "lead name",
      "lead_name",
      "full name",
      "fullname",
      "contact name",
      "client name",
      "customer name",
      "prospect name",
      "person name",
      "lead",
    ],
    highConfidenceAliases: [
      "first and last name",
      "contact_name",
      "customer_name",
      "lead full name",
      "client_name",
      "prospect_name",
    ],
    mediumConfidenceAliases: [
      "first name",
      "firstname",
      "first_name",
      "contact",
      "person",
      "subscriber",
      "lead_contact",
    ],
    ambiguousAliases: ["title", "subject", "profile", "account_holder"],
  },
  email: {
    key: "email",
    label: "Email Address",
    required: false,
    exactNames: [
      "email",
      "email address",
      "email_address",
      "e-mail",
      "e mail",
      "e mail address",
      "work email",
      "mail",
      "contact email",
      "primary email",
      "email id",
      "email-id",
      "email_id",
      "e_mail",
    ],
    highConfidenceAliases: [
      "corporate email",
      "business email",
      "user email",
      "customer email",
      "client email",
      "electronic mail",
      "work email",
      "work_email",
      "personal email",
      "personal_email",
    ],
    mediumConfidenceAliases: [
      "secondary email",
      "alt email",
      "alternate email",
      "inbox",
    ],
    ambiguousAliases: ["id", "contact_id", "account_id"],
  },
  phone: {
    key: "phone",
    label: "Phone Number",
    required: false,
    exactNames: [
      "phone",
      "phone number",
      "phone_number",
      "mobile",
      "mobile number",
      "mobile_number",
      "mobile phone",
      "mobile_phone",
      "telephone",
      "tel",
      "contact number",
      "contact phone",
      "cell",
      "cell phone",
      "cellphone",
      "whatsapp",
      "whatsapp number",
      "primary phone",
      "work phone",
    ],
    highConfidenceAliases: [
      "contact_no",
      "phone_no",
      "mobile_no",
      "tel_no",
      "call number",
      "direct phone",
      "official phone",
      "customer phone",
      "client phone",
      "phone_num",
      "mobile_num",
      "telephone number",
    ],
    mediumConfidenceAliases: [
      "phone1",
      "phone_1",
      "tel1",
      "alt phone",
      "alternate phone",
      "emergency phone",
      "fax",
      "hotline",
      "office phone",
    ],
    ambiguousAliases: ["number", "digits", "line", "extension", "ext"],
  },
  company: {
    key: "company",
    label: "Company / Organization",
    required: false,
    exactNames: [
      "company",
      "company name",
      "company_name",
      "organization",
      "organisation",
      "org",
      "business",
      "account",
      "account name",
      "employer",
      "firm",
      "corporate",
    ],
    highConfidenceAliases: [
      "org name",
      "org_name",
      "business name",
      "client company",
      "client business",
      "customer company",
      "agency",
      "institution",
      "enterprise",
      "company_title",
    ],
    mediumConfidenceAliases: [
      "workplace",
      "work",
      "brand",
      "client",
      "merchant",
      "vendor",
      "org_title",
    ],
    ambiguousAliases: ["domain", "location", "group", "entity", "work_location"],
  },
  amount: {
    key: "amount",
    label: "Deal Value / Amount",
    required: false,
    exactNames: [
      "amount",
      "deal value",
      "deal_value",
      "value",
      "deal amount",
      "budget",
      "price",
      "expected revenue",
      "revenue",
      "worth",
      "opportunity amount",
      "lead value",
    ],
    highConfidenceAliases: [
      "deal size",
      "contract value",
      "project value",
      "quoted amount",
      "opportunity value",
      "estimated value",
      "cost",
      "total amount",
      "budget_amount",
      "pipeline value",
    ],
    mediumConfidenceAliases: [
      "turnover",
      "fee",
      "val",
      "monetary value",
      "quote",
      "expected_amount",
    ],
    ambiguousAliases: ["balance", "rate", "score", "metric", "unit_price"],
  },
  priority: {
    key: "priority",
    label: "Priority (LOW, MEDIUM, HIGH, URGENT)",
    required: false,
    exactNames: [
      "priority",
      "lead priority",
      "urgency",
      "importance",
      "severity",
    ],
    highConfidenceAliases: [
      "priority level",
      "urgency level",
      "priority status",
      "lead_priority",
      "lead_urgency",
    ],
    mediumConfidenceAliases: ["rank", "tier", "grade", "level", "lead_rank"],
    ambiguousAliases: ["rating", "flag", "tag", "category"],
  },
  status: {
    key: "status",
    label: "Status Name",
    required: false,
    exactNames: [
      "status",
      "lead status",
      "stage",
      "pipeline stage",
      "lead stage",
      "state",
    ],
    highConfidenceAliases: [
      "pipeline status",
      "current stage",
      "deal stage",
      "sales stage",
      "funnel stage",
      "lead_status",
    ],
    mediumConfidenceAliases: [
      "step",
      "progress",
      "milestone",
      "condition",
      "current_status",
    ],
    ambiguousAliases: ["phase", "mode"],
  },
  source: {
    key: "source",
    label: "Source Name",
    required: false,
    exactNames: [
      "source",
      "lead source",
      "channel",
      "lead origin",
      "origin",
      "medium",
      "campaign source",
      "utm_source",
    ],
    highConfidenceAliases: [
      "lead channel",
      "acquisition source",
      "referral source",
      "marketing source",
      "campaign",
      "utm source",
      "lead_source",
      "inbound source",
    ],
    mediumConfidenceAliases: [
      "referrer",
      "platform",
      "inbound from",
      "provider",
      "how heard",
      "lead_medium",
    ],
    ambiguousAliases: ["type", "kind", "method", "class"],
  },
  assignedUser: {
    key: "assignedUser",
    label: "Assigned User (Email or Name)",
    required: false,
    exactNames: [
      "assigned user",
      "assigned_user",
      "assignee",
      "owner",
      "lead owner",
      "sales rep",
      "agent",
      "assigned to",
      "representative",
    ],
    highConfidenceAliases: [
      "assigned agent",
      "account owner",
      "lead assignee",
      "sales agent",
      "assigned_to",
      "assigned_rep",
      "handler",
      "sales_person",
    ],
    mediumConfidenceAliases: [
      "rep",
      "manager",
      "staff",
      "executive",
      "salesperson",
      "assigned_staff",
    ],
    ambiguousAliases: ["creator", "editor", "author", "user", "admin"],
  },
  team: {
    key: "team",
    label: "Team Name",
    required: false,
    exactNames: [
      "team",
      "team name",
      "team_name",
      "department",
      "group",
      "sales team",
      "division",
    ],
    highConfidenceAliases: [
      "assigned team",
      "unit",
      "squad",
      "branch",
      "territory",
      "regional team",
      "sales_group",
    ],
    mediumConfidenceAliases: ["dept", "crew", "cell", "desk", "business_unit"],
    ambiguousAliases: ["cluster", "zone", "region", "area"],
  },
};

/**
 * Intelligent Header Auto-Detection Engine
 *
 * Scans CSV headers against core CRM fields and active tenant custom fields,
 * producing structured confidence ratings, conflict detection, and match explanations.
 */
export function detectIntelligentHeaders(
  csvHeaders: string[],
  customFields: CustomFieldDefinition[] = []
): IntelligentDetectionSummary {
  const initialDetections: HeaderDetectionResult[] = [];

  // Pass 1: Individual column matching
  for (const rawHeader of csvHeaders) {
    const norm = normalizeHeader(rawHeader);

    if (!norm) {
      initialDetections.push({
        header: rawHeader,
        originalHeader: rawHeader,
        suggestedField: null,
        confidence: "NONE",
        status: "UNMAPPED",
        matchReason: "Empty or whitespace header",
        isCustomField: false,
      });
      continue;
    }

    let detected: HeaderDetectionResult | null = null;

    // 1. Exact Canonical Core Match (HIGH)
    for (const [fieldKey, def] of Object.entries(CORE_IMPORT_FIELDS)) {
      if (rawHeader.toLowerCase().trim() === fieldKey.toLowerCase()) {
        detected = {
          header: rawHeader,
          originalHeader: rawHeader,
          suggestedField: fieldKey,
          confidence: "HIGH",
          status: "AUTO_MATCHED",
          matchReason: `Exact match for "${def.label}"`,
          isCustomField: false,
        };
        break;
      }
    }

    // 2. Exact Normalized Core Match (HIGH)
    if (!detected) {
      for (const [fieldKey, def] of Object.entries(CORE_IMPORT_FIELDS)) {
        if (def.exactNames.map(normalizeHeader).includes(norm)) {
          detected = {
            header: rawHeader,
            originalHeader: rawHeader,
            suggestedField: fieldKey,
            confidence: "HIGH",
            status: "AUTO_MATCHED",
            matchReason: `High-confidence match for "${def.label}"`,
            isCustomField: false,
          };
          break;
        }
      }
    }

    // 3. High-Confidence Known Aliases (HIGH)
    if (!detected) {
      for (const [fieldKey, def] of Object.entries(CORE_IMPORT_FIELDS)) {
        if (def.highConfidenceAliases.map(normalizeHeader).includes(norm)) {
          detected = {
            header: rawHeader,
            originalHeader: rawHeader,
            suggestedField: fieldKey,
            confidence: "HIGH",
            status: "AUTO_MATCHED",
            matchReason: `Matched alias for "${def.label}"`,
            isCustomField: false,
          };
          break;
        }
      }
    }

    // 4. Exact Tenant Custom Field Key or Label Match (HIGH)
    if (!detected) {
      for (const cf of customFields) {
        const cfKeyNorm = normalizeHeader(cf.key);
        const cfLabelNorm = normalizeHeader(cf.label);

        if (norm === cfKeyNorm || norm === cfLabelNorm || norm === `cf ${cfKeyNorm}`) {
          detected = {
            header: rawHeader,
            originalHeader: rawHeader,
            suggestedField: `cf_${cf.key}`,
            confidence: "HIGH",
            status: "AUTO_MATCHED",
            matchReason: `Matched custom field "${cf.label}"`,
            isCustomField: true,
          };
          break;
        }
      }
    }

    // 5. Medium-Confidence Core Field Aliases (MEDIUM)
    if (!detected) {
      for (const [fieldKey, def] of Object.entries(CORE_IMPORT_FIELDS)) {
        if (def.mediumConfidenceAliases.map(normalizeHeader).includes(norm)) {
          detected = {
            header: rawHeader,
            originalHeader: rawHeader,
            suggestedField: fieldKey,
            confidence: "MEDIUM",
            status: "REVIEW_SUGGESTED",
            matchReason: `Suggested match for "${def.label}" (Review recommended)`,
            isCustomField: false,
          };
          break;
        }
      }
    }

    // 6. Ambiguous Header Check (LOW / NEEDS_REVIEW)
    if (!detected) {
      for (const [fieldKey, def] of Object.entries(CORE_IMPORT_FIELDS)) {
        if (def.ambiguousAliases?.map(normalizeHeader).includes(norm)) {
          detected = {
            header: rawHeader,
            originalHeader: rawHeader,
            suggestedField: fieldKey,
            confidence: "LOW",
            status: "NEEDS_REVIEW",
            matchReason: `Ambiguous header "${rawHeader}" may match "${def.label}". Confirmation required.`,
            isCustomField: false,
          };
          break;
        }
      }
    }

    // 7. Unmatched / Unknown
    if (!detected) {
      detected = {
        header: rawHeader,
        originalHeader: rawHeader,
        suggestedField: null,
        confidence: "NONE",
        status: "UNMAPPED",
        matchReason: `No automatic mapping detected for "${rawHeader}"`,
        isCustomField: false,
      };
    }

    initialDetections.push(detected);
  }

  // Pass 2: Conflict & Duplicate Destination Detection
  const fieldToHeadersMap = new Map<string, string[]>();
  for (const item of initialDetections) {
    if (item.suggestedField) {
      const existing = fieldToHeadersMap.get(item.suggestedField) || [];
      existing.push(item.header);
      fieldToHeadersMap.set(item.suggestedField, existing);
    }
  }

  const conflicts: Array<{ field: string; headers: string[] }> = [];
  const conflictingFields = new Set<string>();

  for (const [field, headers] of fieldToHeadersMap.entries()) {
    if (headers.length > 1) {
      conflicts.push({ field, headers });
      conflictingFields.add(field);
    }
  }

  const finalDetections: HeaderDetectionResult[] = [];
  const suggestedMappings: Record<string, string> = {};

  let unmappedCount = 0;
  let highConfidenceCount = 0;
  let reviewCount = 0;
  let conflictCount = 0;

  for (const item of initialDetections) {
    if (item.suggestedField && conflictingFields.has(item.suggestedField)) {
      const otherHeaders = (fieldToHeadersMap.get(item.suggestedField) || []).filter(
        (h) => h !== item.header
      );

      finalDetections.push({
        ...item,
        status: "CONFLICT",
        conflictWith: otherHeaders,
        matchReason: `Multiple columns (${item.header}, ${otherHeaders.join(", ")}) map to the same field. Choose which column to import.`,
      });
      conflictCount++;
      suggestedMappings[item.header] = item.suggestedField;
    } else {
      finalDetections.push(item);
      if (item.suggestedField) {
        suggestedMappings[item.header] = item.suggestedField;
        if (item.confidence === "HIGH") highConfidenceCount++;
        if (item.confidence === "MEDIUM" || item.confidence === "LOW") reviewCount++;
      } else {
        unmappedCount++;
      }
    }
  }

  return {
    detections: finalDetections,
    suggestedMappings,
    conflicts,
    hasConflicts: conflicts.length > 0,
    unmappedCount,
    highConfidenceCount,
    reviewCount,
    conflictCount,
  };
}

/**
 * Backward-compatible helper returning a simple Record<string, string>
 */
export function detectColumnMappings(
  csvHeaders: string[],
  customFields: CustomFieldDefinition[] = []
): Record<string, string> {
  const result = detectIntelligentHeaders(csvHeaders, customFields);
  return result.suggestedMappings;
}
