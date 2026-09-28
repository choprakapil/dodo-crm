/**
 * Slice 8: Super Admin Platform Console & Quota Unit Tests
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  superAdminLoginSchema,
  provisionCompanySchema,
  suspendCompanySchema,
  updatePlanSchema,
  assignPlanSchema,
  platformCompanyQuerySchema,
  platformAuditLogQuerySchema,
  superAdminChangePasswordSchema,
} from "../lib/validations/platform";
import {
  QuotaExceededError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../lib/errors";

export async function runSuperAdminUnitTests() {
  console.log("\n🧪 Running Slice 8: Super Admin & Platform Console Unit Tests...");

  // 1. Super Admin Login Schema
  console.log("  → [Auth Schemas] Super Admin login validation & email normalization...");
  const validLogin = superAdminLoginSchema.safeParse({
    email: "  SuperAdmin@UniversalCRM.Platform  ",
    password: "PlatformMasterKey123!",
  });
  assert.ok(validLogin.success, "Valid super admin credentials must parse successfully");
  if (validLogin.success) {
    assert.equal(validLogin.data.email, "superadmin@universalcrm.platform");
    assert.equal(validLogin.data.password, "PlatformMasterKey123!");
  }

  // Reject invalid email format
  const badEmail = superAdminLoginSchema.safeParse({
    email: "not-an-email",
    password: "Password123!",
  });
  assert.equal(badEmail.success, false, "Invalid email format must fail");

  // Reject empty password
  const emptyPass = superAdminLoginSchema.safeParse({
    email: "admin@platform.com",
    password: "",
  });
  assert.equal(emptyPass.success, false, "Empty password must fail");

  // 2. Company Provisioning Schema
  console.log("  → [Provisioning Schemas] Company slug formatting, defaults & validations...");
  const validProvision = provisionCompanySchema.safeParse({
    name: "  Globex Corporation  ",
    slug: "globex-corp",
    initialAdminName: "Hank Scorpio",
    initialAdminEmail: "Hank@Globex.com",
    planTier: "PROFESSIONAL",
    timezone: "America/New_York",
    currency: "USD",
  });
  assert.ok(validProvision.success, "Valid provisioning payload must pass");
  if (validProvision.success) {
    assert.equal(validProvision.data.name, "Globex Corporation");
    assert.equal(validProvision.data.slug, "globex-corp");
    assert.equal(validProvision.data.initialAdminEmail, "hank@globex.com");
    assert.equal(validProvision.data.planTier, "PROFESSIONAL");
  }

  // Slug validation: must be lowercase alphanumeric with hyphens
  const invalidSlugSpaces = provisionCompanySchema.safeParse({
    name: "Globex Corporation",
    slug: "globex corp invalid",
    initialAdminName: "Hank Scorpio",
    initialAdminEmail: "hank@globex.com",
  });
  assert.equal(invalidSlugSpaces.success, false, "Slugs with spaces must be rejected");

  const invalidSlugSymbols = provisionCompanySchema.safeParse({
    name: "Globex Corporation",
    slug: "globex_corp!",
    initialAdminName: "Hank Scorpio",
    initialAdminEmail: "hank@globex.com",
  });
  assert.equal(invalidSlugSymbols.success, false, "Slugs with invalid symbols must be rejected");

  const normalizedSlugUpper = provisionCompanySchema.safeParse({
    name: "Globex Corporation",
    slug: "Globex-Corp",
    initialAdminName: "Hank Scorpio",
    initialAdminEmail: "hank@globex.com",
  });
  assert.ok(normalizedSlugUpper.success, "Uppercase in slug should be normalized to lowercase");
  if (normalizedSlugUpper.success) {
    assert.equal(normalizedSlugUpper.data.slug, "globex-corp");
  }

  // 3. Plan Schemas
  console.log("  → [Plan Schemas] Plan quota updates and assignment validation...");
  const validPlanUpdate = updatePlanSchema.safeParse({
    maxUsers: 100,
    maxLeads: 25000,
    features: {
      customFields: true,
      importExport: true,
      advancedAnalytics: true,
    },
  });
  assert.ok(validPlanUpdate.success, "Valid plan update must pass");

  // Negative quotas must fail
  const negativeUsers = updatePlanSchema.safeParse({
    maxUsers: -5,
  });
  assert.equal(negativeUsers.success, false, "Negative maxUsers must fail");

  const negativeLeads = updatePlanSchema.safeParse({
    maxLeads: -1000,
  });
  assert.equal(negativeLeads.success, false, "Negative maxLeads must fail");

  // Assign plan schema
  const validPlanAssign = assignPlanSchema.safeParse({
    planId: "c2d35410-2208-4f2a-9cdc-edf51aa4964c",
  });
  assert.ok(validPlanAssign.success, "Valid plan assignment must pass");

  const emptyPlanAssign = assignPlanSchema.safeParse({
    planId: "",
  });
  assert.equal(emptyPlanAssign.success, false, "Empty planId must fail");

  // 4. Mass Assignment Rejection (.strict() check)
  console.log("  → [Mass Assignment Defense] Testing unknown and privileged field injection...");
  const maliciousPayload = {
    name: "Injected Corp",
    slug: "injected-corp",
    initialAdminName: "Attacker",
    initialAdminEmail: "attacker@test.com",
    superAdminId: "fake-super-admin-id",
    companyId: "fake-company-id",
    passwordHash: "hacked-hash",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };

  const massAssignResult = provisionCompanySchema.safeParse(maliciousPayload);
  assert.equal(
    massAssignResult.success,
    false,
    "Provisioning schema must reject unauthorized injected fields"
  );

  const maliciousPlanPayload = {
    maxUsers: 50,
    superAdminId: "injected-id",
    id: "injected-plan-id",
  };
  const massAssignPlanResult = updatePlanSchema.safeParse(maliciousPlanPayload);
  assert.equal(
    massAssignPlanResult.success,
    false,
    "Plan update schema must reject injected fields"
  );

  // 5. Query Pagination & Filters
  console.log("  → [Query Schemas] Company query and platform audit query pagination...");
  const defaultCompanyQuery = platformCompanyQuerySchema.safeParse({});
  assert.ok(defaultCompanyQuery.success);
  if (defaultCompanyQuery.success) {
    assert.equal(defaultCompanyQuery.data.page, 1);
    assert.equal(defaultCompanyQuery.data.limit, 20);
    assert.equal(defaultCompanyQuery.data.sortBy, "createdAt");
    assert.equal(defaultCompanyQuery.data.sortOrder, "desc");
  }

  const customAuditQuery = platformAuditLogQuerySchema.safeParse({
    page: "3",
    limit: "50",
    action: "COMPANY_SUSPENDED",
    entityType: "Company",
  });
  assert.ok(customAuditQuery.success);
  if (customAuditQuery.success) {
    assert.equal(customAuditQuery.data.page, 3);
    assert.equal(customAuditQuery.data.limit, 50);
    assert.equal(customAuditQuery.data.action, "COMPANY_SUSPENDED");
  }

  // 6. Error Types
  console.log("  → [Error Types] QuotaExceededError and error status code validation...");
  const quotaErr = new QuotaExceededError(
    "User limit reached for this plan (max 10)",
    { current: 10, max: 10, resource: "users" }
  );
  assert.equal(quotaErr.statusCode, 403);
  assert.equal(quotaErr.code, "QUOTA_EXCEEDED");
  assert.equal(quotaErr.message, "User limit reached for this plan (max 10)");
  assert.deepEqual(quotaErr.details, { current: 10, max: 10, resource: "users" });

  // 7. Token Generation & Hashing Properties
  console.log("  → [Crypto Verification] SHA-256 hashing format and uniqueness...");
  const rawToken = crypto.randomBytes(32).toString("hex");
  assert.equal(rawToken.length, 64, "32-byte hex token must be 64 characters");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(tokenHash.length, 64, "SHA-256 hash must be 64 hex characters");
  assert.notEqual(rawToken, tokenHash, "Token and token hash must differ");

  console.log("  ✅ Slice 8: Super Admin Unit Tests Passed!\n");
}
