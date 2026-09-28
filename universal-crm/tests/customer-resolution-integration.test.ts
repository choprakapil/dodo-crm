/**
 * Integration Tests for Phase 2: Authoritative Customer Resolution Service
 * 
 * Verifies:
 * 1. Resolves/creates new Customer on first encounter
 * 2. Re-resolves exact same customer when different formats of the same phone arrive
 * 3. Cross-company same phone resolves to distinct, isolated customers
 * 4. Multi-phone resolution: adding second phone to customer, resolving by second phone returns same master customer
 * 5. Attempting to add duplicate phone of another customer fails with ConflictError
 * 6. Explicit customerId resolution
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { CustomerResolutionService } from "../lib/services/customer-resolution.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ConflictError } from "../lib/errors";

export async function runCustomerResolutionIntegrationTests() {
  console.log("\n🧪 Running Phase 2 Integration Tests: Customer Resolution & Identity Matching...");

  const uniqueSuffix = Date.now().toString();

  // Setup 2 distinct companies
  const companyA = await prisma.company.create({
    data: {
      name: `Resolution Co A ${uniqueSuffix}`,
      slug: `res-co-a-${uniqueSuffix}`,
    },
  });

  const companyB = await prisma.company.create({
    data: {
      name: `Resolution Co B ${uniqueSuffix}`,
      slug: `res-co-b-${uniqueSuffix}`,
    },
  });

  const roleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `ROLE_A_${uniqueSuffix}`,
      description: "Role A",
      isSystem: false,
    },
  });

  const roleB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: `ROLE_B_${uniqueSuffix}`,
      description: "Role B",
      isSystem: false,
    },
  });

  const userA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: roleA.id,
      email: `agent_a_${uniqueSuffix}@tenant-a.com`,
      hashedPassword: "$2a$10$abcdefghijklmnopqrstuvwxyzABCDE",
      name: "Agent A",
      status: "ACTIVE",
    },
  });

  const userB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: roleB.id,
      email: `agent_b_${uniqueSuffix}@tenant-b.com`,
      hashedPassword: "$2a$10$abcdefghijklmnopqrstuvwxyzABCDE",
      name: "Agent B",
      status: "ACTIVE",
    },
  });

  const sessA = await createDbSession(userA.id, companyA.id);
  const ctxA = await validateSessionToken(sessA.rawToken);
  assert.ok(ctxA, "ctxA must be valid AuthContext");

  const sessB = await createDbSession(userB.id, companyB.id);
  const ctxB = await validateSessionToken(sessB.rawToken);
  assert.ok(ctxB, "ctxB must be valid AuthContext");

  try {
    // 1. First encounter creates new Customer
    console.log("  → Testing first encounter creates new Customer...");
    const res1 = await CustomerResolutionService.resolveCustomer(ctxA, {
      rawPhone: "9876543210",
      name: "Rahul Sharma",
      email: "rahul.sharma@example.com",
      companyName: "Sharma Textiles",
    });

    assert.equal(res1.isNew, true, "First resolution should create new customer");
    assert.equal(res1.matchedBy, "CREATED");
    assert.equal(res1.customer.name, "Rahul Sharma");
    assert.equal(res1.customer.companyId, companyA.id);
    assert.ok(res1.phoneRecord);
    assert.equal(res1.phoneRecord?.normalizedPhone, "+919876543210");

    // 2. Subsequent resolution with varied phone format resolves to same Customer
    console.log("  → Testing alternate format (+91-98765-43210) resolves to same Customer...");
    const res2 = await CustomerResolutionService.resolveCustomer(ctxA, {
      rawPhone: "+91-98765-43210",
      name: "Rahul S.", // Different display name in incoming payload
    });

    assert.equal(res2.isNew, false, "Subsequent encounter must NOT create new customer");
    assert.equal(res2.matchedBy, "PHONE");
    assert.equal(res2.customer.id, res1.customer.id, "Must resolve to existing customer ID");

    // 3. Cross-company same phone creates separate customer for Company B
    console.log("  → Testing cross-company same phone creates isolated Customer for Company B...");
    const resB = await CustomerResolutionService.resolveCustomer(ctxB, {
      rawPhone: "9876543210",
      name: "Rahul Sharma (Co B Client)",
    });

    assert.equal(resB.isNew, true, "Must create new customer in Company B despite same phone");
    assert.notEqual(resB.customer.id, res1.customer.id, "Customer IDs must not cross tenant boundaries");
    assert.equal(resB.customer.companyId, companyB.id);

    // 4. Multiple phone numbers on single customer
    console.log("  → Testing multi-phone identity: adding second phone and resolving by second phone...");
    const secondPhone = await CustomerResolutionService.addPhoneToCustomer(
      ctxA,
      res1.customer.id,
      "+91 99887 76655"
    );
    assert.equal(secondPhone.normalizedPhone, "+919988776655");

    // Now resolve using the SECOND phone
    const resSecond = await CustomerResolutionService.resolveCustomer(ctxA, {
      rawPhone: "9988776655",
    });

    assert.equal(resSecond.isNew, false);
    assert.equal(resSecond.matchedBy, "PHONE");
    assert.equal(resSecond.customer.id, res1.customer.id, "Resolving by second phone must return original master customer!");

    // 5. Attempting to add duplicate phone of another customer in same company fails
    console.log("  → Testing conflict when adding existing phone to a different customer...");
    const customer2 = await prisma.customer.create({
      data: {
        companyId: companyA.id,
        name: "Different Person",
      },
    });

    let conflictThrown = false;
    try {
      await CustomerResolutionService.addPhoneToCustomer(
        ctxA,
        customer2.id,
        "9876543210" // Belongs to Rahul Sharma
      );
    } catch (err) {
      if (err instanceof ConflictError) {
        conflictThrown = true;
      }
    }
    assert.equal(conflictThrown, true, "Adding existing customer phone to another customer must throw ConflictError");

    // 6. Explicit customerId resolution
    console.log("  → Testing explicit customerId resolution...");
    const resId = await CustomerResolutionService.resolveCustomer(ctxA, {
      customerId: res1.customer.id,
    });
    assert.equal(resId.isNew, false);
    assert.equal(resId.matchedBy, "EXPLICIT_ID");
    assert.equal(resId.customer.id, res1.customer.id);

    console.log("  ✅ Customer Resolution Integration Tests Passed!");
  } finally {
    // Cleanup
    await prisma.customerEmail.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.customerPhone.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.customer.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.session.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.user.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.role.deleteMany({
      where: { companyId: { in: [companyA.id, companyB.id] } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } },
    });
  }
}

if (require.main === module) {
  runCustomerResolutionIntegrationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
