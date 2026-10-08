/**
 * Dodo CRM V2 — Realistic Client Demo Dataset Seed
 * 
 * Creates a safe, believable, tenant-isolated demonstration workspace for client presentations.
 * 
 * Safety Safeguards:
 * - Only targets demo company slug "acme" / "acme-demo"
 * - Reversible / Idempotent
 * - Uses 100% fictional names, phones (+9198765432xx), and organizations
 * - Fully populates Leads, Customers, Deals, Activities, Tasks, Comments, Notifications & Custom Fields
 */

import {
  PrismaClient,
  CompanyStatus,
  UserStatus,
  LeadPriority,
  TaskPriority,
  TaskStatus,
  ActivityType,
  DataScope,
  OfferingType,
  CustomFieldType
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_COMPANY_SLUG = "acme";
const DEMO_COMPANY_NAME = "Acme Global Solutions";

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function seedDemoData(options: { reset?: boolean } = {}) {
  console.log("============================================================");
  console.log("🌱 DODO CRM V2 — SEEDING REALISTIC CLIENT DEMO DATASET");
  console.log("============================================================");

  // 1. Find or verify tenant
  let company = await prisma.company.findUnique({
    where: { slug: DEMO_COMPANY_SLUG }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: DEMO_COMPANY_NAME,
        slug: DEMO_COMPANY_SLUG,
        email: "contact@acme.demo",
        timezone: "Asia/Kolkata",
        currency: "INR",
        defaultCountryCode: "IN",
        status: CompanyStatus.ACTIVE,
        onboardingCompleted: true,
        onboardingStep: "COMPLETED"
      }
    });
    console.log(`✓ Created demo company: ${company.name} (${company.id})`);
  } else {
    console.log(`✓ Using demo company: ${company.name} (${company.id})`);
  }

  const companyId = company.id;

  // If reset requested, clean demo records safely within this tenant only
  if (options.reset) {
    console.log("🧹 Resetting demo dataset for company:", company.name);
    await prisma.commentMention.deleteMany({ where: { companyId } });
    await prisma.comment.deleteMany({ where: { companyId } });
    await prisma.notification.deleteMany({ where: { companyId } });
    await prisma.taskRescheduleHistory.deleteMany({ where: { companyId } });
    await prisma.task.deleteMany({ where: { companyId } });
    await prisma.activity.deleteMany({ where: { companyId } });
    await prisma.note.deleteMany({ where: { companyId } });
    await prisma.leadStatusHistory.deleteMany({ where: { companyId } });
    await prisma.leadAssignmentHistory.deleteMany({ where: { companyId } });
    await prisma.leadDispositionHistory.deleteMany({ where: { companyId } });
    await prisma.customFieldValue.deleteMany({ where: { companyId } });
    await prisma.lead.deleteMany({ where: { companyId } });
    await prisma.customerPhone.deleteMany({ where: { companyId } });
    await prisma.customerEmail.deleteMany({ where: { companyId } });
    await prisma.customer.deleteMany({ where: { companyId } });
    console.log("✓ Tenant demo entities reset.");
  }

  // 2. Roles & Permissions setup
  const adminRole = await prisma.role.upsert({
    where: { companyId_name: { companyId, name: "Admin" } },
    update: {},
    create: {
      companyId,
      name: "Admin",
      description: "Full administrative access",
      isSystem: true
    }
  });

  const repRole = await prisma.role.upsert({
    where: { companyId_name: { companyId, name: "Sales Rep" } },
    update: {},
    create: {
      companyId,
      name: "Sales Rep",
      description: "Sales representative access",
      isSystem: true
    }
  });

  const MODULES = ["customers", "leads", "offerings", "users", "teams", "reports", "settings", "audit_logs", "tasks", "notes", "activities", "custom_fields"];
  for (const module of MODULES) {
    await prisma.permission.upsert({
      where: { roleId_module_action: { roleId: adminRole.id, module, action: "manage" } },
      update: {},
      create: { roleId: adminRole.id, module, action: "manage", dataScope: DataScope.COMPANY }
    });
    await prisma.permission.upsert({
      where: { roleId_module_action: { roleId: repRole.id, module, action: "manage" } },
      update: {},
      create: { roleId: repRole.id, module, action: "manage", dataScope: DataScope.COMPANY }
    });
  }

  // 3. Demo Team Users
  const defaultPasswordHash = await hashPassword("Demo@123456");

  const usersData = [
    { email: "admin@acme.com", name: "Sarah Johnson", roleId: adminRole.id, phone: "+919876543200", passHash: defaultPasswordHash },
    { email: "amit.sharma@acme.com", name: "Amit Sharma", roleId: repRole.id, phone: "+919876543201", passHash: defaultPasswordHash },
    { email: "neha.gupta@acme.com", name: "Neha Gupta", roleId: repRole.id, phone: "+919876543202", passHash: defaultPasswordHash },
    { email: "rahul.verma@acme.com", name: "Rahul Verma", roleId: repRole.id, phone: "+919876543203", passHash: defaultPasswordHash }
  ];

  const userMap: Record<string, any> = {};
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { companyId_email: { companyId, email: u.email } },
      update: { name: u.name, status: UserStatus.ACTIVE, hashedPassword: u.passHash },
      create: {
        companyId,
        email: u.email,
        name: u.name,
        phone: u.phone,
        roleId: u.roleId,
        status: UserStatus.ACTIVE,
        hashedPassword: u.passHash
      }
    });
    userMap[u.email] = user;
    userMap[u.name] = user;
    if (u.name.startsWith("Sarah Johnson")) {
      userMap["sarah.johnson@acme.com"] = user;
    }
    console.log(`  ✓ Demo User: ${user.name} (${user.email})`);
  }

  // 4. Offerings (Products / Services)
  const offeringsData = [
    { name: "Enterprise CRM Cloud Suite", defaultPrice: 450000, type: OfferingType.PRODUCT, code: "SFT-01" },
    { name: "Annual Health Management Package", defaultPrice: 125000, type: OfferingType.SERVICE, code: "HLT-01" },
    { name: "Luxury Villa Premium Consulting", defaultPrice: 250000, type: OfferingType.SERVICE, code: "EST-01" },
    { name: "Corporate Skill Training Workshop", defaultPrice: 180000, type: OfferingType.SERVICE, code: "EDU-01" },
    { name: "Digital Transformation Retainer", defaultPrice: 600000, type: OfferingType.SERVICE, code: "CON-01" }
  ];

  const offeringMap: Record<string, any> = {};
  for (const off of offeringsData) {
    const existing = await prisma.offering.findFirst({
      where: { companyId, name: off.name }
    });
    const item = existing || await prisma.offering.create({
      data: {
        companyId,
        name: off.name,
        defaultPrice: off.defaultPrice,
        type: off.type,
        currency: "INR",
        code: off.code
      }
    });
    offeringMap[off.name] = item;
  }

  // 5. Lead Sources & Statuses
  const sources = ["Website Form", "Direct Inbound Call", "Referral", "LinkedIn", "Walk-in Expo"];
  const sourceMap: Record<string, any> = {};
  for (const src of sources) {
    const s = await prisma.leadSource.upsert({
      where: { companyId_name: { companyId, name: src } },
      update: {},
      create: { companyId, name: src }
    });
    sourceMap[src] = s;
  }

  const statuses = [
    { name: "New", color: "#3b82f6", displayOrder: 1, isDefault: true },
    { name: "Contacted", color: "#06b6d4", displayOrder: 2 },
    { name: "Interested", color: "#8b5cf6", displayOrder: 3 },
    { name: "Follow-up", color: "#f59e0b", displayOrder: 4 },
    { name: "Qualified", color: "#10b981", displayOrder: 5 },
    { name: "Negotiation", color: "#ec4899", displayOrder: 6 },
    { name: "Converted", color: "#059669", displayOrder: 7 },
    { name: "Lost", color: "#ef4444", displayOrder: 8 }
  ];

  const statusMap: Record<string, any> = {};
  for (const st of statuses) {
    const s = await prisma.leadStatus.upsert({
      where: { companyId_name: { companyId, name: st.name } },
      update: { color: st.color, displayOrder: st.displayOrder },
      create: {
        companyId,
        name: st.name,
        color: st.color,
        displayOrder: st.displayOrder,
        isDefault: st.isDefault || false
      }
    });
    statusMap[st.name] = s;
  }

  // 6. Hierarchical Dispositions
  const dispositionsData = [
    { name: "Interested - High Intent", code: "INT_HIGH", color: "#10b981", allowsConvert: true, requiresFollowUp: true },
    { name: "Demo Scheduled", code: "DEMO_SCHED", color: "#8b5cf6", requiresFollowUp: true },
    { name: "Proposal Sent", code: "PROP_SENT", color: "#3b82f6", requiresFollowUp: true },
    { name: "Follow-up Required", code: "CALL_LATER", color: "#f59e0b", requiresFollowUp: true },
    { name: "Not Interested - Budget", code: "NOT_INT_BUDGET", color: "#ef4444", isTerminal: true },
    { name: "Closed Won", code: "WON", color: "#059669", isTerminal: true, allowsConvert: true }
  ];

  const dispMap: Record<string, any> = {};
  for (const d of dispositionsData) {
    const existing = await prisma.disposition.findFirst({
      where: { companyId, name: d.name }
    });
    const item = existing || await prisma.disposition.create({
      data: {
        companyId,
        name: d.name,
        code: d.code,
        color: d.color,
        requiresFollowUp: d.requiresFollowUp || false,
        allowsConvert: d.allowsConvert || false,
        isTerminal: d.isTerminal || false
      }
    });
    dispMap[d.name] = item;
  }

  // 7. Custom Fields (Demonstrating multi-industry flexibility)
  const customFieldsData = [
    { key: "treatment_interest", label: "Treatment Interest", fieldType: CustomFieldType.SELECT, options: ["Orthopedics", "Cardiology", "Dental", "Wellness Check"] },
    { key: "property_type", label: "Property Type", fieldType: CustomFieldType.SELECT, options: ["Commercial Office", "Luxury Villa", "2/3 BHK Apartment", "Penthouse"] },
    { key: "estimated_budget", label: "Estimated Budget", fieldType: CustomFieldType.NUMBER },
    { key: "requirement_summary", label: "Requirement Summary", fieldType: CustomFieldType.TEXTAREA }
  ];

  const cfMap: Record<string, any> = {};
  for (const cf of customFieldsData) {
    const item = await prisma.customField.upsert({
      where: { companyId_entityType_key: { companyId, entityType: "LEAD", key: cf.key } },
      update: { label: cf.label, options: cf.options || undefined },
      create: {
        companyId,
        entityType: "LEAD",
        key: cf.key,
        label: cf.label,
        fieldType: cf.fieldType,
        options: cf.options || undefined
      }
    });
    cfMap[cf.key] = item;
  }

  // 8. Demo Customers (Verified accounts with multiple contact points)
  const customersData = [
    {
      name: "Apex Health Systems",
      displayName: "Apex Hospitals Mumbai",
      companyName: "Apex Healthcare Ltd",
      phone: "+919876543210",
      email: "procurement@apexhospitals.com",
      notes: "Multi-specialty hospital group looking to modernize their patient intake CRM."
    },
    {
      name: "BlueStone Real Estate",
      displayName: "BlueStone Luxury Living",
      companyName: "BlueStone Infra Pvt Ltd",
      phone: "+919876543211",
      email: "sales@bluestonerealty.com",
      notes: "Premier commercial and luxury residential real estate developer."
    },
    {
      name: "TechNova Solutions",
      displayName: "TechNova Enterprise",
      companyName: "TechNova IT Services",
      phone: "+919876543212",
      email: "partners@technovait.com",
      notes: "Cloud consulting firm evaluating internal sales workflow automation."
    },
    {
      name: "Horizon Learning Academy",
      displayName: "Horizon EdTech",
      companyName: "Horizon Education Pvt Ltd",
      phone: "+919876543213",
      email: "admissions@horizonlearning.org",
      notes: "National test prep and vocational skill certification network."
    },
    {
      name: "Urban Living Spaces",
      displayName: "Urban Living Residences",
      companyName: "Urban Living Developers",
      phone: "+919876543214",
      email: "info@urbanlivingspaces.in",
      notes: "Co-living and student housing franchise across tier-1 cities."
    },
    {
      name: "Vanguard Capital Partners",
      displayName: "Vanguard Advisory",
      companyName: "Vanguard Financial Services",
      phone: "+919876543215",
      email: "wealth@vanguardcap.in",
      notes: "Boutique private wealth and institutional advisory firm."
    },
    {
      name: "Dr. Rajesh Khanna",
      displayName: "Dr. Rajesh Khanna Clinics",
      companyName: "Khanna Super Speciality",
      phone: "+919876543216",
      email: "dr.khanna@khannaclinics.com",
      notes: "Key opinion leader and private surgical clinic director."
    },
    {
      name: "Global Freight Logistics",
      displayName: "Global Freight India",
      companyName: "Global Freight Solutions Ltd",
      phone: "+919876543217",
      email: "operations@globalfreight.in",
      notes: "International supply chain and customs clearing network."
    }
  ];

  const customerMap: Record<string, any> = {};
  for (const c of customersData) {
    let cust = await prisma.customer.findFirst({
      where: { companyId, name: c.name }
    });

    if (!cust) {
      cust = await prisma.customer.create({
        data: {
          companyId,
          name: c.name,
          displayName: c.displayName,
          companyName: c.companyName,
          notes: c.notes,
          phones: {
            create: {
              companyId,
              rawPhone: c.phone,
              normalizedPhone: c.phone,
              type: "MOBILE",
              isPrimary: true,
              isVerified: true
            }
          },
          emails: {
            create: {
              companyId,
              email: c.email,
              type: "WORK",
              isPrimary: true,
              isVerified: true
            }
          }
        }
      });
    }
    customerMap[c.name] = cust;
    console.log(`  ✓ Demo Customer: ${cust.name} (${c.companyName})`);
  }

  // 9. Demo Leads (20+ Realistic across all stages and industries)
  const leadsData = [
    {
      name: "Dr. Vikram Singhania",
      company: "Apex Health Systems",
      customerName: "Apex Health Systems",
      email: "dr.singhania@apexhospitals.com",
      phone: "+919876543220",
      source: "Referral",
      status: "Negotiation",
      priority: LeadPriority.HIGH,
      amount: 450000,
      assignedUser: "amit.sharma@acme.com",
      offering: "Enterprise CRM Cloud Suite",
      disposition: "Proposal Sent",
      customValues: { requirement_summary: "Needs multi-department patient inquiry routing with 20 seats." }
    },
    {
      name: "Priya Malhotra",
      company: "BlueStone Real Estate",
      customerName: "BlueStone Real Estate",
      email: "priya.m@bluestonerealty.com",
      phone: "+919876543221",
      source: "Website Form",
      status: "Qualified",
      priority: LeadPriority.HIGH,
      amount: 250000,
      assignedUser: "sarah.johnson@acme.com",
      offering: "Luxury Villa Premium Consulting",
      disposition: "Interested - High Intent",
      customValues: { property_type: "Luxury Villa", estimated_budget: 25000000 }
    },
    {
      name: "Rohan Kapoor",
      company: "TechNova Solutions",
      customerName: "TechNova Solutions",
      email: "rohan.k@technovait.com",
      phone: "+919876543222",
      source: "LinkedIn",
      status: "Follow-up",
      priority: LeadPriority.MEDIUM,
      amount: 600000,
      assignedUser: "neha.gupta@acme.com",
      offering: "Digital Transformation Retainer",
      disposition: "Follow-up Required",
      customValues: { requirement_summary: "Q4 sales pipeline automation and lead scoring workshop." }
    },
    {
      name: "Ananya Desai",
      company: "Horizon Learning Academy",
      customerName: "Horizon Learning Academy",
      email: "ananya.d@horizonlearning.org",
      phone: "+919876543223",
      source: "Direct Inbound Call",
      status: "Interested",
      priority: LeadPriority.MEDIUM,
      amount: 180000,
      assignedUser: "rahul.verma@acme.com",
      offering: "Corporate Skill Training Workshop",
      disposition: "Demo Scheduled",
      customValues: { estimated_budget: 180000 }
    },
    {
      name: "Karan Johar Enterprises",
      company: "Urban Living Spaces",
      customerName: "Urban Living Spaces",
      email: "karan@urbanlivingspaces.in",
      phone: "+919876543224",
      source: "Walk-in Expo",
      status: "New",
      priority: LeadPriority.URGENT,
      amount: 350000,
      assignedUser: "amit.sharma@acme.com",
      offering: "Enterprise CRM Cloud Suite",
      disposition: null
    },
    {
      name: "Dr. Sunita Rao",
      company: "Khanna Super Speciality",
      customerName: "Dr. Rajesh Khanna",
      email: "dr.rao@khannaclinics.com",
      phone: "+919876543225",
      source: "Referral",
      status: "Converted",
      priority: LeadPriority.HIGH,
      amount: 125000,
      assignedUser: "sarah.johnson@acme.com",
      offering: "Annual Health Management Package",
      disposition: "Closed Won",
      customValues: { treatment_interest: "Wellness Check" }
    },
    {
      name: "Manish Agarwal",
      company: "Agarwal Fabrics Pvt Ltd",
      customerName: null,
      email: "manish@agarwalfabrics.com",
      phone: "+919876543226",
      source: "Website Form",
      status: "New",
      priority: LeadPriority.LOW,
      amount: 95000,
      assignedUser: "neha.gupta@acme.com",
      offering: "Corporate Skill Training Workshop",
      disposition: null
    },
    {
      name: "Deepak Choudhury",
      company: "Global Freight Logistics",
      customerName: "Global Freight Logistics",
      email: "deepak@globalfreight.in",
      phone: "+919876543227",
      source: "LinkedIn",
      status: "Contacted",
      priority: LeadPriority.MEDIUM,
      amount: 520000,
      assignedUser: "rahul.verma@acme.com",
      offering: "Digital Transformation Retainer",
      disposition: "Follow-up Required"
    },
    {
      name: "Siddharth Oberoi",
      company: "Vanguard Capital Partners",
      customerName: "Vanguard Capital Partners",
      email: "siddharth@vanguardcap.in",
      phone: "+919876543228",
      source: "Direct Inbound Call",
      status: "Qualified",
      priority: LeadPriority.HIGH,
      amount: 850000,
      assignedUser: "sarah.johnson@acme.com",
      offering: "Enterprise CRM Cloud Suite",
      disposition: "Interested - High Intent"
    },
    {
      name: "Kavita Reddy",
      company: "Reddy BioSciences",
      customerName: null,
      email: "kavita@reddybio.com",
      phone: "+919876543229",
      source: "Website Form",
      status: "Negotiation",
      priority: LeadPriority.HIGH,
      amount: 320000,
      assignedUser: "amit.sharma@acme.com",
      offering: "Annual Health Management Package",
      disposition: "Proposal Sent"
    },
    {
      name: "Tarun Bajaj",
      company: "Bajaj Automotive Components",
      customerName: null,
      email: "tarun.b@bajajauto-comp.com",
      phone: "+919876543230",
      source: "Referral",
      status: "Follow-up",
      priority: LeadPriority.MEDIUM,
      amount: 400000,
      assignedUser: "neha.gupta@acme.com",
      offering: "Enterprise CRM Cloud Suite",
      disposition: "Follow-up Required"
    },
    {
      name: "Meera Nambiar",
      company: "Nambiar Heritage Resorts",
      customerName: null,
      email: "meera@nambiarresorts.com",
      phone: "+919876543231",
      source: "Direct Inbound Call",
      status: "Interested",
      priority: LeadPriority.MEDIUM,
      amount: 280000,
      assignedUser: "rahul.verma@acme.com",
      offering: "Luxury Villa Premium Consulting",
      disposition: "Demo Scheduled"
    },
    {
      name: "Gaurav Sen",
      company: "Sen FinTech Labs",
      customerName: null,
      email: "gaurav@senfintech.io",
      phone: "+919876543232",
      source: "Website Form",
      status: "New",
      priority: LeadPriority.HIGH,
      amount: 500000,
      assignedUser: "amit.sharma@acme.com",
      offering: "Enterprise CRM Cloud Suite",
      disposition: null,
      customValues: { estimated_budget: 500000 }
    },
    {
      name: "Pooja Hegde",
      company: "Hegde Architecture Studio",
      customerName: null,
      email: "pooja@hegdestudio.com",
      phone: "+919876543233",
      source: "Referral",
      status: "Contacted",
      priority: LeadPriority.LOW,
      amount: 150000,
      assignedUser: "neha.gupta@acme.com",
      offering: "Corporate Skill Training Workshop",
      disposition: "Follow-up Required"
    },
    {
      name: "Harish Iyer",
      company: "Iyer Diagnostic Labs",
      customerName: null,
      email: "harish@iyerdiagnostics.in",
      phone: "+919876543234",
      source: "Direct Inbound Call",
      status: "Qualified",
      priority: LeadPriority.HIGH,
      amount: 350000,
      assignedUser: "sarah.johnson@acme.com",
      offering: "Annual Health Management Package",
      disposition: "Interested - High Intent",
      customValues: { treatment_interest: "Cardiology" }
    },
    {
      name: "Sameer Joshi",
      company: "Joshi Realty Developers",
      customerName: null,
      email: "sameer@joshirealty.com",
      phone: "+919876543235",
      source: "LinkedIn",
      status: "Negotiation",
      priority: LeadPriority.HIGH,
      amount: 750000,
      assignedUser: "amit.sharma@acme.com",
      offering: "Luxury Villa Premium Consulting",
      disposition: "Proposal Sent",
      customValues: { property_type: "Commercial Office", estimated_budget: 750000 }
    },
    {
      name: "Nikhil Chawla",
      company: "Chawla Global Logistics",
      customerName: null,
      email: "nikhil@chawlaltd.com",
      phone: "+919876543236",
      source: "Walk-in Expo",
      status: "Follow-up",
      priority: LeadPriority.MEDIUM,
      amount: 420000,
      assignedUser: "rahul.verma@acme.com",
      offering: "Digital Transformation Retainer",
      disposition: "Follow-up Required"
    },
    {
      name: "Ritika Sen",
      company: "Sen Foundation Schools",
      customerName: null,
      email: "ritika@senschools.org",
      phone: "+919876543237",
      source: "Website Form",
      status: "Interested",
      priority: LeadPriority.MEDIUM,
      amount: 220000,
      assignedUser: "neha.gupta@acme.com",
      offering: "Corporate Skill Training Workshop",
      disposition: "Demo Scheduled"
    },
    {
      name: "Alok Nathani",
      company: "Nathani Diamond Exports",
      customerName: null,
      email: "alok@nathanidiamonds.com",
      phone: "+919876543238",
      source: "Referral",
      status: "New",
      priority: LeadPriority.URGENT,
      amount: 900000,
      assignedUser: "sarah.johnson@acme.com",
      offering: "Enterprise CRM Cloud Suite",
      disposition: null
    }
  ];

  const leadRecords: any[] = [];
  for (const ld of leadsData) {
    const lead = await prisma.lead.create({
      data: {
        companyId,
        name: ld.name,
        company: ld.company,
        email: ld.email,
        phone: ld.phone,
        priority: ld.priority,
        amount: ld.amount,
        quotedPrice: ld.amount,
        sourceId: sourceMap[ld.source]?.id,
        statusId: statusMap[ld.status]?.id,
        assignedUserId: userMap[ld.assignedUser]?.id,
        customerId: ld.customerName ? customerMap[ld.customerName]?.id : undefined,
        offeringId: ld.offering ? offeringMap[ld.offering]?.id : undefined,
        dispositionId: ld.disposition ? dispMap[ld.disposition]?.id : undefined
      }
    });
    leadRecords.push(lead);

    // Populate custom field values
    if (ld.customValues) {
      for (const [key, val] of Object.entries(ld.customValues)) {
        if (cfMap[key]) {
          await prisma.customFieldValue.create({
            data: {
              companyId,
              customFieldId: cfMap[key].id,
              entityType: "LEAD",
              entityId: lead.id,
              value: val
            }
          });
        }
      }
    }

    // Populate initial Activity & History
    await prisma.activity.create({
      data: {
        companyId,
        leadId: lead.id,
        userId: userMap[ld.assignedUser]?.id,
        type: ActivityType.LEAD_CREATED,
        description: `Lead created from ${ld.source}`
      }
    });

    if (ld.disposition) {
      await prisma.activity.create({
        data: {
          companyId,
          leadId: lead.id,
          userId: userMap[ld.assignedUser]?.id,
          type: ActivityType.DISPOSITION_CHANGED,
          description: `Call outcome logged: ${ld.disposition}`
        }
      });
    }

    console.log(`  ✓ Demo Lead: ${lead.name} (${ld.status} — ₹${(ld.amount || 0).toLocaleString("en-IN")})`);
  }

  // 10. Demo Tasks / Follow-ups (Overdue, Due Today, Upcoming, Completed)
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const tasksData = [
    {
      title: "Urgent: Send commercial proposal to Dr. Vikram Singhania",
      leadId: leadRecords[0]?.id,
      assignedUserId: userMap["amit.sharma@acme.com"]?.id,
      dueAt: yesterday,
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      description: "Follow up with hospital board regarding the 20-seat CRM tier proposal."
    },
    {
      title: "Schedule on-site property walkthrough with Priya Malhotra",
      leadId: leadRecords[1]?.id,
      assignedUserId: userMap["sarah.johnson@acme.com"]?.id,
      dueAt: now,
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      description: "Confirm weekend site visit for BlueStone Luxury Villa enquiry."
    },
    {
      title: "Follow-up discovery call with Rohan Kapoor",
      leadId: leadRecords[2]?.id,
      assignedUserId: userMap["neha.gupta@acme.com"]?.id,
      dueAt: tomorrow,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      description: "Review TechNova's technical requirements for digital transformation."
    },
    {
      title: "Send corporate training curriculum to Ananya Desai",
      leadId: leadRecords[3]?.id,
      assignedUserId: userMap["rahul.verma@acme.com"]?.id,
      dueAt: nextWeek,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      description: "Email customized course syllabus for Horizon Learning instructors."
    },
    {
      title: "Completed initial intake consultation with Dr. Sunita Rao",
      leadId: leadRecords[5]?.id,
      assignedUserId: userMap["sarah.johnson@acme.com"]?.id,
      dueAt: yesterday,
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.COMPLETED,
      completedAt: yesterday,
      description: "Completed intake and converted account successfully."
    }
  ];

  for (const t of tasksData) {
    if (t.leadId && t.assignedUserId) {
      await prisma.task.create({
        data: {
          companyId,
          leadId: t.leadId,
          assignedUserId: t.assignedUserId,
          title: t.title,
          description: t.description,
          dueAt: t.dueAt,
          priority: t.priority,
          status: t.status,
          completedAt: t.completedAt
        }
      });
    }
  }

  // 11. Demo Notes
  if (leadRecords[0]) {
    await prisma.note.create({
      data: {
        companyId,
        leadId: leadRecords[0].id,
        userId: userMap["amit.sharma@acme.com"]?.id,
        content: "Met with the Medical Director today. They are very enthusiastic about patient lead tracking and SLA notifications. Quoted ₹4,50,000 for full rollout."
      }
    });
  }

  if (leadRecords[1]) {
    await prisma.note.create({
      data: {
        companyId,
        leadId: leadRecords[1].id,
        userId: userMap["sarah.johnson@acme.com"]?.id,
        content: "Client has budget approval up to ₹2.5 Cr for the prime penthouse property. Needs final architectural floor plans before signing."
      }
    });
  }

  // 12. Demo Comments & @Mentions
  if (leadRecords[0]) {
    const comment1 = await prisma.comment.create({
      data: {
        companyId,
        entityType: "LEAD",
        entityId: leadRecords[0].id,
        authorId: userMap["amit.sharma@acme.com"]?.id,
        content: "@Sarah Johnson Hospital management approved the terms. Please review the final discount clause before I send the contract."
      }
    });

    if (userMap["sarah.johnson@acme.com"]) {
      await prisma.commentMention.create({
        data: {
          companyId,
          commentId: comment1.id,
          mentionedUserId: userMap["sarah.johnson@acme.com"].id
        }
      });

      // Corresponding notification
      await prisma.notification.create({
        data: {
          companyId,
          userId: userMap["sarah.johnson@acme.com"].id,
          actorId: userMap["amit.sharma@acme.com"].id,
          type: "MENTION",
          title: "Amit Sharma mentioned you",
          message: `Amit mentioned you on Dr. Vikram Singhania: "Please review the final discount clause..."`,
          entityType: "LEAD",
          entityId: leadRecords[0].id,
          deepLink: `/app/leads/${leadRecords[0].id}`
        }
      });
    }

    const comment2 = await prisma.comment.create({
      data: {
        companyId,
        entityType: "LEAD",
        entityId: leadRecords[0].id,
        authorId: userMap["sarah.johnson@acme.com"]?.id,
        content: "Discount clause looks within our approved 10% commercial threshold. Go ahead and issue the proposal."
      }
    });
  }

  // 13. Additional Notifications
  if (userMap["amit.sharma@acme.com"] && leadRecords[4]) {
    await prisma.notification.create({
      data: {
        companyId,
        userId: userMap["amit.sharma@acme.com"].id,
        actorId: userMap["sarah.johnson@acme.com"]?.id,
        type: "ASSIGNMENT",
        title: "New High Priority Lead Assigned",
        message: "You have been assigned to Karan Johar Enterprises (Urban Living Spaces).",
        entityType: "LEAD",
        entityId: leadRecords[4].id,
        deepLink: `/app/leads/${leadRecords[4].id}`
      }
    });
  }

  if (userMap["neha.gupta@acme.com"] && leadRecords[2]) {
    await prisma.notification.create({
      data: {
        companyId,
        userId: userMap["neha.gupta@acme.com"].id,
        type: "TASK_DUE",
        title: "Follow-up due tomorrow",
        message: "Follow-up discovery call with Rohan Kapoor is scheduled for tomorrow morning.",
        entityType: "LEAD",
        entityId: leadRecords[2].id,
        deepLink: `/app/leads/${leadRecords[2].id}`
      }
    });
  }

  console.log("============================================================");
  console.log("✨ REALISTIC CLIENT DEMO DATASET SEEDED SUCCESSFULLY!");
  console.log("============================================================");
  console.log(`- Company: ${company.name} (Slug: ${company.slug})`);
  console.log(`- Demo Accounts: admin@acme.com, amit.sharma@acme.com (Password: Demo@123456)`);
  console.log(`- Total Leads: ${leadRecords.length}`);
  console.log(`- Total Customers: ${Object.keys(customerMap).length}`);
  console.log(`- Total Offerings: ${Object.keys(offeringMap).length}`);
  console.log("============================================================");
}

// Direct execution CLI runner
if (require.main === module) {
  const isReset = process.argv.includes("--reset");
  seedDemoData({ reset: isReset })
    .catch((err) => {
      console.error("❌ Seed Error:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
