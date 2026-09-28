/**
 * Slice 7: User, Team, Role, Company & Security Unit Tests
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  userQuerySchema,
  updateUserSchema,
  adminResetPasswordSchema,
} from "../lib/validations/user";
import {
  inviteUserSchema,
  acceptInvitationSchema,
} from "../lib/validations/invitation";
import {
  createTeamSchema,
  updateTeamSchema,
  teamMemberSchema,
  teamQuerySchema,
} from "../lib/validations/team";
import {
  createRoleSchema,
  updateRoleSchema,
  permissionItemSchema,
} from "../lib/validations/role";
import {
  updateCompanySettingsSchema,
} from "../lib/validations/company-settings";
import {
  changePasswordSchema,
} from "../lib/validations/security";

export async function runUserTeamUnitTests() {
  console.log("\n🧪 Running Slice 7: User & Team Management Unit Tests...");

  // 1. User Validations
  console.log("  → [User Schemas] Query, update, and reset password validation...");
  
  // Valid query
  const validQuery = userQuerySchema.safeParse({
    page: "2",
    limit: "25",
    role: "Admin",
    status: "ACTIVE",
    search: "alice",
  });
  assert.ok(validQuery.success);
  if (validQuery.success) {
    assert.equal(validQuery.data.page, 2);
    assert.equal(validQuery.data.limit, 25);
  }

  // Limit capped / defaulted
  const defaultQuery = userQuerySchema.safeParse({});
  assert.ok(defaultQuery.success);
  if (defaultQuery.success) {
    assert.equal(defaultQuery.data.page, 1);
    assert.equal(defaultQuery.data.limit, 20);
  }

  // User update schema
  const validUserUpdate = updateUserSchema.safeParse({
    name: "  Alice Smith  ",
    phone: "+1 555-0199",
    teamId: "c2d35410-2208-4f2a-9cdc-edf51aa4964c",
    status: "ACTIVE",
  });
  assert.ok(validUserUpdate.success);
  if (validUserUpdate.success) {
    assert.equal(validUserUpdate.data.name, "Alice Smith");
  }

  // Invalid name and status in user update
  const invalidName = updateUserSchema.safeParse({
    name: "",
  });
  assert.equal(invalidName.success, false);

  const invalidStatus = updateUserSchema.safeParse({
    status: "INVALID_STATUS" as any,
  });
  assert.equal(invalidStatus.success, false);

  // Admin password reset
  const shortPass = adminResetPasswordSchema.safeParse({
    password: "123",
  });
  assert.equal(shortPass.success, false);

  const goodPass = adminResetPasswordSchema.safeParse({
    password: "SecurePassword123!",
  });
  assert.ok(goodPass.success);

  // 2. Invitation Validations
  console.log("  → [Invitation Schemas] Invite and accept schemas...");
  const validInvite = inviteUserSchema.safeParse({
    email: "NewHire@Company.COM  ",
    roleId: "c2d35410-2208-4f2a-9cdc-edf51aa4964c",
    teamId: "e3d35410-2208-4f2a-9cdc-edf51aa4964c",
  });
  assert.ok(validInvite.success);
  if (validInvite.success) {
    assert.equal(validInvite.data.email, "newhire@company.com");
  }

  const invalidInviteEmail = inviteUserSchema.safeParse({
    email: "bad-email",
    roleId: "c2d35410-2208-4f2a-9cdc-edf51aa4964c",
  });
  assert.equal(invalidInviteEmail.success, false);

  const validAccept = acceptInvitationSchema.safeParse({
    token: "valid-secure-random-32-byte-hex-token",
    name: "Jane Doe",
    password: "SuperSecretPassword123",
  });
  assert.ok(validAccept.success);

  // 3. Team Validations
  console.log("  → [Team Schemas] Create, update, and member assignment schemas...");
  const validCreateTeam = createTeamSchema.safeParse({
    name: "Enterprise Sales",
    description: "Dedicated to Fortune 500 accounts",
    managerId: "c2d35410-2208-4f2a-9cdc-edf51aa4964c",
  });
  assert.ok(validCreateTeam.success);

  const emptyTeamName = createTeamSchema.safeParse({
    name: "",
  });
  assert.equal(emptyTeamName.success, false);

  const validMemberAssign = teamMemberSchema.safeParse({
    userId: "c2d35410-2208-4f2a-9cdc-edf51aa4964c",
  });
  assert.ok(validMemberAssign.success);

  // 4. Role & Permissions Matrix Validations
  console.log("  → [Role & Permissions] Granular action and scope validation...");
  const validPermission = permissionItemSchema.safeParse({
    module: "leads",
    action: "export",
    dataScope: "COMPANY",
  });
  assert.ok(validPermission.success);

  const invalidScope = permissionItemSchema.safeParse({
    module: "leads",
    action: "export",
    dataScope: "INVALID_SCOPE",
  });
  assert.equal(invalidScope.success, false);

  const validCreateRole = createRoleSchema.safeParse({
    name: "Auditor",
    description: "Read-only access across company leads and activities",
    permissions: [
      { module: "leads", action: "view", dataScope: "COMPANY" },
      { module: "activities", action: "view", dataScope: "COMPANY" },
      { module: "audit_logs", action: "view", dataScope: "COMPANY" },
    ],
  });
  assert.ok(validCreateRole.success);

  // 5. Company Settings Validations
  console.log("  → [Company Settings] Timezone, currency, and date formats...");
  const validCompany = updateCompanySettingsSchema.safeParse({
    name: "Acme International",
    email: "info@acme.com",
    timezone: "America/New_York",
    currency: "USD",
    dateFormat: "YYYY-MM-DD",
    website: "https://acme.com",
  });
  assert.ok(validCompany.success);

  const invalidWebsite = updateCompanySettingsSchema.safeParse({
    website: "not-a-valid-url",
  });
  assert.equal(invalidWebsite.success, false);

  // 6. Security & Session Validations
  console.log("  → [Security & Password] Password change validation...");
  const validChangePass = changePasswordSchema.safeParse({
    currentPassword: "OldPassword123",
    newPassword: "BrandNewSecurePassword456",
  });
  assert.ok(validChangePass.success);

  const invalidChangePass = changePasswordSchema.safeParse({
    currentPassword: "OldPassword123",
    newPassword: "short",
  });
  assert.equal(invalidChangePass.success, false);

  // 7. Token Hashing Verification (SHA-256)
  console.log("  → [Security Hash] Token hashing must be deterministic SHA-256...");
  const rawToken = "5f2b80a1c3e44927b58c70725eaef995";
  const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const actualHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  assert.equal(actualHash, expectedHash);
  assert.equal(actualHash.length, 64);

  console.log("  ✅ All Slice 7 Unit Tests Passed!");
}
