/**
 * RFC 4180 Compliant CSV Utilities with Formula Injection Protection
 *
 * Lightweight, zero-dependency, safe for multi-tenant SaaS data operations.
 */

/**
 * Characters that could trigger spreadsheet formula execution if at the beginning of a cell.
 */
const FORMULA_TRIGGER_CHARS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Safely sanitizes a string value to prevent CSV Formula Injection in Excel, Sheets, and Calc.
 * If the value begins with any trigger character, prepends a single quote (').
 */
export function sanitizeFormulaInjection(value: string): string {
  if (!value || typeof value !== "string") return value;
  const trimmed = value.trimStart();
  if (trimmed.length > 0 && FORMULA_TRIGGER_CHARS.includes(trimmed[0])) {
    return `'${value}`;
  }
  return value;
}

/**
 * RFC 4180 compliant CSV Parser.
 * Properly handles quoted fields, escaped quotes (""), commas, and newlines inside quoted fields.
 */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  if (!text || text.trim().length === 0) {
    return { headers: [], rows: [] };
  }

  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && text[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
        i++;
        continue;
      } else if (char === "\r") {
        // Handle CRLF
        if (i + 1 < len && text[i + 1] === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        lines.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        lines.push(currentRow);
        currentRow = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push remainder
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    lines.push(currentRow);
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Clean raw headers
  const rawHeaders = lines[0].map((h) => h.trim());
  const headers = rawHeaders.filter((h) => h.length > 0);

  const rows: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const rowData = lines[r];
    // Skip completely empty lines
    if (rowData.length === 0 || (rowData.length === 1 && rowData[0].trim() === "")) {
      continue;
    }

    const rowObj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      rowObj[header] = (rowData[c] ?? "").trim();
    }
    rows.push(rowObj);
  }

  return { headers, rows };
}

export interface CsvColumnDefinition {
  key: string;
  label: string;
}

/**
 * Serializes an array of records to RFC 4180 CSV format with formula injection protection.
 */
export function serializeCsv(
  rows: Record<string, unknown>[],
  columns?: (string | CsvColumnDefinition)[]
): string {
  if (rows.length === 0 && (!columns || columns.length === 0)) {
    return "";
  }

  let colDefs: CsvColumnDefinition[];

  if (columns && columns.length > 0) {
    colDefs = columns.map((c) => (typeof c === "string" ? { key: c, label: c } : c));
  } else {
    // Derive from first row keys
    colDefs = Object.keys(rows[0] ?? {}).map((k) => ({ key: k, label: k }));
  }

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    let str: string;
    if (typeof val === "object") {
      if (val instanceof Date) {
        str = val.toISOString();
      } else if (Array.isArray(val)) {
        str = val.join("; ");
      } else {
        str = JSON.stringify(val);
      }
    } else {
      str = String(val);
    }

    // Formula injection protection
    str = sanitizeFormulaInjection(str);

    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  };

  const headerLine = colDefs.map((c) => formatCell(c.label)).join(",");
  const dataLines = rows.map((row) =>
    colDefs.map((c) => formatCell(row[c.key])).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Auto-detects column mappings between CSV headers and CRM fields (core fields + custom fields).
 */
export function detectColumnMappings(
  csvHeaders: string[],
  customFields: Array<{ key: string; label: string }> = []
): Record<string, string> {
  const mappings: Record<string, string> = {};

  const normalizedCoreFields: Record<string, string[]> = {
    name: ["name", "lead name", "lead_name", "full name", "fullname", "contact name", "client name"],
    email: ["email", "email address", "email_address", "e-mail", "e mail", "e mail address", "work email", "mail"],
    phone: ["phone", "phone number", "phone_number", "mobile", "mobile number", "telephone", "contact number"],
    company: ["company", "company name", "organization", "org", "business", "account"],
    amount: ["amount", "deal value", "deal_value", "value", "deal amount", "budget"],
    priority: ["priority", "lead priority", "urgency"],
    status: ["status", "lead status", "stage"],
    source: ["source", "lead source", "channel"],
    assignedUser: ["assigned user", "assigned_user", "assignee", "owner", "sales rep"],
    team: ["team", "team name", "team_name", "department"],
  };

  for (const header of csvHeaders) {
    const norm = header.toLowerCase().replace(/[-_]/g, " ").trim();

    let matched = false;

    // Check core fields
    for (const [fieldKey, aliases] of Object.entries(normalizedCoreFields)) {
      if (aliases.includes(norm) || norm === fieldKey.toLowerCase()) {
        mappings[header] = fieldKey;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Check custom fields by key or label
    for (const cf of customFields) {
      const cfKeyNorm = cf.key.toLowerCase().replace(/[-_]/g, " ").trim();
      const cfLabelNorm = cf.label.toLowerCase().replace(/[-_]/g, " ").trim();

      if (norm === cfKeyNorm || norm === cfLabelNorm) {
        mappings[header] = `cf_${cf.key}`;
        matched = true;
        break;
      }
    }
  }

  return mappings;
}
