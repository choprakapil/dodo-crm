/**
 * Unit Tests for Slice 3 — Lead Management Core
 * Validates Zod schemas, normalization, and data-scope where clause generator.
 */

import assert from "node:assert/strict";
import {
  leadCreateSchema,
  leadUpdateSchema,
  leadListQuerySchema,
} from "../lib/validations/lead";
import { getLeadDataScopeWhere } from "../lib/auth/scope";
import { AuthContext } from "../lib/auth/session";
import { DataScope, LeadPriority } from "@prisma/client";
import { ForbiddenError } from "../lib/errors";

export async function runLeadUnitTests() {
  console.log("\n🧪 Running Lead Unit Tests: Validations & Data Scope Generators...");

  // 1. leadCreateSchema: Valid input
  console.log("  → Checking leadCreateSchema with valid input...");
  const validData = {
    name: "Jane Doe",
    email: "JANE.DOE@Example.COM",
    phone: " +1 (555) 019-2834 ",
    company: "Acme Partners",
    amount: "15000.50",
    priority: "HIGH",
    sourceId: "src_123",
    statusId: "st_123",
  };

  const createResult = leadCreateSchema.safeParse(validData);
  assert.ok(createResult.success, "Valid lead input should parse successfully");
  if (createResult.success) {
    assert.equal(createResult.data.name, "Jane Doe");
    assert.equal(createResult.data.email, "jane.doe@example.com", "Email must be normalized to lowercase");
    assert.equal(createResult.data.phone, "+1 (555) 019-2834", "Phone must be trimmed");
    assert.equal(createResult.data.amount, 15000.5, "Amount must be coerced to number");
    assert.equal(createResult.data.priority, LeadPriority.HIGH);
  }

  // 2. leadCreateSchema: Missing name
  console.log("  → Checking leadCreateSchema fails when name is missing...");
  const invalidName = leadCreateSchema.safeParse({ email: "test@example.com" });
  assert.equal(invalidName.success, false, "Missing name should fail validation");

  // 3. leadCreateSchema: Default priority
  console.log("  → Checking leadCreateSchema defaults priority to MEDIUM...");
  const defaultPriority = leadCreateSchema.safeParse({ name: "Bob Smith" });
  assert.ok(defaultPriority.success);
  if (defaultPriority.success) {
    assert.equal(defaultPriority.data.priority, LeadPriority.MEDIUM);
    assert.equal(defaultPriority.data.amount, null);
  }

  // 4. leadUpdateSchema: Partial updates allowed
  console.log("  → Checking leadUpdateSchema permits partial updates...");
  const partialUpdate = leadUpdateSchema.safeParse({
    amount: 25000,
    priority: "URGENT",
  });
  assert.ok(partialUpdate.success, "Partial update should parse successfully");
  if (partialUpdate.success) {
    assert.equal(partialUpdate.data.amount, 25000);
    assert.equal(partialUpdate.data.priority, LeadPriority.URGENT);
  }

  // 5. leadListQuerySchema: Default pagination and sorting
  console.log("  → Checking leadListQuerySchema default parameters...");
  const listDefaults = leadListQuerySchema.parse({});
  assert.equal(listDefaults.page, 1);
  assert.equal(listDefaults.limit, 20);
  assert.equal(listDefaults.sortBy, "createdAt");
  assert.equal(listDefaults.sortOrder, "desc");

  // 6. getLeadDataScopeWhere: COMPANY scope returns empty where
  console.log("  → Checking getLeadDataScopeWhere with COMPANY scope...");
  const mockCompanyCtx: AuthContext = {
    user: {
      id: "user_admin_1",
      name: "Admin",
      email: "admin@test.com",
      phone: null,
      status: "ACTIVE",
      roleId: "role_admin",
      roleName: "Admin",
      isSystemRole: true,
    },
    company: { id: "comp_1", name: "Company 1", slug: "comp-1", timezone: "UTC", currency: "USD", status: "ACTIVE" },
    role: { id: "role_admin", name: "Admin", isSystem: true },
    session: { id: "sess_1", expiresAt: new Date() },
    permissions: [{ module: "leads", action: "view", dataScope: DataScope.COMPANY }],
    hasPermission: () => true,
    getDataScope: () => DataScope.COMPANY,
  };

  const companyScopeWhere = await getLeadDataScopeWhere(mockCompanyCtx, "view");
  assert.deepEqual(companyScopeWhere, {}, "COMPANY scope must return empty filter object");

  // 7. getLeadDataScopeWhere: OWN scope restricts to assignedUserId
  console.log("  → Checking getLeadDataScopeWhere with OWN scope...");
  const mockOwnCtx: AuthContext = {
    ...mockCompanyCtx,
    permissions: [{ module: "leads", action: "view", dataScope: DataScope.OWN }],
    getDataScope: () => DataScope.OWN,
  };

  const ownScopeWhere = await getLeadDataScopeWhere(mockOwnCtx, "view");
  assert.deepEqual(
    ownScopeWhere,
    { assignedUserId: "user_admin_1" },
    "OWN scope must restrict query to assignedUserId: ctx.user.id"
  );

  // 8. getLeadDataScopeWhere: Missing permission throws ForbiddenError
  console.log("  → Checking getLeadDataScopeWhere without permission throws ForbiddenError...");
  const mockNoPermCtx: AuthContext = {
    ...mockCompanyCtx,
    permissions: [],
    getDataScope: () => null,
  };

  await assert.rejects(
    async () => {
      await getLeadDataScopeWhere(mockNoPermCtx, "view");
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError);
      return true;
    }
  );

  console.log("  ✔ All Lead Unit Tests passed successfully!");
}

if (require.main === module) {
  runLeadUnitTests().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
