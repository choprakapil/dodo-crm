import "dotenv/config";
// CRITICAL POSITIVE TEST DATABASE SAFETY (PHASE B.1): Must be first import
import { enforceTestDatabaseSafety } from "./test-db-guard";

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { LeadService } from "../lib/services/lead.service";
import { CustomerResolutionService } from "../lib/services/customer-resolution.service";
import { getTelUrl, getWhatsAppUrl, getMailtoUrl } from "../lib/utils/contact-actions";
import { LeadPriority } from "@prisma/client";
import { ValidationError } from "../lib/errors";

export async function runStage2SalesWorkflowTests() {
  console.log("\n🧪 Running Stage 2 Sales Workflow & Gatekeeping Tests...");

  // =========================================================================
  // Part 1: Contact Action Utilities Security & Validation
  // =========================================================================
  console.log("  → [Test 1] Testing Contact Action URL Generators...");

  // 1.1 Phone tel: links
  assert.equal(getTelUrl("+91 98765 43210"), "tel:+919876543210");
  assert.equal(getTelUrl("123-456-7890"), "tel:1234567890");
  assert.equal(getTelUrl(""), null);
  assert.equal(getTelUrl("123"), null); // too short
  assert.equal(getTelUrl(null), null);

  // 1.2 WhatsApp wa.me links
  assert.equal(getWhatsAppUrl("+91 98765 43210"), "https://wa.me/919876543210");
  assert.equal(getWhatsAppUrl("919876543210"), "https://wa.me/919876543210");
  assert.equal(getWhatsAppUrl("12345"), null); // under 7 digits
  assert.equal(getWhatsAppUrl(""), null);
  assert.equal(getWhatsAppUrl(null), null);

  // 1.3 Email mailto: links
  assert.equal(getMailtoUrl("contact@example.com"), "mailto:contact%40example.com");
  assert.equal(
    getMailtoUrl("contact@example.com", "Demo Follow-up"),
    "mailto:contact%40example.com?subject=Demo%20Follow-up"
  );
  assert.equal(getMailtoUrl("not-an-email"), null);
  assert.equal(getMailtoUrl(""), null);
  assert.equal(getMailtoUrl(null), null);

  console.log("  ✓ Test 1: Contact Action URL formatting and security validation passed.");

  // =========================================================================
  // Part 2: Pipeline Transitions & Disposition Gatekeeping (allowsClose)
  // =========================================================================
  console.log("  → [Test 2] Testing Pipeline Transitions & Disposition Gatekeeping...");

  let user = await prisma.user.findFirst({
    where: { role: { name: "Admin" }, deletedAt: null },
    include: { role: true, company: true },
  });
  if (!user) {
    user = await prisma.user.findFirst({
      where: { deletedAt: null },
      include: { role: true, company: true },
    });
  }
  if (!user) {
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: "Stage 2 Test Co",
          slug: `stage2-test-${Date.now()}`,
          currency: "INR",
        },
      });
    }
    let role = await prisma.role.findFirst({ where: { companyId: company.id } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          companyId: company.id,
          name: "Admin",
        },
      });
    }
    await prisma.permission.upsert({
      where: { roleId_module_action: { roleId: role.id, module: "leads", action: "manage" } },
      update: {},
      create: { roleId: role.id, module: "leads", action: "manage", dataScope: "COMPANY" as any },
    });
    await prisma.permission.upsert({
      where: { roleId_module_action: { roleId: role.id, module: "leads", action: "create" } },
      update: {},
      create: { roleId: role.id, module: "leads", action: "create", dataScope: "COMPANY" as any },
    });
    user = await prisma.user.create({
      data: {
        companyId: company.id,
        roleId: role.id,
        name: "Stage 2 Admin",
        email: `admin_${Date.now()}@testcrm.com`,
        hashedPassword: "hash",
        status: "ACTIVE",
      },
      include: { role: true, company: true },
    });
  }
  if (user.status !== "ACTIVE" || user.company.status !== "ACTIVE") {
    await prisma.company.update({ where: { id: user.companyId }, data: { status: "ACTIVE" } });
    user = await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
      include: { role: true, company: true },
    });
  }

  const session = await createDbSession(user.id, user.companyId);
  const ctx = await validateSessionToken(session.rawToken);
  assert.ok(ctx, "AuthContext must be generated");

  // Fetch or create dispositions with allowsClose=false and allowsClose=true
  let nonClosingDisp = await prisma.disposition.findFirst({
    where: { companyId: ctx.company.id, allowsClose: false, deletedAt: null },
  });

  if (!nonClosingDisp) {
    nonClosingDisp = await prisma.disposition.create({
      data: {
        companyId: ctx.company.id,
        name: "Stage 2 Callback Requested",
        allowsClose: false,
        allowsConvert: false,
        requiresFollowUp: true,
        followUpMandatory: false,
        depth: 0,
      },
    });
  }

  let closingDisp = await prisma.disposition.findFirst({
    where: { companyId: ctx.company.id, allowsClose: true, deletedAt: null },
  });

  if (!closingDisp) {
    closingDisp = await prisma.disposition.create({
      data: {
        companyId: ctx.company.id,
        name: "Stage 2 Deal Approved",
        allowsClose: true,
        allowsConvert: true,
        requiresFollowUp: false,
        followUpMandatory: false,
        depth: 0,
      },
    });
  }

  // Fetch statuses
  const closedStatus = await prisma.leadStatus.findFirst({
    where: {
      companyId: ctx.company.id,
      name: { contains: "closed" },
    },
  }) || (await prisma.leadStatus.findFirst({
    where: {
      companyId: ctx.company.id,
      name: { contains: "won" },
    },
  })) || (await prisma.leadStatus.create({
    data: {
      companyId: ctx.company.id,
      name: "Closed Won",
      color: "#10b981",
      displayOrder: 99,
    },
  }));

  const activeStatus = await prisma.leadStatus.findFirst({
    where: {
      companyId: ctx.company.id,
      name: { not: { contains: "closed" } },
    },
  });
  assert.ok(activeStatus, "Active status must exist");

  // Create lead with nonClosingDisp
  const testLead1 = await LeadService.createLead(ctx, {
    name: "Pipeline Test Prospect",
    phone: "+1 555-0188",
    priority: LeadPriority.HIGH,
    amount: 50000,
    statusId: activeStatus.id,
  });

  // Assign nonClosingDisp to lead
  await prisma.lead.update({
    where: { id: testLead1.id },
    data: { dispositionId: nonClosingDisp.id },
  });

  // Attempt to transition to closed status: MUST FAIL WITH DISPOSITION GATEKEEPING ERROR
  let gatekeepingBlocked = false;
  try {
    await LeadService.updateLead(ctx, testLead1.id, {
      statusId: closedStatus.id,
    });
  } catch (err: unknown) {
    if (err instanceof ValidationError && err.message.includes("does not allow closing")) {
      gatekeepingBlocked = true;
    }
  }

  assert.equal(
    gatekeepingBlocked,
    true,
    "Transition to closed status must be blocked by disposition allowsClose=false gatekeeping"
  );

  // Now assign closingDisp to lead
  await prisma.lead.update({
    where: { id: testLead1.id },
    data: { dispositionId: closingDisp.id },
  });

  // Attempt transition to closed status again: MUST SUCCEED
  const updatedLead1 = await LeadService.updateLead(ctx, testLead1.id, {
    statusId: closedStatus.id,
  });
  assert.equal(updatedLead1.statusId, closedStatus.id, "Transition must succeed when disposition allows closing");

  console.log("  ✓ Test 2: Pipeline status transition gatekeeping verified.");

  // =========================================================================
  // Part 3: Lead-to-Customer Conversion & Deduplication
  // =========================================================================
  console.log("  → [Test 3] Testing Lead-to-Customer Conversion Logic & Deduplication...");

  // 3.1 Create a lead initially without phone (unlinked to customer)
  const unlinkedLead = await LeadService.createLead(ctx, {
    name: "Conversion Test Lead",
    company: "Acme Conversion Target Corp",
    email: `convert.${Date.now()}@example.com`,
    priority: LeadPriority.URGENT,
    amount: 85000,
  });

  assert.equal(unlinkedLead.customerId, null, "Lead created without phone should not be linked to customer initially");

  // 3.2 Now update phone and resolve / convert customer
  const uniquePhone = `+1555${Math.floor(100000 + Math.random() * 900000)}`;

  const resolution = await CustomerResolutionService.resolveCustomer(ctx, {
    rawPhone: uniquePhone,
    name: unlinkedLead.name,
    email: unlinkedLead.email,
    companyName: unlinkedLead.company,
  });

  assert.ok(resolution.customer.id, "Customer must be created with ID");
  assert.equal(resolution.isNew, true, "First resolution should create a new customer");

  // Link lead to customer
  const linkedLead = await LeadService.updateLead(ctx, unlinkedLead.id, {
    phone: uniquePhone,
    customerId: resolution.customer.id,
  });
  assert.equal(linkedLead.customerId, resolution.customer.id, "Lead must be linked to converted customer");

  // 3.3 Test deduplication: Creating another lead with the same phone links to the SAME customer
  const secondLead = await LeadService.createLead(ctx, {
    name: "Second Contact Same Phone",
    phone: uniquePhone,
  });

  assert.equal(
    secondLead.customerId,
    resolution.customer.id,
    "Second lead with same normalized phone must link to the existing customer without creating a duplicate"
  );

  console.log("  ✓ Test 3: Lead-to-Customer conversion and phone deduplication verified.");

  // =========================================================================
  // Clean up test data
  // =========================================================================
  await prisma.lead.deleteMany({
    where: { id: { in: [testLead1.id, unlinkedLead.id, secondLead.id] } },
  });
  await prisma.customerPhone.deleteMany({
    where: { customerId: resolution.customer.id },
  });
  await prisma.customer.deleteMany({
    where: { id: resolution.customer.id },
  });

  console.log("  ✓ Cleanup complete.");
}

// Allow standalone execution via ts-node
if (require.main === module) {
  runStage2SalesWorkflowTests()
    .then(() => {
      console.log("\n✅ Stage 2 Sales Workflow Tests passed!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Stage 2 Sales Workflow Tests failed:", err);
      process.exit(1);
    });
}
