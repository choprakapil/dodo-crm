/**
 * Universal CRM — Database Seed Script
 *
 * Seeds:
 *   1 Super Admin
 *   2 Companies (Tenant A: Acme Corp, Tenant B: Zenith Solutions)
 *   Per company:
 *     - 5 system roles (Admin, Manager, Sales Rep, Viewer, Support)
 *     - Permissions per role
 *     - 1 team (Sales Team)
 *     - 4 users (1 admin, 1 manager, 2 sales reps)
 *     - 5 lead sources
 *     - 6 lead statuses (1 default)
 *     - 50 leads with varied sources, statuses, assignments
 *     - Notes, tasks, and activities on leads
 *
 * Usage: npx prisma db seed
 * Or via npm: npm run seed
 *
 * ADR-004: Super Admin created via seed script only (no first-run UI).
 * ADR-007: All seed data respects companyId isolation.
 */

import { PrismaClient, CompanyStatus, UserStatus, LeadPriority, TaskPriority, TaskStatus, ActivityType, DataScope, PlanTier } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// =============================================================================
// CONSTANTS
// =============================================================================

const HASH_ROUNDS = 12;

async function hashPassword(password: string) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

// =============================================================================
// SEED PLANS (SLICE 8)
// =============================================================================

async function seedPlans() {
  const plans = [
    {
      name: "Free",
      code: PlanTier.FREE,
      description: "Basic features for small teams testing Universal CRM.",
      maxUsers: 2,
      maxLeads: 100,
      features: { customFields: false, export: false, analytics: true, auditLogs: false },
    },
    {
      name: "Starter",
      code: PlanTier.STARTER,
      description: "Essential CRM tooling for growing sales teams.",
      maxUsers: 5,
      maxLeads: 1000,
      features: { customFields: true, export: true, analytics: true, auditLogs: true },
    },
    {
      name: "Professional",
      code: PlanTier.PROFESSIONAL,
      description: "Advanced pipeline management, custom fields, and analytics.",
      maxUsers: 25,
      maxLeads: 10000,
      features: { customFields: true, export: true, analytics: true, auditLogs: true, advancedReports: true },
    },
    {
      name: "Enterprise",
      code: PlanTier.ENTERPRISE,
      description: "Full platform scale, limitless capacity, and maximum compliance.",
      maxUsers: 100,
      maxLeads: 100000,
      features: { customFields: true, export: true, analytics: true, auditLogs: true, advancedReports: true, dedicatedSupport: true },
    },
  ];

  const planMap: Record<PlanTier, { id: string; name: string; code: PlanTier; maxUsers: number; maxLeads: number }> = {} as any;
  for (const p of plans) {
    const plan = await prisma.plan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        description: p.description,
        maxUsers: p.maxUsers,
        maxLeads: p.maxLeads,
        features: p.features,
      },
      create: p,
    });
    planMap[p.code] = plan;
    console.log(`  ✓ Plan seeded: ${p.name} (${p.code})`);
  }
  return planMap;
}

// =============================================================================
// SEED SUPER ADMIN
// =============================================================================

