/**
 * Unit Tests for Lead Import Mapping and Duplicate Strategy
 */

import assert from "node:assert/strict";
import { detectColumnMappings } from "../lib/utils/csv";
import { leadImportExecuteSchema } from "../lib/validations/lead-import";

export async function runLeadImportUnitTests() {
  console.log("\n🧪 Running Lead Import Unit Tests...");

  // 1. Column Auto-Mapping Heuristics
  console.log("  → [Auto-Mapping] Core fields mapping detection...");
  const headers = ["Full Name", "E-Mail Address", "Mobile Number", "Organization", "Budget", "Stage"];
  const mappings = detectColumnMappings(headers, [
    { key: "custom_notes", label: "Special Notes" },
  ]);

  assert.equal(mappings["Full Name"], "name");
  assert.equal(mappings["E-Mail Address"], "email");
  assert.equal(mappings["Mobile Number"], "phone");
  assert.equal(mappings["Organization"], "company");
  assert.equal(mappings["Budget"], "amount");
  assert.equal(mappings["Stage"], "status");

  // Custom field detection
  console.log("  → [Auto-Mapping] Custom field key/label detection...");
  const customHeaders = ["Special Notes", "custom_notes"];
  const cfMappings = detectColumnMappings(customHeaders, [
    { key: "custom_notes", label: "Special Notes" },
  ]);
  assert.equal(cfMappings["Special Notes"], "cf_custom_notes");
  assert.equal(cfMappings["custom_notes"], "cf_custom_notes");

  // 2. Duplicate strategy validation
  console.log("  → [Duplicate Strategy] Valid enums (SKIP, UPDATE, CREATE)...");
  assert.ok(
    leadImportExecuteSchema.safeParse({
      csvContent: "name\nJohn",
      columnMappings: { name: "name" },
      duplicateStrategy: "SKIP",
    }).success
  );
  assert.ok(
    leadImportExecuteSchema.safeParse({
      csvContent: "name\nJohn",
      columnMappings: { name: "name" },
      duplicateStrategy: "UPDATE",
    }).success
  );
  assert.ok(
    leadImportExecuteSchema.safeParse({
      csvContent: "name\nJohn",
      columnMappings: { name: "name" },
      duplicateStrategy: "CREATE",
    }).success
  );

  const invalidStrat = leadImportExecuteSchema.safeParse({
    csvContent: "name\nJohn",
    columnMappings: { name: "name" },
    duplicateStrategy: "INVALID_MODE",
  });
  assert.equal(invalidStrat.success, false);

  console.log("  ✅ Lead Import Unit Tests PASSED!");
}

if (require.main === module) {
  runLeadImportUnitTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
