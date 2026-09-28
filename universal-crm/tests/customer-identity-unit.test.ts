/**
 * Unit Tests for Phase 1: Customer Identity Schema
 * 
 * Verifies:
 * 1. Customer CRUD scoped to companyId
 * 2. CustomerPhone normalizedPhone indexing and tenant-scoped uniqueness
 * 3. Cross-company phone independence (same phone allowed in different companies)
 * 4. Multiple phones per customer
 * 5. Lead.customerId relation and SetNull behavior on Customer delete
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";

export async function runCustomerIdentityUnitTests() {
  console.log("\n🧪 Running Phase 1 Unit Tests: Customer Identity Schema & Isolation...");

  // Setup test companies and user
  const uniqueSuffix = Date.now().toString();
  const testCompanyA = await prisma.company.create({
    data: {
      name: `Phase 1 Tenant A ${uniqueSuffix}`,
      slug: `p1-tenant-a-${uniqueSuffix}`,
    },
  });

  const testCompanyB = await prisma.company.create({
    data: {
      name: `Phase 1 Tenant B ${uniqueSuffix}`,
      slug: `p1-tenant-b-${uniqueSuffix}`,
    },
  });

  const defaultRole = await prisma.role.create({
    data: {
      companyId: testCompanyA.id,
      name: `ROLE_${uniqueSuffix}`,
      description: "Test Role",
      isSystem: false,
    },
  });

  const _testUserA = await prisma.user.create({
    data: {
      email: `p1userA_${uniqueSuffix}@example.com`,
      hashedPassword: "$2a$10$abcdefghijklmnopqrstuvwxyzABCDE",
      name: "Phase 1 User A",
      companyId: testCompanyA.id,
      roleId: defaultRole.id,
    },
  });

  try {
    // 1. Create Customer record scoped to companyId
    console.log("  → Testing Customer creation and tenant scoping...");
    const customer = await prisma.customer.create({
      data: {
        companyId: testCompanyA.id,
        name: "Rahul Sharma",
        displayName: "Rahul (Preferred)",
        companyName: "Sharma Electronics",
        notes: "Key accounts customer",
      },
    });

    assert.ok(customer.id, "Customer ID should be defined");
    assert.equal(customer.companyId, testCompanyA.id, "Customer must belong to Tenant A");
    assert.equal(customer.name, "Rahul Sharma");
    assert.equal(customer.deletedAt, null, "Customer should not be soft-deleted");

    // 2. CustomerPhone normalized phone and tenant-scoped uniqueness
    console.log("  → Testing CustomerPhone normalizedPhone and tenant-scoped uniqueness...");
    const phone = await prisma.customerPhone.create({
      data: {
        companyId: testCompanyA.id,
        customerId: customer.id,
        rawPhone: "+91 98765 43210",
        normalizedPhone: "+919876543210",
        countryCode: "+91",
        type: "MOBILE",
        isPrimary: true,
      },
    });

    assert.ok(phone.id, "Phone ID should be defined");
    assert.equal(phone.normalizedPhone, "+919876543210");
    assert.equal(phone.isPrimary, true);

    // Duplicate phone in the SAME company must fail unique constraint
    let duplicateFailed = false;
    try {
      await prisma.customerPhone.create({
        data: {
          companyId: testCompanyA.id,
          customerId: customer.id,
          rawPhone: "09876543210",
          normalizedPhone: "+919876543210",
        },
      });
    } catch {
      duplicateFailed = true;
    }
    assert.equal(duplicateFailed, true, "Same normalized phone in same company MUST be rejected by unique constraint");

    // 3. Cross-company same phone independence
    console.log("  → Testing cross-tenant phone independence (same phone allowed in different companies)...");
    const customerB = await prisma.customer.create({
      data: {
        companyId: testCompanyB.id,
        name: "Rahul Sharma (Tenant B Client)",
      },
    });

    const phoneB = await prisma.customerPhone.create({
      data: {
        companyId: testCompanyB.id,
        customerId: customerB.id,
        rawPhone: "+91 98765 43210",
        normalizedPhone: "+919876543210",
      },
    });

    assert.ok(phoneB.id, "Phone in Tenant B should be created successfully");
    assert.equal(phoneB.companyId, testCompanyB.id, "Phone B must belong to Tenant B");
    assert.equal(phoneB.normalizedPhone, "+919876543210", "Phone B shares normalized number across tenants without collision");

    // 4. Multiple phone numbers for a single customer
    console.log("  → Testing multiple phones on single customer...");
    const phone2 = await prisma.customerPhone.create({
      data: {
        companyId: testCompanyA.id,
        customerId: customer.id,
        rawPhone: "+91-98765-43211",
        normalizedPhone: "+919876543211",
        isPrimary: false,
      },
    });
    assert.ok(phone2.id, "Second phone should be created");

    const customerWithPhones = await prisma.customer.findUnique({
      where: { id: customer.id },
      include: { phones: true },
    });

    assert.equal(customerWithPhones?.phones.length, 2, "Customer should have exactly 2 phones");
    const phoneNumbers = customerWithPhones?.phones.map((p) => p.normalizedPhone);
    assert.ok(phoneNumbers?.includes("+919876543210"), "Should include phone 1");
    assert.ok(phoneNumbers?.includes("+919876543211"), "Should include phone 2");

    // 5. Link Lead.customerId to Customer and preserve SetNull on Customer deletion
    console.log("  → Testing Lead.customerId relation and SetNull onDelete cascade...");
    const lead = await prisma.lead.create({
      data: {
        companyId: testCompanyA.id,
        name: "Interested in Enterprise CRM",
        customerId: customer.id,
      },
    });

    assert.equal(lead.customerId, customer.id, "Lead should be linked to Customer");

    // When Customer is deleted, Lead.customerId should be set to null, not deleted
    await prisma.customer.delete({
      where: { id: customer.id },
    });

    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
    });

    assert.ok(updatedLead !== null, "Lead must NOT be deleted when Customer is deleted");
    assert.equal(updatedLead?.customerId, null, "Lead.customerId must be set to null on Customer delete");

    // Clean up created test lead
    await prisma.lead.delete({ where: { id: lead.id } });

    console.log("  ✅ Phase 1 Unit Tests Passed!");
  } finally {
    // Cleanup companies and users
    await prisma.customerEmail.deleteMany({
      where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } },
    });
    await prisma.customerPhone.deleteMany({
      where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } },
    });
    await prisma.customer.deleteMany({
      where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } },
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [testCompanyA.id, testCompanyB.id] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [testCompanyA.id, testCompanyB.id] } },
    });
  }
}

// Direct execution support
if (require.main === module) {
  runCustomerIdentityUnitTests()
    .then(() => {
      console.log("Phase 1 test executed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Phase 1 test failed:", err);
      process.exit(1);
    });
}
