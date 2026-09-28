/**
 * Integration Tests for Custom Fields & Lead Integration
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { CustomFieldService } from "../lib/services/custom-field.service";
import { LeadService } from "../lib/services/lead.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";

export async function runCustomFieldIntegrationTests() {
  console.log("\n🧪 Running Custom Field Integration Tests...");

  // 1. Fetch Acme Admin Context
  const acmeAdmin = await prisma.user.findFirstOrThrow({
    where: { email: "admin@acmecorp.com" },
  });

  const adminSession = await createDbSession(acmeAdmin.id, acmeAdmin.companyId);
  const adminCtx = await validateSessionToken(adminSession.rawToken);
  assert.ok(adminCtx, "Acme admin context must exist");

  // Clean up any test custom fields
  await prisma.customField.deleteMany({
    where: {
      companyId: adminCtx.company.id,
      key: { in: ["test_prop_type", "test_budget", "test_features"] },
    },
  });

  // 2. Create custom fields
  console.log("  → [CustomFieldService] Create custom fields (SELECT, NUMBER, MULTI_SELECT)...");
  const propTypeField = await CustomFieldService.createCustomField(adminCtx, {
    key: "test_prop_type",
    label: "Property Type",
    fieldType: "SELECT",
    required: false,
    options: ["Condo", "Villa", "Commercial"],
    sortOrder: 1,
    entityType: "LEAD",
    active: true,
  });
  assert.equal(propTypeField.key, "test_prop_type");

  const budgetField = await CustomFieldService.createCustomField(adminCtx, {
    key: "test_budget",
    label: "Lead Budget",
    fieldType: "NUMBER",
    required: false,
    sortOrder: 2,
    entityType: "LEAD",
    active: true,
  });
  assert.equal(budgetField.fieldType, "NUMBER");

  const featuresField = await CustomFieldService.createCustomField(adminCtx, {
    key: "test_features",
    label: "Desired Features",
    fieldType: "MULTI_SELECT",
    required: false,
    options: ["Pool", "Garage", "Garden"],
    sortOrder: 3,
    entityType: "LEAD",
    active: true,
  });
  assert.equal(featuresField.fieldType, "MULTI_SELECT");

  // 3. Update field
  console.log("  → [CustomFieldService] Update custom field label and options...");
  const updatedField = await CustomFieldService.updateCustomField(adminCtx, propTypeField.id, {
    label: "Real Estate Property Type",
    options: ["Condo", "Villa", "Commercial", "Penthouse"],
  });
  assert.equal(updatedField.label, "Real Estate Property Type");

  // 4. Reorder fields
  console.log("  → [CustomFieldService] Reorder custom fields atomically...");
  const reorderRes = await CustomFieldService.reorderCustomFields(adminCtx, {
    items: [
      { id: budgetField.id, sortOrder: 1 },
      { id: propTypeField.id, sortOrder: 2 },
    ],
  });
  assert.equal(reorderRes.success, true);

  // 5. Create Lead with custom values
  console.log("  → [LeadService Integration] Create Lead with custom field values...");
  const newLead = await LeadService.createLead(adminCtx, {
    name: "Bruce Wayne",
    email: "bruce@wayneenterprises.com",
    priority: "URGENT",
    customFields: {
      test_prop_type: "Penthouse",
      test_budget: 1500000,
      test_features: ["Pool", "Garage"],
    },
  });
  assert.equal(newLead.name, "Bruce Wayne");

  // 6. Verify custom field values saved
  console.log("  → [CustomFieldService] Verify saved values for lead...");
  const leadFields = await CustomFieldService.getLeadCustomFields(adminCtx, newLead.id);
  const budgetVal = leadFields.find((f: { field: { key: string }; value: unknown }) => f.field.key === "test_budget");
  const propVal = leadFields.find((f: { field: { key: string }; value: unknown }) => f.field.key === "test_prop_type");
  const featVal = leadFields.find((f: { field: { key: string }; value: unknown }) => f.field.key === "test_features");

  assert.equal(budgetVal?.value, 1500000);
  assert.equal(propVal?.value, "Penthouse");
  assert.deepEqual(featVal?.value, ["Pool", "Garage"]);

  // 7. Update Lead custom fields
  console.log("  → [LeadService Integration] Update custom values on lead...");
  await LeadService.updateLead(adminCtx, newLead.id, {
    customFields: {
      test_budget: 2000000,
    },
  });

  const updatedLeadFields = await CustomFieldService.getLeadCustomFields(adminCtx, newLead.id);
  const updatedBudgetVal = updatedLeadFields.find((f: { field: { key: string }; value: unknown }) => f.field.key === "test_budget");
  assert.equal(updatedBudgetVal?.value, 2000000);

  // 8. Delete Custom Field
  console.log("  → [CustomFieldService] Soft delete custom field...");
  const deleteRes = await CustomFieldService.deleteCustomField(adminCtx, featuresField.id);
  assert.equal(deleteRes.success, true);

  const activeFields = await CustomFieldService.listCustomFields(adminCtx, "LEAD", false);
  assert.equal(activeFields.some((f: { id: string }) => f.id === featuresField.id), false);

  // Cleanup test lead and fields
  await prisma.lead.delete({ where: { id: newLead.id } });
  await prisma.customField.deleteMany({
    where: { id: { in: [propTypeField.id, budgetField.id, featuresField.id] } },
  });

  console.log("  ✅ Custom Field Integration Tests PASSED!");
}

if (require.main === module) {
  runCustomFieldIntegrationTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
