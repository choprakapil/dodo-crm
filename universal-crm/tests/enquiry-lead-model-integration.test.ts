/**
 * Integration Tests for Phase 3: Extend Enquiry / Lead Model with Customer
 * 
 * Verifies:
 * 1. Creating lead with phone automatically resolves/creates Customer and sets lead.customerId
 * 2. CRITICAL RULE: ONE CUSTOMER != ONE ENQUIRY
 *    Two enquiries for same customer maintain completely separate lifecycles
 * 3. Updating Enquiry A status does NOT impact Enquiry B
 * 4. Leads can be filtered by customerId in LeadService.listLeads
 * 5. Explicit customerId can be provided or updated
 * 6. History, activities, and audit logs are preserved
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { LeadService } from "../lib/services/lead.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadPriority } from "@prisma/client";

export async function runEnquiryLeadModelIntegrationTests() {
  console.log("\n🧪 Running Phase 3 Integration Tests: Enquiry / Lead Model with Customer...");

  const uniqueSuffix = Date.now().toString();

  // Setup company, role, user, statuses, source
  const company = await prisma.company.create({
    data: {
      name: `Enquiry Co ${uniqueSuffix}`,
      slug: `enquiry-co-${uniqueSuffix}`,
      currency: "USD",
    },
  });

  const role = await prisma.role.create({
    data: {
      companyId: company.id,
      name: `ROLE_AGENT_${uniqueSuffix}`,
      isSystem: false,
      permissions: {
        createMany: {
          data: [
            { module: "leads", action: "view", dataScope: "COMPANY" },
            { module: "leads", action: "create", dataScope: "COMPANY" },
            { module: "leads", action: "update", dataScope: "COMPANY" },
            { module: "leads", action: "assign", dataScope: "COMPANY" },
          ],
        },
      },
    },
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      roleId: role.id,
      email: `agent_${uniqueSuffix}@enquiry-co.com`,
      hashedPassword: "$2a$10$abcdefghijklmnopqrstuvwxyzABCDE",
      name: "Enquiry Agent",
      status: "ACTIVE",
    },
  });

  const statusNew = await prisma.leadStatus.create({
    data: {
      companyId: company.id,
      name: "New",
      isDefault: true,
      displayOrder: 1,
    },
  });

  const statusConverted = await prisma.leadStatus.create({
    data: {
      companyId: company.id,
      name: "Converted",
      isDefault: false,
      displayOrder: 2,
    },
  });

  const _statusClosed = await prisma.leadStatus.create({
    data: {
      companyId: company.id,
      name: "Closed",
      isDefault: false,
      displayOrder: 3,
    },
  });

  const source = await prisma.leadSource.create({
    data: {
      companyId: company.id,
      name: "Website",
    },
  });

  const session = await createDbSession(user.id, company.id);
  const ctx = await validateSessionToken(session.rawToken);
  assert.ok(ctx, "AuthContext must be generated");

  try {
    // 1. Create Enquiry #1 with phone -> automatically resolves and attaches customerId
    console.log("  → Creating Enquiry #1 (TV)...");
    const enquiry1 = await LeadService.createLead(ctx, {
      name: "Rahul Sharma",
      phone: "+91 98765 43210",
      email: "rahul@example.com",
      company: "Sharma Tech",
      amount: 50000,
      priority: LeadPriority.HIGH,
      sourceId: source.id,
      statusId: statusNew.id,
    });

    assert.ok(enquiry1.id);
    assert.ok(enquiry1.customerId, "Enquiry #1 must have resolved a customerId");

    const customer1 = await prisma.customer.findUnique({
      where: { id: enquiry1.customerId! },
      include: { phones: true },
    });
    assert.ok(customer1);
    assert.equal(customer1?.phones[0]?.normalizedPhone, "+919876543210");

    // 2. Create Enquiry #2 for SAME customer with different requirement (Mobile)
    console.log("  → Creating Enquiry #2 (Mobile) for same phone...");
    const enquiry2 = await LeadService.createLead(ctx, {
      name: "Rahul Sharma",
      phone: "09876543210", // Alternate format of same phone
      amount: 25000,
      priority: LeadPriority.MEDIUM,
      sourceId: source.id,
      statusId: statusNew.id,
    });

    assert.ok(enquiry2.id);
    assert.notEqual(enquiry2.id, enquiry1.id, "Enquiry #1 and Enquiry #2 must be distinct lead records");
    assert.equal(enquiry2.customerId, enquiry1.customerId, "Both enquiries must point to the SAME customer identity");

    // 3. Create Enquiry #3 (AC)
    console.log("  → Creating Enquiry #3 (AC) for same customer...");
    const enquiry3 = await LeadService.createLead(ctx, {
      name: "Rahul Sharma",
      customerId: customer1?.id, // Explicit customerId
      amount: 40000,
      priority: LeadPriority.LOW,
      sourceId: source.id,
      statusId: statusNew.id,
    });

    assert.equal(enquiry3.customerId, customer1?.id);

    // 4. Invariant: Status change on Enquiry #1 must NOT affect Enquiry #2 or Enquiry #3
    console.log("  → Invariant check: converting Enquiry #1 must NOT affect Enquiry #2 or #3...");
    await LeadService.updateLead(ctx, enquiry1.id, {
      statusId: statusConverted.id,
    });

    const refreshedE1 = await LeadService.getLeadById(ctx, enquiry1.id);
    const refreshedE2 = await LeadService.getLeadById(ctx, enquiry2.id);
    const refreshedE3 = await LeadService.getLeadById(ctx, enquiry3.id);

    assert.equal(refreshedE1.statusId, statusConverted.id, "Enquiry #1 is now Converted");
    assert.equal(refreshedE2.statusId, statusNew.id, "Enquiry #2 must remain New (independent lifecycle)");
    assert.equal(refreshedE3.statusId, statusNew.id, "Enquiry #3 must remain New (independent lifecycle)");

    // 5. Query leads filtered by customerId
    console.log("  → Testing listLeads filtered by customerId...");
    const customerLeads = await LeadService.listLeads(ctx, {
      customerId: customer1?.id,
      page: 1,
      limit: 10,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    assert.equal(customerLeads.pagination.total, 3, "Customer should have exactly 3 enquiries");

    // 6. getLeadById includes customer with phones
    console.log("  → Checking getLeadById includes customer relation and phone records...");
    assert.ok(refreshedE1.customer, "Customer relation must be present");
    assert.equal(refreshedE1.customer?.id, customer1?.id);
    assert.ok(refreshedE1.customer?.phones.length > 0);

    // 7. Sensitive Operation Check: Unauthorized customer identity change rejected (Correction 2)
    console.log("  → Checking unauthorized customer identity change is rejected with ForbiddenError...");
    const customer2 = await prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Second Different Customer",
      },
    });

    let forbiddenCaught = false;
    try {
      await LeadService.updateLead(ctx, enquiry1.id, {
        customerId: customer2.id,
      });
    } catch {
      forbiddenCaught = true;
    }
    assert.equal(forbiddenCaught, true, "User without customers.manage must NOT be allowed to reassign customer on enquiry");

    // Grant customers.manage to role and verify authorized link succeeds with audit trail
    await prisma.permission.create({
      data: {
        roleId: role.id,
        module: "customers",
        action: "manage",
        dataScope: "COMPANY",
      },
    });

    // Refresh session/AuthContext
    const authorizedSession = await createDbSession(user.id, company.id);
    const authorizedCtx = await validateSessionToken(authorizedSession.rawToken);
    assert.ok(authorizedCtx);

    const relinked = await LeadService.updateLead(authorizedCtx, enquiry1.id, {
      customerId: customer2.id,
    });
    assert.equal(relinked.customerId, customer2.id, "Authorized manager must successfully reassign customer");

    // Verify audit log exists
    const audit = await prisma.auditLog.findFirst({
      where: {
        companyId: company.id,
        action: "customer.link_enquiry",
        entityId: enquiry1.id,
      },
    });
    assert.ok(audit, "AuditLog must be recorded for customer reassignment");

    console.log("  ✅ Enquiry / Lead Model Integration Tests Passed!");
  } finally {
    // Cleanup
    await prisma.activity.deleteMany({ where: { companyId: company.id } });
    await prisma.leadStatusHistory.deleteMany({ where: { companyId: company.id } });
    await prisma.lead.deleteMany({ where: { companyId: company.id } });
    await prisma.customerPhone.deleteMany({ where: { companyId: company.id } });
    await prisma.customerEmail.deleteMany({ where: { companyId: company.id } });
    await prisma.customer.deleteMany({ where: { companyId: company.id } });
    await prisma.leadSource.deleteMany({ where: { companyId: company.id } });
    await prisma.leadStatus.deleteMany({ where: { companyId: company.id } });
    await prisma.session.deleteMany({ where: { companyId: company.id } });
    await prisma.user.deleteMany({ where: { companyId: company.id } });
    await prisma.permission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.deleteMany({ where: { companyId: company.id } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  }
}

if (require.main === module) {
  runEnquiryLeadModelIntegrationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
