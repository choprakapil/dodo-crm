/**
 * Tenant Security & IDOR Tests for Slice 3 — Lead Management Core
 * Proves complete isolation between Acme Corp and Zenith Solutions.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadService } from "../lib/services/lead.service";
import { NotFoundError, ValidationError } from "../lib/errors";

export async function runLeadTenantSecurityTests() {
  console.log("\n🛡️  Running Lead Tenant Security & IDOR Tests...");

  // 1. Setup authenticated session for Acme Corp Admin
  const acmeUser = await prisma.user.findFirst({
    where: { email: "admin@acmecorp.com" },
  });
  assert.ok(acmeUser, "Acme admin must exist");
  const acmeSession = await createDbSession(acmeUser.id, acmeUser.companyId);
  const acmeCtx = await validateSessionToken(acmeSession.rawToken);
  assert.ok(acmeCtx, "Acme AuthContext must exist");

  // 2. Setup authenticated session for Zenith Solutions Admin
  const zenithUser = await prisma.user.findFirst({
    where: { email: "admin@zenithsolutions.com" },
  });
  assert.ok(zenithUser, "Zenith admin must exist");
  const zenithSession = await createDbSession(zenithUser.id, zenithUser.companyId);
  const zenithCtx = await validateSessionToken(zenithSession.rawToken);
  assert.ok(zenithCtx, "Zenith AuthContext must exist");

  assert.notEqual(acmeCtx.company.id, zenithCtx.company.id, "Tenant IDs must differ");

  // 3. Fetch a lead belonging to Zenith Solutions
  const zenithLead = await prisma.lead.findFirst({
    where: { companyId: zenithCtx.company.id, deletedAt: null },
  });
  assert.ok(zenithLead, "Zenith must have at least one active lead");

  // 4. Fetch a lead belonging to Acme Corp
  const acmeLead = await prisma.lead.findFirst({
    where: { companyId: acmeCtx.company.id, deletedAt: null },
  });
  assert.ok(acmeLead, "Acme must have at least one active lead");

  // Fetch Zenith configuration entities (status, source, user, team)
  const zenithStatus = await prisma.leadStatus.findFirst({
    where: { companyId: zenithCtx.company.id },
  });
  const zenithSource = await prisma.leadSource.findFirst({
    where: { companyId: zenithCtx.company.id },
  });
  const zenithTeam = await prisma.team.findFirst({
    where: { companyId: zenithCtx.company.id },
  });

  // TEST 1: Cross-Tenant Lead Read IDOR
  console.log("  → [IDOR Read] Acme user attempts to read Zenith lead by ID...");
  await assert.rejects(
    async () => {
      await LeadService.getLeadById(acmeCtx, zenithLead.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Reading foreign tenant lead MUST throw NotFoundError (404), never expose existence"
      );
      return true;
    }
  );

  console.log("  → [IDOR Read] Zenith user attempts to read Acme lead by ID...");
  await assert.rejects(
    async () => {
      await LeadService.getLeadById(zenithCtx, acmeLead.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Reading foreign tenant lead MUST throw NotFoundError (404)"
      );
      return true;
    }
  );

  // TEST 2: Cross-Tenant Lead Update IDOR
  console.log("  → [IDOR Update] Acme user attempts to PATCH Zenith lead...");
  await assert.rejects(
    async () => {
      await LeadService.updateLead(acmeCtx, zenithLead.id, {
        name: "Maliciously Modified",
      });
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Updating foreign tenant lead MUST throw NotFoundError (404)"
      );
      return true;
    }
  );

  // TEST 3: Cross-Tenant Lead Delete IDOR
  console.log("  → [IDOR Delete] Acme user attempts to DELETE Zenith lead...");
  await assert.rejects(
    async () => {
      await LeadService.deleteLead(acmeCtx, zenithLead.id);
    },
    (err: unknown) => {
      assert.ok(
        err instanceof NotFoundError,
        "Deleting foreign tenant lead MUST throw NotFoundError (404)"
      );
      return true;
    }
  );

  // Ensure Zenith lead was not deleted or modified
  const verifiedZenithLead = await prisma.lead.findUnique({
    where: { id: zenithLead.id },
  });
  assert.equal(verifiedZenithLead?.deletedAt, null, "Zenith lead must remain intact");
  assert.equal(verifiedZenithLead?.name, zenithLead.name, "Zenith lead name must remain intact");

  // TEST 4: Cross-Tenant Foreign Key Manipulation
  if (zenithStatus) {
    console.log("  → [Tamper Status] Acme user passes Zenith statusId in lead creation...");
    await assert.rejects(
      async () => {
        await LeadService.createLead(acmeCtx, {
          name: "Acme Foreign Status Lead",
          statusId: zenithStatus.id,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError, "Foreign statusId MUST throw ValidationError");
        return true;
      }
    );
  }

  if (zenithSource) {
    console.log("  → [Tamper Source] Acme user passes Zenith sourceId in lead creation...");
    await assert.rejects(
      async () => {
        await LeadService.createLead(acmeCtx, {
          name: "Acme Foreign Source Lead",
          sourceId: zenithSource.id,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError, "Foreign sourceId MUST throw ValidationError");
        return true;
      }
    );
  }

  console.log("  → [Tamper Assignee] Acme user passes Zenith userId in lead creation...");
  await assert.rejects(
    async () => {
      await LeadService.createLead(acmeCtx, {
        name: "Acme Foreign Assignee Lead",
        assignedUserId: zenithUser.id,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ValidationError, "Foreign assignedUserId MUST throw ValidationError");
      return true;
    }
  );

  if (zenithTeam) {
    console.log("  → [Tamper Team] Acme user passes Zenith teamId in lead creation...");
    await assert.rejects(
      async () => {
        await LeadService.createLead(acmeCtx, {
          name: "Acme Foreign Team Lead",
          teamId: zenithTeam.id,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationError, "Foreign teamId MUST throw ValidationError");
        return true;
      }
    );
  }

  // TEST 5: Mass Assignment of companyId
  console.log("  → [Mass Assignment] Verifying companyId cannot be hijacked...");
  const hijackedAttempt = await LeadService.createLead(acmeCtx, {
    name: "Acme Tamper Attempt",
    // @ts-expect-error simulating client payload with extra companyId
    companyId: zenithCtx.company.id,
  });
  assert.equal(
    hijackedAttempt.companyId,
    acmeCtx.company.id,
    "Lead companyId MUST be derived strictly from AuthContext"
  );
  assert.notEqual(
    hijackedAttempt.companyId,
    zenithCtx.company.id,
    "Lead cannot be placed into foreign company"
  );

  // Clean up test lead
  await prisma.lead.delete({ where: { id: hijackedAttempt.id } });

  // TEST 6: Search Cross-Tenant Leak Check
  console.log("  → [Search Isolation] Acme searches for Zenith lead name...");
  const acmeSearch = await LeadService.listLeads(acmeCtx, {
    page: 1,
    limit: 20,
    search: zenithLead.name,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  interface TenantLead {
    companyId: string;
  }

  assert.equal(
    (acmeSearch.data as unknown as TenantLead[]).some((l) => l.companyId === zenithCtx.company.id),
    false,
    "Acme search query MUST NEVER return Zenith leads"
  );

  console.log("  🛡️  All Lead Tenant Security & IDOR Tests PASSED!");
}

if (require.main === module) {
  runLeadTenantSecurityTests()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