async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@universalcrm.com";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe@SuperAdmin123!";
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";

  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Super Admin already exists: ${email}`);
    return existing;
  }

  const superAdmin = await prisma.superAdmin.create({
    data: {
      email,
      hashedPassword: await hashPassword(password),
      name,
    },
  });
  console.log(`✓ Super Admin created: ${email}`);
  return superAdmin;
}

// =============================================================================
// SEED COMPANY
// =============================================================================

async function seedCompany(data: {
  name: string;
  slug: string;
  email: string;
  timezone: string;
  currency?: string;
  planId?: string;
}) {
  const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
  if (existing) {
    if (data.planId && !existing.planId) {
      await prisma.company.update({
        where: { id: existing.id },
        data: { planId: data.planId },
      });
    }
    console.log(`  ✓ Company already exists: ${data.name}`);
    return existing;
  }

  const company = await prisma.company.create({
    data: {
      name: data.name,
      slug: data.slug,
      email: data.email,
      timezone: data.timezone,
      currency: data.currency || "USD",
      status: CompanyStatus.ACTIVE,
      planId: data.planId,
      onboardingCompleted: true,
      onboardingStep: "COMPLETED",
      onboardingCompletedAt: new Date(),
    },
  });
  console.log(`  ✓ Company created: ${data.name} (${company.id})`);
  return company;
}

// =============================================================================
// SEED ROLES + PERMISSIONS
// =============================================================================

const MODULES = ["customers", "leads", "offerings", "users", "teams", "reports", "settings", "audit_logs", "tasks", "notes", "activities", "custom_fields"];

const ROLE_CONFIGS = [
  {
    name: "Admin",
    description: "Full administrative access to all company records, settings, users, and audit logs.",
    isSystem: true,
    permissions: MODULES.map((module) => ({
      module,
      action: "manage",
      dataScope: DataScope.COMPANY,
    })),
  },
  {
    name: "Manager",
    description: "Manages team leads, tasks, activities, and views team reports.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "customers", action: "create", dataScope: DataScope.COMPANY },
      { module: "customers", action: "update", dataScope: DataScope.COMPANY },
      { module: "customers", action: "manage", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "create", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "update", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "manage", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.TEAM },
      { module: "leads", action: "create", dataScope: DataScope.TEAM },
      { module: "leads", action: "update", dataScope: DataScope.TEAM },
      { module: "leads", action: "assign", dataScope: DataScope.TEAM },
      { module: "leads", action: "delete", dataScope: DataScope.TEAM },
      { module: "leads", action: "export", dataScope: DataScope.TEAM },
      { module: "tasks", action: "view", dataScope: DataScope.TEAM },
      { module: "tasks", action: "create", dataScope: DataScope.TEAM },
      { module: "tasks", action: "update", dataScope: DataScope.TEAM },
      { module: "tasks", action: "delete", dataScope: DataScope.TEAM },
      { module: "activities", action: "view", dataScope: DataScope.TEAM },
      { module: "activities", action: "create", dataScope: DataScope.TEAM },
      { module: "activities", action: "update", dataScope: DataScope.TEAM },
      { module: "activities", action: "delete", dataScope: DataScope.TEAM },
      { module: "notes", action: "view", dataScope: DataScope.TEAM },
      { module: "notes", action: "create", dataScope: DataScope.TEAM },
      { module: "notes", action: "update", dataScope: DataScope.TEAM },
      { module: "users", action: "view", dataScope: DataScope.COMPANY },
      { module: "teams", action: "view", dataScope: DataScope.COMPANY },
      { module: "reports", action: "view", dataScope: DataScope.TEAM },
      { module: "custom_fields", action: "view", dataScope: DataScope.COMPANY },
    ],
  },
  {
    name: "Sales Rep",
    description: "Manages own assigned leads, activities, tasks, and follow-ups.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "customers", action: "create", dataScope: DataScope.COMPANY },
      { module: "customers", action: "update", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.OWN },
      { module: "leads", action: "create", dataScope: DataScope.OWN },
      { module: "leads", action: "update", dataScope: DataScope.OWN },
      { module: "leads", action: "export", dataScope: DataScope.OWN },
      { module: "tasks", action: "view", dataScope: DataScope.OWN },
      { module: "tasks", action: "create", dataScope: DataScope.OWN },
      { module: "tasks", action: "update", dataScope: DataScope.OWN },
      { module: "activities", action: "view", dataScope: DataScope.OWN },
      { module: "activities", action: "create", dataScope: DataScope.OWN },
      { module: "activities", action: "update", dataScope: DataScope.OWN },
      { module: "notes", action: "view", dataScope: DataScope.OWN },
      { module: "notes", action: "create", dataScope: DataScope.OWN },
      { module: "notes", action: "update", dataScope: DataScope.OWN },
      { module: "custom_fields", action: "view", dataScope: DataScope.COMPANY },
    ],
  },
  {
    name: "Viewer",
    description: "Read-only access to company leads, tasks, and reports.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.COMPANY },
      { module: "tasks", action: "view", dataScope: DataScope.COMPANY },
      { module: "activities", action: "view", dataScope: DataScope.COMPANY },
      { module: "reports", action: "view", dataScope: DataScope.COMPANY },
    ],
  },
  {
    name: "Support",
    description: "Access to view leads and log activities/notes across the company.",
    isSystem: true,
    permissions: [
      { module: "customers", action: "view", dataScope: DataScope.COMPANY },
      { module: "customers", action: "update", dataScope: DataScope.COMPANY },
      { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "view", dataScope: DataScope.COMPANY },
      { module: "leads", action: "update", dataScope: DataScope.COMPANY },
      { module: "activities", action: "view", dataScope: DataScope.COMPANY },
      { module: "activities", action: "create", dataScope: DataScope.COMPANY },
      { module: "notes", action: "view", dataScope: DataScope.COMPANY },
      { module: "notes", action: "create", dataScope: DataScope.COMPANY },
      { module: "tasks", action: "view", dataScope: DataScope.COMPANY },
      { module: "tasks", action: "create", dataScope: DataScope.COMPANY },
    ],
  },
];

async function seedRoles(companyId: string) {
  const roles: Record<string, { id: string }> = {};

  for (const config of ROLE_CONFIGS) {
    const existing = await prisma.role.findUnique({
      where: { companyId_name: { companyId, name: config.name } },
    });

    if (existing) {
      if (!existing.description && config.description) {
        await prisma.role.update({
          where: { id: existing.id },
          data: { description: config.description },
        });
      }
      console.log(`    ✓ Role already exists: ${config.name}`);
      roles[config.name] = existing;
      continue;
    }

    const role = await prisma.role.create({
      data: {
        companyId,
        name: config.name,
        description: config.description,
        isSystem: config.isSystem,
        permissions: {
          createMany: {
            data: config.permissions.map((p) => ({
              module: p.module,
              action: p.action,
              dataScope: p.dataScope,
            })),
          },
        },
      },
    });
    console.log(`    ✓ Role created: ${config.name} (${role.id})`);
    roles[config.name] = role;
  }

  return roles;
}

// =============================================================================
// SEED USERS
// =============================================================================

async function seedUser(data: {
  companyId: string;
  roleId: string;
  email: string;
  name: string;
  phone?: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { companyId_email: { companyId: data.companyId, email: data.email } },
  });

  if (existing) {
    console.log(`    ✓ User already exists: ${data.email}`);
    return existing;
  }

  const user = await prisma.user.create({
    data: {
      companyId: data.companyId,
      roleId: data.roleId,
      email: data.email,
      name: data.name,
      phone: data.phone,
      hashedPassword: await hashPassword(data.password),
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`    ✓ User created: ${data.email}`);
  return user;
}

// =============================================================================
// SEED LEAD SOURCES
// =============================================================================

async function seedLeadSources(companyId: string) {
  const sources = ["Website", "Google Ads", "Referral", "Cold Call", "Trade Show"];
  const result: { id: string; name: string }[] = [];

  for (const name of sources) {
    const existing = await prisma.leadSource.findUnique({
      where: { companyId_name: { companyId, name } },
    });

    if (existing) {
      result.push(existing);
      continue;
    }

    const source = await prisma.leadSource.create({
      data: { companyId, name },
    });
    result.push(source);
  }
  console.log(`    ✓ Lead Sources: ${sources.join(", ")}`);
  return result;
}

// =============================================================================
// SEED LEAD STATUSES
// =============================================================================

async function seedLeadStatuses(companyId: string) {
  const statuses = [
    { name: "New", color: "#6366f1", isDefault: true, displayOrder: 0 },
    { name: "Contacted", color: "#f59e0b", isDefault: false, displayOrder: 1 },
    { name: "Interested", color: "#3b82f6", isDefault: false, displayOrder: 2 },
    { name: "Proposal Sent", color: "#8b5cf6", isDefault: false, displayOrder: 3 },
    { name: "Converted", color: "#10b981", isDefault: false, displayOrder: 4 },
    { name: "Lost", color: "#ef4444", isDefault: false, displayOrder: 5 },
  ];

  const result: { id: string; name: string; isDefault: boolean }[] = [];

  for (const s of statuses) {
    const existing = await prisma.leadStatus.findUnique({
      where: { companyId_name: { companyId, name: s.name } },
    });

    if (existing) {
      result.push(existing);
      continue;
    }

    const status = await prisma.leadStatus.create({
      data: { companyId, ...s },
    });
    result.push(status);
  }
  console.log(`    ✓ Lead Statuses: ${statuses.map((s) => s.name).join(", ")}`);
  return result;
}

// =============================================================================
// SEED LEADS + ACTIVITIES + NOTES + TASKS
// =============================================================================

const FIRST_NAMES = ["James", "Emma", "Liam", "Olivia", "Noah", "Ava", "William", "Sophia", "Benjamin", "Isabella", "Mason", "Charlotte", "Elijah", "Mia", "Oliver", "Amelia", "Jacob", "Harper", "Lucas", "Evelyn", "Michael", "Abigail", "Alexander", "Emily", "Ethan", "Elizabeth", "Daniel", "Sofia", "Matthew", "Avery"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson"];
const COMPANIES = ["Tech Solutions Inc", "Global Ventures", "Apex Industries", "Pinnacle Corp", "Summit Group", "Horizon Enterprises", "Catalyst Systems", "Vertex Digital", "Nexus Holdings", "Meridian Partners"];
const DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "company.com", "business.net"];
const PRIORITIES = [LeadPriority.LOW, LeadPriority.MEDIUM, LeadPriority.HIGH, LeadPriority.URGENT];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedLeads(
  companyId: string,
  users: { id: string }[],
  sources: { id: string }[],
  statuses: { id: string; isDefault: boolean }[],
  count = 50
) {
  const existingCount = await prisma.lead.count({ where: { companyId } });
  if (existingCount >= count) {
    console.log(`    ✓ Leads already seeded (${existingCount} found)`);
    return;
  }

  const leads = [];
  for (let i = 0; i < count; i++) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${randomItem(DOMAINS)}`;
    const status = randomItem(statuses);
    const user = randomItem(users);

    const lead = await prisma.lead.create({
      data: {
        companyId,
        name,
        email,
        phone: `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`,
        company: randomItem(COMPANIES),
        sourceId: randomItem(sources).id,
        statusId: status.id,
        assignedUserId: user.id,
        priority: randomItem(PRIORITIES),
        amount: randomInt(1000, 100000),
        createdAt: new Date(Date.now() - randomInt(0, 90) * 24 * 60 * 60 * 1000),
      },
    });
    leads.push({ lead, status, user });

    // Seed a note for ~40% of leads
    if (Math.random() < 0.4) {
      await prisma.note.create({
        data: {
          companyId,
          leadId: lead.id,
          userId: user.id,
          content: `Initial contact made. ${name} expressed interest in our ${randomItem(["enterprise", "professional", "starter"])} plan. Follow up scheduled.`,
        },
      });
    }

    // Seed a task for ~50% of leads
    if (Math.random() < 0.5) {
      const dueDate = new Date(Date.now() + randomInt(1, 14) * 24 * 60 * 60 * 1000);
      await prisma.task.create({
        data: {
          companyId,
          leadId: lead.id,
          assignedUserId: user.id,
          title: randomItem([
            "Follow up with prospect",
            "Send proposal",
            "Schedule demo",
            "Check in on decision",
            "Send pricing information",
          ]),
          dueAt: dueDate,
          priority: randomItem([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH]),
          status: TaskStatus.PENDING,
        },
      });
    }

    // Record lead created activity
    await prisma.activity.create({
      data: {
        companyId,
        leadId: lead.id,
        userId: user.id,
        type: ActivityType.LEAD_CREATED,
        description: `Lead created: ${name}`,
        metadata: { source: sources.find((s) => s.id === lead.sourceId)?.id },
      },
    });

    // Record status history
    await prisma.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        companyId,
        fromStatusId: null,
        toStatusId: status.id,
        changedById: user.id,
      },
    });

    // Record assignment history
    await prisma.leadAssignmentHistory.create({
      data: {
        leadId: lead.id,
        companyId,
        fromUserId: null,
        toUserId: user.id,
        assignedById: user.id,
      },
    });
  }
  console.log(`    ✓ Seeded ${count} leads with notes, tasks, and activities`);
}

