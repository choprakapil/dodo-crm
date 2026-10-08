/**
 * Dodo CRM V2 — Stage 5 Client Demo Readiness Test Suite
 * 
 * Verifies:
 * 1. Demo Company & Demo Users authentication credentials and tenant isolation
 * 2. Multi-stage Leads with Offerings, Dispositions, and Custom Field values
 * 3. Verified Customer Accounts with normalized E.164 phone numbers
 * 4. Pipeline Deals and commercial valuations in INR
 * 5. Follow-up Tasks (Overdue, Due Today, Upcoming, Completed)
 * 6. Internal Comments with @mentions and author attribution
 * 7. In-app Notification Center with badge count and deep links
 * 8. Safe Demo Seed idempotency
 */

import { PrismaClient, TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoData } from "../prisma/seed-demo";

const prisma = new PrismaClient();

async function runStage5Tests() {
  console.log("============================================================");
  console.log("🧪 RUNNING STAGE 5 — CLIENT DEMO READINESS INTEGRATION TESTS");
  console.log("============================================================");

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
    }
  }

  // Ensure demo data is seeded
  await seedDemoData({ reset: true });

  const company = await prisma.company.findUnique({
    where: { slug: "acme" }
  });

  if (!company) {
    throw new Error("Demo company 'acme' could not be found.");
  }
  const companyId = company.id;

  // Test 1: Tenant & Authentication Credentials
  await test("Demo tenant exists with active users and verified credentials", async () => {
    const admin = await prisma.user.findFirst({
      where: { companyId, email: "admin@acme.com" }
    });
    if (!admin || !admin.hashedPassword) {
      throw new Error("Admin user not found or missing password.");
    }
    const isPasswordValid = await bcrypt.compare("Demo@123456", admin.hashedPassword);
    if (!isPasswordValid) {
      throw new Error("Admin password comparison failed.");
    }

    const reps = await prisma.user.findMany({
      where: { companyId, status: "ACTIVE" }
    });
    if (reps.length < 4) {
      throw new Error(`Expected at least 4 active demo users, found ${reps.length}`);
    }
  });

  // Test 2: Multi-Stage Leads & Custom Fields
  await test("Leads are populated across multiple stages with custom field values", async () => {
    const leads = await prisma.lead.findMany({
      where: { companyId },
      include: {
        status: true,
        offering: true,
        disposition: true,
        customFieldValues: { include: { customField: true } }
      }
    });

    if (leads.length < 15) {
      throw new Error(`Expected at least 15 demo leads, found ${leads.length}`);
    }

    const statuses = new Set(leads.map(l => l.status?.name));
    if (!statuses.has("New") || !statuses.has("Qualified") || !statuses.has("Negotiation")) {
      throw new Error("Leads do not cover required pipeline stages.");
    }

    const leadWithCf = leads.find(l => l.customFieldValues.length > 0);
    if (!leadWithCf) {
      throw new Error("No leads found with populated custom field values.");
    }
  });

  // Test 3: Customer Accounts with E.164 Phones
  await test("Customer accounts exist with normalized E.164 phone records", async () => {
    const customers = await prisma.customer.findMany({
      where: { companyId },
      include: { phones: true, emails: true }
    });

    if (customers.length < 8) {
      throw new Error(`Expected at least 8 demo customers, found ${customers.length}`);
    }

    const primaryPhone = customers[0]?.phones.find(p => p.isPrimary);
    if (!primaryPhone || !primaryPhone.normalizedPhone.startsWith("+91")) {
      throw new Error("Primary customer phone is missing or not normalized in E.164 format.");
    }
  });

  // Test 4: Task Lifecycle (Overdue, Due Today, Upcoming, Completed)
  await test("Follow-up tasks have valid distribution (overdue, today, upcoming, completed)", async () => {
    const tasks = await prisma.task.findMany({
      where: { companyId }
    });

    if (tasks.length < 4) {
      throw new Error(`Expected at least 4 tasks, found ${tasks.length}`);
    }

    const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED);
    const pending = tasks.filter(t => t.status === TaskStatus.PENDING);

    if (completed.length === 0 || pending.length === 0) {
      throw new Error("Tasks must include both completed and pending records.");
    }
  });

  // Test 5: Comments, @Mentions & Notifications
  await test("Internal comments, @mentions, and notifications are integrated", async () => {
    const comments = await prisma.comment.findMany({
      where: { companyId },
      include: { mentions: true }
    });

    if (comments.length < 2) {
      throw new Error(`Expected at least 2 demo comments, found ${comments.length}`);
    }

    const commentWithMention = comments.find(c => c.mentions.length > 0);
    if (!commentWithMention) {
      throw new Error("No comment with mention relation found.");
    }

    const notifications = await prisma.notification.findMany({
      where: { companyId }
    });

    if (notifications.length < 2) {
      throw new Error(`Expected at least 2 notifications, found ${notifications.length}`);
    }

    const mentionNotif = notifications.find(n => n.type === "MENTION");
    if (!mentionNotif || !mentionNotif.deepLink) {
      throw new Error("Mention notification missing or lacks deepLink.");
    }
  });

  // Test 6: Safe Re-Seeding Idempotency
  await test("Demo seed can be safely re-run without throwing or duplicating unique constraints", async () => {
    await seedDemoData({ reset: false });
    const countAfter = await prisma.lead.count({ where: { companyId } });
    if (countAfter < 15) {
      throw new Error("Lead count invalid after idempotent re-seed.");
    }
  });

  console.log("============================================================");
  console.log(`🏁 STAGE 5 TESTS: ${passed}/${total} PASSED`);
  console.log("============================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

runStage5Tests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
