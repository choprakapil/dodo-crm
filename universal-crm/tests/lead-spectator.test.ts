/**
 * Adversarial Spectator Tests for Slice 3 — Lead Management Core
 * Verifies data scopes (OWN, TEAM, COMPANY), RBAC permission gates,
 * and tamper resistance against adversarial access patterns.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadService } from "../lib/services/lead.service";
import { NotFoundError, ForbiddenError } from "../lib/errors";

export async function runLeadSpectatorTests() {
  console.log("\n🕵️  Running Lead Adversarial Spectator Tests: Data Scopes & Permission Gates...");

  // 1. Fetch Acme users: Admin (COMPANY), Manager (TEAM), Rep Sarah (OWN), Rep Mike (OWN)
  const [adminUser, managerUser, sarahUser, mikeUser] = await Promise.all([
    prisma.user.findFirstOrThrow({ where: { email: "admin@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "manager@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "sarah@acmecorp.com" } }),
    prisma.user.findFirstOrThrow({ where: { email: "mike@acmecorp.com" } }),
  ]);

  // Create active sessions for all 4
  const [adminSess, managerSess, sarahSess, mikeSess] = await Promise.all([
    createDbSession(adminUser.id, adminUser.companyId),
    createDbSession(managerUser.id, managerUser.companyId),
    createDbSession(sarahUser.id, sarahUser.companyId),
    createDbSession(mikeUser.id, mikeUser.companyId),
  ]);

  const [adminCtx, managerCtx, sarahCtx, mikeCtx] = await Promise.all([
    validateSessionToken(adminSess.rawToken),
    validateSessionToken(managerSess.rawToken),
    validateSessionToken(sarahSess.rawToken),
    validateSessionToken(mikeSess.rawToken),
  ]);

  assert.ok(adminCtx && managerCtx && sarahCtx && mikeCtx, "All 4 contexts must exist");

  // Create a lead explicitly assigned to Sarah
  const sarahLead = await LeadService.createLead(adminCtx, {
    name: `Sarah Private Lead ${Date.now()}`,
    assignedUserId: sarahUser.id,
  });

  // Create a lead explicitly assigned to Mike with NO team
  const mikeLead = await LeadService.createLead(adminCtx, {
    name: `Mike Private Lead ${Date.now()}`,
    assignedUserId: mikeUser.id,
  });

  // =========================================================================
  // TEST 1: OWN Scope Enforcement (Sarah cannot access Mike's lead)
  // =========================================================================
  console.log("  → [Data Scope OWN] Sarah (OWN scope) lists leads...");
  const sarahList = await LeadService.listLeads(sarahCtx, {
    page: 1,
    limit: 50,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  interface SpectatorLead {
    assignedUserId: string | null;
  }

  // Every lead Sarah sees must be assigned to Sarah
  for (const lead of (sarahList.data as unknown as SpectatorLead[])) {
    assert.equal(
      lead.assignedUserId,
      sarahUser.id,
      "User with OWN scope MUST only see leads assigned to them"
    );
  }

  // Sarah cannot read Mike's lead by ID -> 404
  console.log("  → [Data Scope OWN] Sarah attempts to get Mike's lead by ID...");
  await assert.rejects(
    async () => {
      await LeadService.getLeadById(sarahCtx, mikeLead.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "OWN scope user accessing another user's lead MUST throw NotFoundError (404)"
      );
      return true;
    }
  );

  // Sarah cannot update Mike's lead -> 404
  console.log("  → [Data Scope OWN] Sarah attempts to update Mike's lead...");
  await assert.rejects(
    async () => {
      await LeadService.updateLead(sarahCtx, mikeLead.id, { name: "Hacked by Sarah" });
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "OWN scope user updating another user's lead MUST throw NotFoundError (404)"
      );
      return true;
    }
  );

  // Sarah CAN read and update her own lead
  console.log("  → [Data Scope OWN] Sarah updates her own lead...");
  const sarahUpdated = await LeadService.updateLead(sarahCtx, sarahLead.id, {
    name: "Sarah Lead Updated by Sarah",
  });
  assert.equal(sarahUpdated.name, "Sarah Lead Updated by Sarah");

  // =========================================================================
  // TEST 2: RBAC Permission Gate (Sales Rep cannot delete leads)
  // =========================================================================
  console.log("  → [RBAC Gate] Sarah attempts to delete lead (no leads.delete permission)...");
  await assert.rejects(
    async () => {
      await LeadService.deleteLead(sarahCtx, sarahLead.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof ForbiddenError,
        "User without leads.delete permission MUST throw ForbiddenError (403)"
      );
      return true;
    }
  );

  // =========================================================================
  // TEST 3: TEAM Scope Enforcement
  // =========================================================================
  console.log("  → [Data Scope TEAM] Manager (TEAM scope) lists leads...");
  const managerList = await LeadService.listLeads(managerCtx, {
    page: 1,
    limit: 50,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  assert.ok(managerList.data.length > 0, "Manager should see team leads");

  // =========================================================================
  // TEST 4: COMPANY Scope Enforcement (Admin sees all company leads)
  // =========================================================================
  console.log("  → [Data Scope COMPANY] Admin lists leads...");
  const adminList = await LeadService.listLeads(adminCtx, {
    page: 1,
    limit: 50,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  assert.ok(adminList.pagination.total >= sarahList.pagination.total);

  // =========================================================================
  // TEST 5: Mass Assignment & Protected Fields Tampering
  // =========================================================================
  console.log("  → [Tamper Protection] Attempting to overwrite protected fields...");
  const beforeUpdate = await prisma.lead.findUniqueOrThrow({ where: { id: sarahLead.id } });

  await LeadService.updateLead(adminCtx, sarahLead.id, {
    name: "Protected Field Test",
    // @ts-expect-error test malicious field injection
    id: "fake_id_123",
    companyId: "fake_company_456",
    createdAt: new Date(2000, 1, 1),
    deletedAt: new Date(2000, 1, 1),
  });

  const afterUpdate = await prisma.lead.findUniqueOrThrow({ where: { id: sarahLead.id } });
  assert.equal(afterUpdate.id, sarahLead.id, "ID cannot be changed");
  assert.equal(afterUpdate.companyId, adminCtx.company.id, "companyId cannot be changed");
  assert.equal(afterUpdate.deletedAt, null, "deletedAt cannot be overwritten via update");
  assert.equal(
    afterUpdate.createdAt.toISOString(),
    beforeUpdate.createdAt.toISOString(),
    "createdAt timestamp cannot be tampered"
  );

  // Clean up test leads
  await prisma.lead.deleteMany({
    where: { id: { in: [sarahLead.id, mikeLead.id] } },
  });

  console.log("  🕵️  All Adversarial Spectator Tests PASSED!");
}

if (require.main === module) {
  runLeadSpectatorTests()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
