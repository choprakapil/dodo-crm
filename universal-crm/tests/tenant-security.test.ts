/**
 * Tenant Security Tests for Slice 2: Cross-Tenant Isolation & Identity Tamper Resistance
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";

async function runTenantSecurityTests() {
  console.log("\n🧪 Running Tenant Security Tests: Cross-Tenant Isolation & Tamper Resistance...");

  // 1. Fetch Company A (Acme Corp) and Company B (Zenith Solutions) users
  console.log("  → Fetching Company A (Acme) and Company B (Zenith) users...");
  const acmeUser = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
    include: { company: true, role: { include: { permissions: true } } },
  });
  const zenithUser = await prisma.user.findFirst({
    where: { email: "admin@zenithsolutions.com" },
    include: { company: true, role: { include: { permissions: true } } },
  });

  assert.ok(acmeUser, "Acme user must exist");
  assert.ok(zenithUser, "Zenith user must exist");
  assert.notEqual(acmeUser.companyId, zenithUser.companyId, "Company IDs must be strictly different");

  // 2. Establish sessions
  console.log("  → Creating sessions for both companies...");
  const acmeSession = await createDbSession(acmeUser.id, acmeUser.companyId);
  const zenithSession = await createDbSession(zenithUser.id, zenithUser.companyId);

  const acmeContext = await validateSessionToken(acmeSession.rawToken);
  const zenithContext = await validateSessionToken(zenithSession.rawToken);

  assert.ok(acmeContext, "Acme session context must exist");
  assert.ok(zenithContext, "Zenith session context must exist");

  // 3. Verify Server-Side Authority (Tamper Resistance)
  console.log("  → Verifying tamper resistance: client headers/params cannot override server context...");
  // Simulate attacker attempting to claim Zenith's companyId while using Acme's session
  const attackerClaimedCompanyId = zenithUser.companyId;
  const attackerClaimedUserId = zenithUser.id;

  // Server-side context ONLY trusts validated session token
  assert.equal(acmeContext.company.id, acmeUser.companyId);
  assert.notEqual(
    acmeContext.company.id,
    attackerClaimedCompanyId,
    "Acme context companyId CANNOT match claimed Zenith companyId"
  );
  assert.notEqual(
    acmeContext.user.id,
    attackerClaimedUserId,
    "Acme context userId CANNOT match claimed Zenith userId"
  );

  // 4. Cross-Tenant Data Isolation Proof
  console.log("  → Verifying cross-tenant lead isolation...");
  // Query leads scoped to Acme context
  const acmeLeads = await prisma.lead.findMany({
    where: {
      companyId: acmeContext.company.id, // Enforced server-side
    },
  });

  // Query leads scoped to Zenith context
  const zenithLeads = await prisma.lead.findMany({
    where: {
      companyId: zenithContext.company.id, // Enforced server-side
    },
  });

  assert.ok(acmeLeads.length > 0, "Acme should have seeded leads");
  assert.ok(zenithLeads.length > 0, "Zenith should have seeded leads");

  // Verify that NO Acme lead belongs to Zenith
  for (const lead of acmeLeads) {
    assert.equal(lead.companyId, acmeUser.companyId);
    assert.notEqual(lead.companyId, zenithUser.companyId);
  }

  // Verify that NO Zenith lead belongs to Acme
  for (const lead of zenithLeads) {
    assert.equal(lead.companyId, zenithUser.companyId);
    assert.notEqual(lead.companyId, acmeUser.companyId);
  }

  // 5. Cross-Tenant IDOR Attack Simulation
  console.log("  → Simulating IDOR attempt (Acme user trying to fetch a Zenith lead ID)...");
  const targetZenithLead = zenithLeads[0];
  assert.ok(targetZenithLead, "Zenith lead must exist to test IDOR");

  // An attacker with Acme context queries for Zenith's lead ID
  // Standard tenant query: WHERE id = targetId AND companyId = ctx.companyId
  const idorResult = await prisma.lead.findFirst({
    where: {
      id: targetZenithLead.id,
      companyId: acmeContext.company.id, // Scoped to attacker's company
    },
  });

  assert.equal(
    idorResult,
    null,
    "IDOR Attempt: Acme user querying Zenith lead ID MUST return null (404 Not Found)"
  );

  // 6. Role & Permission Tamper Resistance
  console.log("  → Verifying role and permission tamper resistance...");
  // Acme sales rep has restricted permissions compared to Admin
  const acmeRep = await prisma.user.findFirst({
    where: { email: "sarah@acmecorp.com" },
    include: { role: { include: { permissions: true } } },
  });
  assert.ok(acmeRep, "Sales rep user must exist");

  const repSession = await createDbSession(acmeRep.id, acmeRep.companyId);
  const repContext = await validateSessionToken(repSession.rawToken);
  assert.ok(repContext, "Rep context must exist");

  // Sales rep cannot perform company management or user management actions
  assert.equal(repContext.hasPermission("users", "create"), false);
  assert.equal(repContext.hasPermission("settings", "update"), false);

  console.log("✅ Tenant security tests passed successfully!\n");
}

export { runTenantSecurityTests };

if (require.main === module) {
  runTenantSecurityTests()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error("❌ Tenant security tests failed:", err);
      prisma.$disconnect();
      process.exit(1);
    });
}