// =============================================================================
// SEED TEAM
// =============================================================================

async function seedTeam(companyId: string, userIds: string[], managerId?: string) {
  const existing = await prisma.team.findUnique({
    where: { companyId_name: { companyId, name: "Sales Team" } },
  });

  const team = existing
    ? await prisma.team.update({
        where: { id: existing.id },
        data: {
          description: existing.description ?? "Primary outbound and inbound sales squad.",
          managerId: existing.managerId ?? managerId,
        },
      })
    : await prisma.team.create({
        data: {
          companyId,
          name: "Sales Team",
          description: "Primary outbound and inbound sales squad.",
          managerId,
        },
      });

  // Add all users to team
  for (const userId of userIds) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId } },
      update: {},
      create: { companyId, teamId: team.id, userId },
    });
  }
  console.log(`    ✓ Team created: Sales Team (${userIds.length} members)`);
  return team;
}

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log("\n🌱 Starting Universal CRM database seed...\n");

  // --- PLANS (SLICE 8) ---
  console.log("→ Seeding Plans...");
  const plans = await seedPlans();

  // --- SUPER ADMIN ---
  console.log("\n→ Seeding Super Admin...");
  await seedSuperAdmin();

  // --- COMPANY A: ACME CORP ---
  console.log("\n→ Seeding Company A: Acme Corp...");
  const companyA = await seedCompany({
    name: "Acme Corp",
    slug: "acme-corp",
    email: "admin@acmecorp.com",
    timezone: "America/New_York",
    planId: plans[PlanTier.STARTER].id,
  });

  console.log("  → Roles...");
  const rolesA = await seedRoles(companyA.id);

  console.log("  → Users...");
  const adminA = await seedUser({
    companyId: companyA.id,
    roleId: rolesA["Admin"].id,
    email: "admin@acmecorp.com",
    name: "Alice Johnson",
    phone: "+12125551001",
    password: "Admin@Acme123!",
  });
  const managerA = await seedUser({
    companyId: companyA.id,
    roleId: rolesA["Manager"].id,
    email: "manager@acmecorp.com",
    name: "Bob Williams",
    phone: "+12125551002",
    password: "Manager@Acme123!",
  });
  const rep1A = await seedUser({
    companyId: companyA.id,
    roleId: rolesA["Sales Rep"].id,
    email: "sarah@acmecorp.com",
    name: "Sarah Davis",
    phone: "+12125551003",
    password: "SalesRep@Acme123!",
  });
  const rep2A = await seedUser({
    companyId: companyA.id,
    roleId: rolesA["Sales Rep"].id,
    email: "mike@acmecorp.com",
    name: "Mike Brown",
    phone: "+12125551004",
    password: "SalesRep@Acme123!",
  });

  console.log("  → Team...");
  await seedTeam(companyA.id, [adminA.id, managerA.id, rep1A.id, rep2A.id], managerA.id);

  console.log("  → Lead Sources...");
  const sourcesA = await seedLeadSources(companyA.id);

  console.log("  → Lead Statuses...");
  const statusesA = await seedLeadStatuses(companyA.id);

  console.log("  → Leads...");
  await seedLeads(
    companyA.id,
    [managerA, rep1A, rep2A],
    sourcesA,
    statusesA,
    50
  );

  // --- COMPANY B: ZENITH SOLUTIONS ---
  console.log("\n→ Seeding Company B: Zenith Solutions...");
  const companyB = await seedCompany({
    name: "Zenith Solutions",
    slug: "zenith-solutions",
    email: "admin@zenithsolutions.com",
    timezone: "America/Los_Angeles",
    planId: plans[PlanTier.PROFESSIONAL].id,
  });

  console.log("  → Roles...");
  const rolesB = await seedRoles(companyB.id);

  console.log("  → Users...");
  const adminB = await seedUser({
    companyId: companyB.id,
    roleId: rolesB["Admin"].id,
    email: "admin@zenithsolutions.com",
    name: "Carol Martinez",
    phone: "+13105551001",
    password: "Admin@Zenith123!",
  });
  const managerB = await seedUser({
    companyId: companyB.id,
    roleId: rolesB["Manager"].id,
    email: "manager@zenithsolutions.com",
    name: "David Lee",
    phone: "+13105551002",
    password: "Manager@Zenith123!",
  });
  const rep1B = await seedUser({
    companyId: companyB.id,
    roleId: rolesB["Sales Rep"].id,
    email: "jennifer@zenithsolutions.com",
    name: "Jennifer Kim",
    phone: "+13105551003",
    password: "SalesRep@Zenith123!",
  });
  const rep2B = await seedUser({
    companyId: companyB.id,
    roleId: rolesB["Sales Rep"].id,
    email: "chris@zenithsolutions.com",
    name: "Chris Thompson",
    phone: "+13105551004",
    password: "SalesRep@Zenith123!",
  });

  console.log("  → Team...");
  await seedTeam(companyB.id, [adminB.id, managerB.id, rep1B.id, rep2B.id], managerB.id);

  console.log("  → Lead Sources...");
  const sourcesB = await seedLeadSources(companyB.id);

  console.log("  → Lead Statuses...");
  const statusesB = await seedLeadStatuses(companyB.id);

  console.log("  → Leads...");
  await seedLeads(
    companyB.id,
    [managerB, rep1B, rep2B],
    sourcesB,
    statusesB,
    50
  );

  console.log("\n✅ Seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("CREDENTIALS SUMMARY:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Super Admin: ${process.env.SEED_SUPER_ADMIN_EMAIL} / ${process.env.SEED_SUPER_ADMIN_PASSWORD}`);
  console.log(`\nAcme Corp Admin:      admin@acmecorp.com / Admin@Acme123!`);
  console.log(`Acme Corp Manager:    manager@acmecorp.com / Manager@Acme123!`);
  console.log(`Acme Corp Sales Rep:  sarah@acmecorp.com / SalesRep@Acme123!`);
  console.log(`\nZenith Admin:         admin@zenithsolutions.com / Admin@Zenith123!`);
  console.log(`Zenith Manager:       manager@zenithsolutions.com / Manager@Zenith123!`);
  console.log(`Zenith Sales Rep:     jennifer@zenithsolutions.com / SalesRep@Zenith123!`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("⚠️  Change all passwords before any non-local deployment!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
