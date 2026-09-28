/**
 * Unit Tests for Custom Fields and RFC 4180 CSV Engine
 */

import assert from "node:assert/strict";
import {
  customFieldCreateSchema,
  validateCustomFieldValue,
} from "../lib/validations/custom-field";
import { parseCsv, serializeCsv, sanitizeFormulaInjection } from "../lib/utils/csv";
import { ValidationError } from "../lib/errors";

export async function runCustomFieldUnitTests() {
  console.log("\n🧪 Running Custom Field & CSV Unit Tests...");

  // 1. Key regex validation
  console.log("  → [Key Validation] Valid and invalid snake_case keys...");
  assert.ok(
    customFieldCreateSchema.safeParse({
      key: "property_type",
      label: "Property Type",
      fieldType: "TEXT",
    }).success
  );
  assert.ok(
    customFieldCreateSchema.safeParse({
      key: "lead_budget_2026",
      label: "Lead Budget",
      fieldType: "NUMBER",
    }).success
  );

  // Invalid key: uppercase
  const upperRes = customFieldCreateSchema.safeParse({
    key: "PropertyType",
    label: "Property Type",
    fieldType: "TEXT",
  });
  assert.equal(upperRes.success, false);

  // Invalid key: dashes or spaces
  const dashRes = customFieldCreateSchema.safeParse({
    key: "property-type",
    label: "Property Type",
    fieldType: "TEXT",
  });
  assert.equal(dashRes.success, false);

  // 2. Select option validation
  console.log("  → [Option Validation] SELECT / MULTI_SELECT must have options...");
  const noOptRes = customFieldCreateSchema.safeParse({
    key: "category",
    label: "Category",
    fieldType: "SELECT",
    options: [],
  });
  assert.equal(noOptRes.success, false);

  // Duplicate options rejected
  const dupOptRes = customFieldCreateSchema.safeParse({
    key: "category",
    label: "Category",
    fieldType: "SELECT",
    options: ["Residential", "commercial", "Residential"],
  });
  assert.equal(dupOptRes.success, false);

  // 3. Runtime type validations
  console.log("  → [Type Validation] TEXT, NUMBER, BOOLEAN, DATE, SELECT, EMAIL, PHONE, URL...");
  const textField = { key: "notes", label: "Notes", fieldType: "TEXT" as const, required: true };
  assert.equal(validateCustomFieldValue(textField, "Hello world"), "Hello world");
  assert.throws(() => validateCustomFieldValue(textField, ""), ValidationError);

  const numField = { key: "score", label: "Score", fieldType: "NUMBER" as const, required: false };
  assert.equal(validateCustomFieldValue(numField, "42.5"), 42.5);
  assert.throws(() => validateCustomFieldValue(numField, "not_a_number"), ValidationError);

  const boolField = { key: "vip", label: "VIP", fieldType: "BOOLEAN" as const, required: false };
  assert.equal(validateCustomFieldValue(boolField, "yes"), true);
  assert.equal(validateCustomFieldValue(boolField, "false"), false);
  assert.equal(validateCustomFieldValue(boolField, 1), true);

  const selectField = {
    key: "stage",
    label: "Stage",
    fieldType: "SELECT" as const,
    required: false,
    options: ["Early", "Mid", "Late"],
  };
  assert.equal(validateCustomFieldValue(selectField, "early"), "Early");
  assert.throws(() => validateCustomFieldValue(selectField, "Unknown"), ValidationError);

  const emailField = { key: "alt_email", label: "Alt Email", fieldType: "EMAIL" as const, required: false };
  assert.equal(validateCustomFieldValue(emailField, "Test@Example.Com"), "test@example.com");
  assert.throws(() => validateCustomFieldValue(emailField, "invalid-email"), ValidationError);

  const urlField = { key: "linkedin", label: "LinkedIn", fieldType: "URL" as const, required: false };
  assert.equal(validateCustomFieldValue(urlField, "https://linkedin.com/in/test"), "https://linkedin.com/in/test");
  assert.throws(() => validateCustomFieldValue(urlField, "ftp://invalid-url"), ValidationError);

  // 4. RFC 4180 CSV Parser
  console.log("  → [CSV Engine] RFC 4180 parsing with quotes, commas, newlines...");
  const testCsv = `name,email,notes\n"Smith, John",john@example.com,"Line 1\nLine 2"\n"Bob ""The Builder""",bob@example.com,Simple`;
  const parsed = parseCsv(testCsv);
  assert.equal(parsed.headers.length, 3);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]["name"], "Smith, John");
  assert.equal(parsed.rows[0]["notes"], "Line 1\nLine 2");
  assert.equal(parsed.rows[1]["name"], 'Bob "The Builder"');

  // 5. Formula injection protection
  console.log("  → [Formula Injection] Escape trigger characters (=, +, -, @)...");
  assert.equal(sanitizeFormulaInjection("=SUM(1+2)"), "'=SUM(1+2)");
  assert.equal(sanitizeFormulaInjection("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(sanitizeFormulaInjection("@SUM(A1:A5)"), "'@SUM(A1:A5)");
  assert.equal(sanitizeFormulaInjection("-123"), "'-123");
  assert.equal(sanitizeFormulaInjection("Standard text"), "Standard text");

  // CSV Serializer with formula sanitization
  const serialized = serializeCsv([
    { name: "=HYPERLINK()", notes: "Safe text" },
  ]);
  assert.ok(serialized.includes("''=HYPERLINK()") || serialized.includes("'=HYPERLINK()"));

  console.log("  ✅ Custom Field & CSV Unit Tests PASSED!");
}

if (require.main === module) {
  runCustomFieldUnitTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
