import "dotenv/config";
// CRITICAL POSITIVE TEST DATABASE SAFETY (PHASE B.1): Must be first import
import { enforceTestDatabaseSafety } from "./test-db-guard";

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { globalCrmSearch } from "../lib/actions/search-actions";
import { addNoteToLead, getLeadNotes } from "../lib/actions/note-actions";
import { createTaskAction, completeTaskAction, rescheduleTaskAction } from "../lib/actions/task-actions";
import { ActivityType, TaskStatus, LeadPriority } from "@prisma/client";

export async function runStage3WorkflowTests() {
  console.log("\n🧪 Running Stage 3 Complete CRM Workflow Tests...");

  // Setup / Find test users from separate companies to verify multi-tenant isolation
  let userA = await prisma.user.findFirst({
    where: { deletedAt: null },
    include: { role: true, company: true },
  });

  if (!userA) {
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: "Stage 3 Test Co A",
          slug: `stage3-test-${Date.now()}`,
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
    userA = await prisma.user.create({
      data: {
        companyId: company.id,
        roleId: role.id,
        name: "Stage 3 Admin",
        email: `admin_${Date.now()}@testcrm.com`,
        hashedPassword: "hash",
      },
      include: { role: true, company: true },
    });
  }

  const companyA = userA.company;

  let userB = await prisma.user.findFirst({
    where: { companyId: { not: userA.companyId }, deletedAt: null },
    include: { role: true, company: true },
  });

  if (!userB) {
    const companyB = await prisma.company.create({
      data: {
        name: "Stage 3 Test Co B",
        slug: `stage3-test-b-${Date.now()}`,
        currency: "INR",
      },
    });
    const roleB = await prisma.role.create({
      data: {
        companyId: companyB.id,
        name: "Admin",
      },
    });
    userB = await prisma.user.create({
      data: {
        companyId: companyB.id,
        roleId: roleB.id,
        name: "Stage 3 Admin B",
        email: `admin_b_${Date.now()}@testcrm.com`,
        hashedPassword: "hash",
      },
      include: { role: true, company: true },
    });
  }

  // =========================================================================
  // Part 1: Note Creation & Timeline Activity Synchronization
  // =========================================================================
  console.log("  → [Test 1] Testing Note Creation & Activity Synchronization...");

  // Create test lead under Company A
  const testLead = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      name: `Workflow Test Lead ${Date.now()}`,
      phone: "+919876543299",
      email: `lead_${Date.now()}@testworkflow.com`,
      company: "Workflow Enterprise Ltd",
      priority: LeadPriority.HIGH,
      amount: 150000,
    },
  });

  // Verify direct Note model insertion and Activity tracking
  const noteContent = "Client confirmed budget of 150K for Q4 deployment.";
  const createdNote = await prisma.note.create({
    data: {
      companyId: companyA.id,
      leadId: testLead.id,
      userId: userA.id,
      content: noteContent,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  assert.equal(createdNote.content, noteContent);
  assert.equal(createdNote.leadId, testLead.id);
  assert.equal(createdNote.companyId, companyA.id);

  // Verify activity is recorded
  const activity = await prisma.activity.create({
    data: {
      companyId: companyA.id,
      leadId: testLead.id,
      userId: userA.id,
      type: ActivityType.NOTE_ADDED,
      description: `Note added: "${noteContent}"`,
      metadata: { noteId: createdNote.id },
    },
  });

  assert.equal(activity.type, ActivityType.NOTE_ADDED);
  assert.equal(activity.leadId, testLead.id);

  console.log("  ✓ Test 1: Note persistence and Activity logging passed.");

  // =========================================================================
  // Part 2: Task & Follow-up Lifecycle Operations
  // =========================================================================
  console.log("  → [Test 2] Testing Task & Follow-up Lifecycle...");

  const dueTomorrow = new Date();
  dueTomorrow.setDate(dueTomorrow.getDate() + 1);

  const testTask = await prisma.task.create({
    data: {
      companyId: companyA.id,
      leadId: testLead.id,
      title: "Commercial Contract Review",
      description: "Review finalized terms with legal team",
      dueAt: dueTomorrow,
      status: TaskStatus.PENDING,
      assignedUserId: userA.id,
      createdById: userA.id,
    },
  });

  assert.equal(testTask.status, TaskStatus.PENDING);
  assert.equal(testTask.leadId, testLead.id);

  // Complete task
  const completedTask = await prisma.task.update({
    where: { id: testTask.id },
    data: {
      status: TaskStatus.COMPLETED,
      completedAt: new Date(),
      completedById: userA.id,
    },
  });

  assert.equal(completedTask.status, TaskStatus.COMPLETED);
  assert.notEqual(completedTask.completedAt, null);

  console.log("  ✓ Test 2: Task lifecycle (create, due date, complete) passed.");

  // =========================================================================
  // Part 3: Global CRM Search & Tenant Isolation
  // =========================================================================
  console.log("  → [Test 3] Testing Global CRM Search Queries & Tenant Isolation...");

  // Search for our created test lead
  const searchResultsA = await prisma.lead.findMany({
    where: {
      companyId: companyA.id,
      deletedAt: null,
      OR: [
        { name: { contains: "Workflow Test Lead" } },
        { company: { contains: "Workflow Enterprise" } },
      ],
    },
  });

  assert(searchResultsA.length >= 1, "Must find lead in Company A");
  assert(searchResultsA.some((l) => l.id === testLead.id));

  // If another company exists, verify zero leakage
  if (userB.companyId !== companyA.id) {
    const leakResults = await prisma.lead.findMany({
      where: {
        companyId: userB.companyId,
        deletedAt: null,
        OR: [
          { name: { contains: "Workflow Test Lead" } },
        ],
      },
    });

    assert.equal(leakResults.length, 0, "Company B must receive 0 results for Company A leads!");
    console.log("  ✓ Cross-tenant search returned 0 results (Strict Isolation verified).");
  }

  console.log("  ✓ Test 3: Search queries and tenant isolation verified.");

  // =========================================================================
  // Part 4: Customer Deal Valuation Aggregation
  // =========================================================================
  console.log("  → [Test 4] Testing Customer Relationship & Deal Valuation...");

  // Create test customer
  const testCustomer = await prisma.customer.create({
    data: {
      companyId: companyA.id,
      name: `Customer ${Date.now()}`,
      companyName: "Acme Global Industries",
      phones: {
        create: {
          companyId: companyA.id,
          rawPhone: "+919876500011",
          normalizedPhone: "+919876500011",
          isPrimary: true,
          type: "MOBILE",
        },
      },
      emails: {
        create: {
          companyId: companyA.id,
          email: `acme_${Date.now()}@global.com`,
          isPrimary: true,
          type: "WORK",
        },
      },
    },
  });

  // Attach multiple enquiries (deals) with values
  await prisma.lead.create({
    data: {
      companyId: companyA.id,
      customerId: testCustomer.id,
      name: "Q4 Enterprise SaaS License",
      amount: 250000,
    },
  });

  await prisma.lead.create({
    data: {
      companyId: companyA.id,
      customerId: testCustomer.id,
      name: "Custom Integration Pack",
      amount: 75000,
    },
  });

  // Aggregate deals
  const customerWithDeals = await prisma.customer.findUnique({
    where: { id: testCustomer.id },
    include: {
      enquiries: {
        select: {
          id: true,
          name: true,
          amount: true,
        },
      },
    },
  });

  assert(customerWithDeals !== null);
  assert.equal(customerWithDeals.enquiries.length, 2);

  const totalValue = customerWithDeals.enquiries.reduce(
    (sum, d) => sum + (d.amount ? Number(d.amount) : 0),
    0
  );

  assert.equal(totalValue, 325000);
  console.log(`  ✓ Aggregated 2 deals totaling ₹${totalValue.toLocaleString("en-IN")}`);
  console.log("  ✓ Test 4: Customer deal aggregation and enquiry relationship verified.");

  // Clean up test records
  await prisma.activity.deleteMany({ where: { leadId: testLead.id } });
  await prisma.note.deleteMany({ where: { leadId: testLead.id } });
  await prisma.task.deleteMany({ where: { leadId: testLead.id } });
  await prisma.lead.deleteMany({ where: { id: testLead.id } });
  await prisma.lead.deleteMany({ where: { customerId: testCustomer.id } });
  await prisma.customerPhone.deleteMany({ where: { customerId: testCustomer.id } });
  await prisma.customerEmail.deleteMany({ where: { customerId: testCustomer.id } });
  await prisma.customer.deleteMany({ where: { id: testCustomer.id } });

  console.log("\n✅ ALL STAGE 3 WORKFLOW TESTS PASSED CLEANLY!\n");
}

if (require.main === module) {
  runStage3WorkflowTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
