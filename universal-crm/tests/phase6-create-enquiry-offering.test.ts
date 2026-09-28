/**
 * Phase 6 Master Automated Test Suite:
 * Primary "Create Enquiry" Workflow, Offerings (Products & Services),
 * Server-Enforced Price Override Engine, Customer Visibility, and
 * Data-Scope-Governed Customer History Preview.
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { OfferingService } from "../lib/services/offering.service";
import { CustomerService } from "../lib/services/customer.service";
import { CustomerResolutionService } from "../lib/services/customer-resolution.service";
import { LeadService } from "../lib/services/lead.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { DataScope, OfferingType } from "@prisma/client";

export async function runPhase6CreateEnquiryOfferingTests() {
  console.log("\n🧪 Running Phase 6: Create Enquiry, Offerings, Price Override & Customer History Preview Test Suite...");

  const uniqueSuffix = Date.now().toString();

  // --------------------------------------------------------------------------
  // 1. SETUP TENANTS, ROLES & USERS
  // --------------------------------------------------------------------------
  // Company A (Primary Tenant)
  const companyA = await prisma.company.create({
    data: {
      name: `Phase6 Tenant Alpha ${uniqueSuffix}`,
      slug: `p6-alpha-${uniqueSuffix}`,
      defaultCountryCode: "IN",
      currency: "INR",
      allowSalesPriceOverride: true,
      customerDirectoryVisibility: "COMPANY",
      createEnquiryHistoryEnabled: true,
      historyPreviewFields: {
        customerName: true,
        previousEnquiries: true,
        productService: true,
        status: true,
        lastInteraction: true,
        quotedPrice: true,
        assignedUser: true,
      },
    },
  });

  // Company B (Adversary Tenant for Isolation Tests)
  const companyB = await prisma.company.create({
    data: {
      name: `Phase6 Tenant Beta ${uniqueSuffix}`,
      slug: `p6-beta-${uniqueSuffix}`,
      defaultCountryCode: "IN",
      currency: "INR",
      allowSalesPriceOverride: false,
      customerDirectoryVisibility: "DATA_SCOPE",
      createEnquiryHistoryEnabled: false,
    },
  });

  // Shared Lead Statuses for Company A
  const statusNew = await prisma.leadStatus.create({
    data: {
      companyId: companyA.id,
      name: "New",
      displayOrder: 1,
      isDefault: true,
    },
  });
  const statusConverted = await prisma.leadStatus.create({
    data: {
      companyId: companyA.id,
      name: "Converted",
      displayOrder: 2,
      isDefault: false,
    },
  });
  const statusClosed = await prisma.leadStatus.create({
    data: {
      companyId: companyA.id,
      name: "Closed",
      displayOrder: 3,
      isDefault: false,
    },
  });

  // Roles in Company A
  const adminRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `Admin_${uniqueSuffix}`,
      description: "Full Admin Access",
      isSystem: false,
      permissions: {
        create: [
          { module: "offerings", action: "manage", dataScope: DataScope.COMPANY },
          { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
          { module: "customers", action: "manage", dataScope: DataScope.COMPANY },
          { module: "customers", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "create", dataScope: DataScope.COMPANY },
          { module: "leads", action: "update", dataScope: DataScope.COMPANY },
          { module: "settings", action: "manage", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  const salesRepRoleA_OwnScope = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `Sales_Rep_Own_${uniqueSuffix}`,
      description: "Restricted to OWN data scope",
      isSystem: false,
      permissions: {
        create: [
          { module: "offerings", action: "view", dataScope: DataScope.COMPANY },
          { module: "customers", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.OWN },
          { module: "leads", action: "create", dataScope: DataScope.OWN },
          { module: "leads", action: "update", dataScope: DataScope.OWN },
        ],
      },
    },
  });

  // Users in Company A
  const adminUserA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: adminRoleA.id,
      email: `admin-a-${uniqueSuffix}@example.com`,
      name: "Admin User A",
      hashedPassword: "mock-hash",
      status: "ACTIVE",
    },
  });

  const salesUser1 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: salesRepRoleA_OwnScope.id,
      email: `sales-1-${uniqueSuffix}@example.com`,
      name: "Sales Agent One",
      hashedPassword: "mock-hash",
      status: "ACTIVE",
    },
  });

  const salesUser2 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: salesRepRoleA_OwnScope.id,
      email: `sales-2-${uniqueSuffix}@example.com`,
      name: "Sales Agent Two",
      hashedPassword: "mock-hash",
      status: "ACTIVE",
    },
  });

  // User in Company B
  const adminRoleB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: `Admin_B_${uniqueSuffix}`,
      description: "Tenant B Admin",
      isSystem: false,
      permissions: {
        create: [
          { module: "offerings", action: "manage", dataScope: DataScope.COMPANY },
          { module: "customers", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });
  const adminUserB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: adminRoleB.id,
      email: `admin-b-${uniqueSuffix}@example.com`,
      name: "Admin User B",
      hashedPassword: "mock-hash",
      status: "ACTIVE",
    },
  });

  // Create active sessions / AuthContexts
  async function getCtx(userId: string, companyId: string) {
    const session = await createDbSession(userId, companyId);
    const ctx = await validateSessionToken(session.rawToken);
    assert.ok(ctx, "Session must be valid");
    return ctx;
  }

  const ctxAdminA = await getCtx(adminUserA.id, companyA.id);
  const ctxSales1 = await getCtx(salesUser1.id, companyA.id);
  const ctxSales2 = await getCtx(salesUser2.id, companyA.id);
  const ctxAdminB = await getCtx(adminUserB.id, companyB.id);

  console.log("  ✓ Setup tenants, roles, and authenticated contexts completed");

  // --------------------------------------------------------------------------
  // 2. OFFERING MANAGEMENT & TENANT ISOLATION
  // --------------------------------------------------------------------------
  console.log("  Testing Offering (Product/Service) CRUD, Pricing & Isolation...");

  // Create Product with Price Override Allowed
  const tvOffering = await OfferingService.createOffering(ctxAdminA, {
    name: "Television 55-inch",
    type: OfferingType.PRODUCT,
    code: "TV-55",
    description: "4K Smart Television",
    defaultPrice: 50000,
    currency: "INR",
    allowSalesPriceOverride: true,
  });
  assert.equal(tvOffering.name, "Television 55-inch");
  assert.equal(Number(tvOffering.defaultPrice), 50000);
  assert.equal(tvOffering.allowSalesPriceOverride, true);

  // Create Product with Price Override Disallowed (Locked Price)
  const laptopOffering = await OfferingService.createOffering(ctxAdminA, {
    name: "Enterprise Laptop",
    type: OfferingType.PRODUCT,
    code: "LAP-ENT",
    description: "Strictly fixed price",
    defaultPrice: 60000,
    currency: "INR",
    allowSalesPriceOverride: false,
  });
  assert.equal(laptopOffering.allowSalesPriceOverride, false);

  // Create Service
  const acServiceOffering = await OfferingService.createOffering(ctxAdminA, {
    name: "AC Deep Cleaning Service",
    type: OfferingType.SERVICE,
    code: "SVC-AC",
    description: "Annual maintenance cleaning",
    defaultPrice: 2500,
    currency: "INR",
    allowSalesPriceOverride: true,
  });
  assert.equal(acServiceOffering.type, OfferingType.SERVICE);

  // Tenant B Offering
  const tenantBOffering = await OfferingService.createOffering(ctxAdminB, {
    name: "Beta Specialized Widget",
    type: OfferingType.PRODUCT,
    defaultPrice: 9999,
  });

  // Cross-tenant Offering IDOR check
  await assert.rejects(
    async () => {
      await OfferingService.getOfferingById(ctxAdminA, tenantBOffering.id);
    },
    (err: unknown) => err instanceof NotFoundError,
    "Tenant A must not be able to view Tenant B's offering"
  );

  // Non-admin sales agent cannot create offerings
  await assert.rejects(
    async () => {
      await OfferingService.createOffering(ctxSales1, {
        name: "Unauthorized Product",
        type: OfferingType.PRODUCT,
        defaultPrice: 1000,
      });
    },
    (err: unknown) => err instanceof ForbiddenError,
    "Sales agent without offerings.manage cannot create offerings"
  );

  // List offerings with search and filtering
  const listResult = await OfferingService.listOfferings(ctxAdminA, {
    type: OfferingType.PRODUCT,
    search: "Television",
  });
  assert.equal(listResult.data.length, 1);
  assert.equal(listResult.data[0].id, tvOffering.id);

  console.log("  ✓ Offering CRUD & Tenant Isolation verified");

  // --------------------------------------------------------------------------
  // 3. TRANSACTIONAL CREATE ENQUIRY: NEW CUSTOMER + ENQUIRY
  // --------------------------------------------------------------------------
  console.log("  Testing Transactional Create Enquiry with New Customer...");

  const phoneRahul = "+919876543210";
  const emailRahul = `rahul.${uniqueSuffix}@example.com`;

  // Create first enquiry for Rahul Sharma
  const enquiry1 = await LeadService.createLead(ctxSales1, {
    name: "Rahul Sharma",
    phone: phoneRahul,
    email: emailRahul,
    offeringId: tvOffering.id,
    quotedPrice: 48000, // Sales override allowed on TV (default 50000 -> 48000)
    priceOverrideReason: "Festive Season Discount approved by Manager",
    statusId: statusConverted.id,
    assignedUserId: salesUser1.id,
  });

  assert.ok(enquiry1.customerId, "Enquiry must have an associated customerId");
  assert.equal(Number(enquiry1.quotedPrice), 48000);
  assert.equal(Number(enquiry1.defaultPriceAtCreation), 50000);
  assert.equal(enquiry1.priceOverridden, true);
  assert.equal(enquiry1.priceOverrideReason, "Festive Season Discount approved by Manager");
  assert.equal(enquiry1.priceUpdatedById, salesUser1.id);

  const customerRahulId = enquiry1.customerId;
  const customerRahul = await prisma.customer.findUnique({
    where: { id: customerRahulId },
    include: { phones: true, emails: true },
  });
  assert.ok(customerRahul, "Customer Rahul must exist in database");
  assert.equal(customerRahul.phones.length, 1);
  assert.equal(customerRahul.phones[0].normalizedPhone, phoneRahul);
  assert.equal(customerRahul.emails.length, 1);
  assert.equal(customerRahul.emails[0].email, emailRahul.toLowerCase());

  console.log("  ✓ New Customer + CustomerPhone + CustomerEmail + Enquiry created atomically");

  // --------------------------------------------------------------------------
  // 4. ATOMIC ROLLBACK ON ENQUIRY FAILURE (0 ORPHAN CUSTOMERS)
  // --------------------------------------------------------------------------
  console.log("  Testing Transaction Rollback on Failure (0 Orphan Customers)...");

  const orphanPhone = "+919998887776";
  const invalidStatusId = "00000000-0000-0000-0000-000000000000";

  await assert.rejects(
    async () => {
      await LeadService.createLead(ctxSales1, {
        name: "Doomed Customer",
        phone: orphanPhone,
        statusId: invalidStatusId, // will fail foreign key constraint
      });
    },
    "Should throw error when statusId is invalid"
  );

  // Verify that no customer was created for orphanPhone
  const orphanCheck = await prisma.customerPhone.findFirst({
    where: { normalizedPhone: orphanPhone },
  });
  assert.equal(orphanCheck, null, "Transaction rollback must prevent orphan customer or phone records");

  console.log("  ✓ Transaction rollback verified: 0 orphan customers");

  // --------------------------------------------------------------------------
  // 5. REPEAT ENQUIRIES FOR SAME CUSTOMER (ONE CUSTOMER ≠ ONE ENQUIRY)
  // --------------------------------------------------------------------------
  console.log("  Testing Repeat Enquiries for Same Customer (ONE CUSTOMER ≠ ONE ENQUIRY)...");

  // Enquiry #2 for Rahul Sharma: Mobile / Laptop (assigned to Sales 1)
  const enquiry2 = await LeadService.createLead(ctxSales1, {
    name: "Rahul Sharma",
    phone: phoneRahul,
    offeringId: laptopOffering.id,
    quotedPrice: 60000, // Default price, no override
    statusId: statusNew.id,
    assignedUserId: salesUser1.id,
  });

  assert.equal(enquiry2.customerId, customerRahulId, "Enquiry #2 must link to existing Customer Rahul");
  assert.notEqual(enquiry2.id, enquiry1.id, "Enquiry #2 must have distinct ID from Enquiry #1");
  assert.equal(enquiry2.priceOverridden, false);

  // Enquiry #3 for Rahul Sharma: AC Deep Cleaning (assigned to Sales 2)
  const enquiry3 = await LeadService.createLead(ctxSales2, {
    name: "Rahul Sharma",
    phone: phoneRahul,
    offeringId: acServiceOffering.id,
    quotedPrice: 2200, // Override allowed on AC service
    priceOverrideReason: "Repeat customer 300 discount",
    statusId: statusClosed.id,
    assignedUserId: salesUser2.id,
  });

  assert.equal(enquiry3.customerId, customerRahulId, "Enquiry #3 must link to existing Customer Rahul");
  assert.notEqual(enquiry3.id, enquiry1.id);
  assert.notEqual(enquiry3.id, enquiry2.id);
  assert.equal(enquiry3.assignedUserId, salesUser2.id);

  // Verify Enquiry #1 was NOT modified or replaced
  const enquiry1Refetched = await prisma.lead.findUnique({
    where: { id: enquiry1.id },
  });
  assert.equal(enquiry1Refetched?.statusId, statusConverted.id, "Enquiry #1 status must remain Converted");
  assert.equal(Number(enquiry1Refetched?.quotedPrice), 48000, "Enquiry #1 price must remain 48000");

  // Customer count in DB must still be exactly 1
  const rahulCustomerCount = await prisma.customer.count({
    where: { id: customerRahulId },
  });
  assert.equal(rahulCustomerCount, 1);

  // Customer has 3 distinct enquiries
  const rahulEnquiryCount = await prisma.lead.count({
    where: { customerId: customerRahulId },
  });
  assert.equal(rahulEnquiryCount, 3, "Customer must have exactly 3 distinct enquiries");

  console.log("  ✓ ONE CUSTOMER ≠ ONE ENQUIRY verified: 3 distinct enquiries linked to single customer");

  // --------------------------------------------------------------------------
  // 6. CUSTOMER + PHONE CONFLICT DETECTION
  // --------------------------------------------------------------------------
  console.log("  Testing Customer + Phone Conflict Detection...");

  // Create another customer: Priya Patel
  const phonePriya = "+919123456780";
  const customerPriya = await CustomerService.createCustomer(ctxAdminA, {
    name: "Priya Patel",
    phone: phonePriya,
  });

  // Attempt to resolve or create enquiry supplying Priya's customerId but Rahul's phone
  await assert.rejects(
    async () => {
      await CustomerResolutionService.resolveCustomer(
        ctxSales1,
        {
          customerId: customerPriya.id,
          rawPhone: phoneRahul,
        },
        undefined
      );
    },
    (err: unknown) => err instanceof ConflictError,
    "Supplying customerId A with phone belonging to customer B must reject with ConflictError"
  );

  console.log("  ✓ Customer + Phone conflict rejected with ConflictError (HTTP 409)");

  // --------------------------------------------------------------------------
  // 7. SERVER-SIDE PRICE OVERRIDE ENFORCEMENT
  // --------------------------------------------------------------------------
  console.log("  Testing Server-Side Price Override Authorization Engine...");

  // Scenario A: Offering has allowSalesPriceOverride = false
  // Attempting to override Laptop from 60000 to 55000 as Sales Agent must be rejected
  await assert.rejects(
    async () => {
      await LeadService.createLead(ctxSales1, {
        name: "Test Price Hack",
        phone: "+919111222333",
        offeringId: laptopOffering.id,
        quotedPrice: 55000, // Override attempted
      });
    },
    (err: unknown) => {
      return err instanceof ForbiddenError && err.message.includes("Price override is not permitted");
    },
    "Server must reject price override when offering disallows it"
  );

  // Scenario B: Admin can override price even if sales cannot (with manage permission)
  const adminOverrideLead = await LeadService.createLead(ctxAdminA, {
    name: "VIP Laptop Client",
    phone: "+919444555666",
    offeringId: laptopOffering.id,
    quotedPrice: 52000,
    priceOverrideReason: "Board Member Special Approval",
  });
  assert.equal(Number(adminOverrideLead.quotedPrice), 52000);
  assert.equal(adminOverrideLead.priceOverridden, true);

  // Scenario C: Inactive offering cannot be selected
  const archivedOffering = await OfferingService.createOffering(ctxAdminA, {
    name: "Obsolete Product",
    type: OfferingType.PRODUCT,
    defaultPrice: 1000,
  });
  await OfferingService.updateOffering(ctxAdminA, archivedOffering.id, {
    isActive: false,
  });

  await assert.rejects(
    async () => {
      await LeadService.createLead(ctxSales1, {
        name: "Inactive Test",
        phone: "+919777888999",
        offeringId: archivedOffering.id,
        quotedPrice: 1000,
      });
    },
    (err: unknown) => err instanceof ValidationError && err.message.includes("inactive"),
    "Inactive offering must not be selectable for new enquiries"
  );

  // Scenario D: Tenant-level price override toggle
  // When company.allowSalesPriceOverride = false, even an offering with allowSalesPriceOverride = true is blocked for sales users
  await prisma.company.update({
    where: { id: companyA.id },
    data: { allowSalesPriceOverride: false },
  });

  const ctxSales1TenantLocked = await getCtx(salesUser1.id, companyA.id);

  await assert.rejects(
    async () => {
      await LeadService.createLead(ctxSales1TenantLocked, {
        name: "Tenant Locked Client",
        phone: "+919666777888",
        offeringId: tvOffering.id, // tvOffering allows override, but company disallows
        quotedPrice: 45000,
      });
    },
    (err: unknown) => err instanceof ForbiddenError && err.message.includes("Price override is not permitted"),
    "Tenant-level allowSalesPriceOverride=false must block sales price override"
  );

  // Re-enable tenant override for subsequent tests
  await prisma.company.update({
    where: { id: companyA.id },
    data: { allowSalesPriceOverride: true },
  });

  console.log("  ✓ Server-side price override governance verified (zero trust for client)");

  // --------------------------------------------------------------------------
  // 8. CUSTOMER DIRECTORY VISIBILITY VS RBAC / DATA SCOPE
  // --------------------------------------------------------------------------
  console.log("  Testing Customer Directory Visibility & Data Scope Enforcement...");

  // When company.customerDirectoryVisibility = "DATA_SCOPE", Sales1 (OWN scope) should only see customers linked to their own leads
  await prisma.company.update({
    where: { id: companyA.id },
    data: { customerDirectoryVisibility: "DATA_SCOPE" },
  });

  const ctxSales1DirectoryScoped = await getCtx(salesUser1.id, companyA.id);
  const ctxAdminADirectoryScoped = await getCtx(adminUserA.id, companyA.id);

  // Sales 1 created Enquiry 1 and 2 for Rahul Sharma.
  // Priya Patel was created by Admin with no leads assigned to Sales 1.
  const sales1CustomerList = await CustomerService.listCustomers(ctxSales1DirectoryScoped, {});
  const visibleCustomerIds = sales1CustomerList.data.map((c) => c.id);
  assert.ok(visibleCustomerIds.includes(customerRahulId), "Sales 1 should see Rahul (assigned lead)");
  assert.ok(!visibleCustomerIds.includes(customerPriya.id), "Sales 1 must NOT see Priya (unassigned customer in DATA_SCOPE mode)");

  // Admin sees all customers
  const adminCustomerList = await CustomerService.listCustomers(ctxAdminADirectoryScoped, {});
  const adminCustomerIds = adminCustomerList.data.map((c) => c.id);
  assert.ok(adminCustomerIds.includes(customerRahulId));
  assert.ok(adminCustomerIds.includes(customerPriya.id));

  console.log("  ✓ Customer Directory Visibility respects DATA_SCOPE restrictions");

  // --------------------------------------------------------------------------
  // 9. CUSTOMER HISTORY PREVIEW GOVERNANCE & DATA SCOPE
  // --------------------------------------------------------------------------
  console.log("  Testing Customer History Preview Governance & Data Scope Filtering...");

  // Remember: Rahul Sharma has 3 enquiries:
  // - Enquiry 1: TV 55, converted, assigned to Sales 1
  // - Enquiry 2: Laptop, new, assigned to Sales 1
  // - Enquiry 3: AC Service, closed, assigned to Sales 2

  // Sales 1 (Data Scope OWN) requests history preview for Customer Rahul
  const sales1HistoryPreview = await CustomerService.getCustomerHistoryPreview(ctxSales1, customerRahulId);
  assert.equal(sales1HistoryPreview.allowed, true);
  assert.equal(sales1HistoryPreview.customer.name, "Rahul Sharma");
  // Out of 3 enquiries, Sales 1 is authorized to see only the 2 assigned to Sales 1
  assert.equal(sales1HistoryPreview.enquiries.length, 2, "Sales 1 (OWN scope) must only see 2 enquiries assigned to Sales 1");
  const sales1EnquiryIds = sales1HistoryPreview.enquiries.map((e) => e.id);
  assert.ok(sales1EnquiryIds.includes(enquiry1.id));
  assert.ok(sales1EnquiryIds.includes(enquiry2.id));
  assert.ok(!sales1EnquiryIds.includes(enquiry3.id), "Enquiry 3 assigned to Sales 2 must NOT be returned to Sales 1");

  // Sales 2 (Data Scope OWN) requests history preview for Customer Rahul
  const sales2HistoryPreview = await CustomerService.getCustomerHistoryPreview(ctxSales2, customerRahulId);
  assert.equal(sales2HistoryPreview.enquiries.length, 1, "Sales 2 (OWN scope) must only see 1 enquiry assigned to Sales 2");
  assert.equal(sales2HistoryPreview.enquiries[0].id, enquiry3.id);

  // Admin (COMPANY scope) requests history preview: sees all 3 enquiries
  const adminHistoryPreview = await CustomerService.getCustomerHistoryPreview(ctxAdminA, customerRahulId);
  assert.equal(adminHistoryPreview.enquiries.length, 3, "Admin (COMPANY scope) sees all 3 enquiries in history preview");

  // Test Admin toggle: disable createEnquiryHistoryEnabled
  await prisma.company.update({
    where: { id: companyA.id },
    data: { createEnquiryHistoryEnabled: false },
  });

  const ctxSales1HistoryDisabled = await getCtx(salesUser1.id, companyA.id);
  const disabledPreview = await CustomerService.getCustomerHistoryPreview(ctxSales1HistoryDisabled, customerRahulId);
  assert.equal(disabledPreview.allowed, false);
  assert.equal(disabledPreview.enquiries.length, 0, "When disabled by tenant admin, zero enquiries returned");

  // Re-enable for further checks
  await prisma.company.update({
    where: { id: companyA.id },
    data: { createEnquiryHistoryEnabled: true },
  });

  console.log("  ✓ Customer History Preview strictly filtered by caller Data Scope (no JS hiding, zero leakage)");

  // --------------------------------------------------------------------------
  // 10. CROSS-TENANT SECURITY & IDOR PROTECTIONS
  // --------------------------------------------------------------------------
  console.log("  Testing Cross-Tenant Security & IDOR Protections...");

  // Tenant B cannot fetch Tenant A's customer history preview
  await assert.rejects(
    async () => {
      await CustomerService.getCustomerHistoryPreview(ctxAdminB, customerRahulId);
    },
    (err: unknown) => err instanceof NotFoundError,
    "Tenant B must receive NotFoundError when requesting Tenant A's customer"
  );

  // Tenant A cannot assign Tenant B's offering to an enquiry
  await assert.rejects(
    async () => {
      await LeadService.createLead(ctxAdminA, {
        name: "Cross Tenant Attack",
        phone: "+919000111222",
        offeringId: tenantBOffering.id, // Belongs to Company B
      });
    },
    (err: unknown) => err instanceof ValidationError && err.message.includes("Invalid offering for this company"),
    "Cannot assign cross-tenant offering to enquiry"
  );

  console.log("  ✓ Cross-Tenant IDOR and Offering assignment attacks rejected");

  // --------------------------------------------------------------------------
  // 11. AUDIT LOG GENERATION
  // --------------------------------------------------------------------------
  console.log("  Testing Audit Log Generation for Offerings and Enquiries...");

  const offeringAudit = await prisma.auditLog.findFirst({
    where: {
      companyId: companyA.id,
      entityType: "offering",
      entityId: tvOffering.id,
      action: "offering.create",
    },
  });
  assert.ok(offeringAudit, "Audit log for offering creation must exist");

  const priceOverrideAudit = await prisma.auditLog.findFirst({
    where: {
      companyId: companyA.id,
      entityType: "lead",
      action: "lead.price_overridden",
    },
  });
  assert.ok(priceOverrideAudit, "Audit log for price override must exist");

  console.log("  ✓ Audit logs successfully generated for Offerings and Price Overrides");

  // --------------------------------------------------------------------------
  // 12. CLEANUP
  // --------------------------------------------------------------------------
  console.log("  Cleaning up Phase 6 test fixtures...");
  await prisma.auditLog.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.lead.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.customerPhone.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.customerEmail.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.customer.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.offering.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.leadStatus.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.session.deleteMany({
    where: { userId: { in: [adminUserA.id, salesUser1.id, salesUser2.id, adminUserB.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [adminUserA.id, salesUser1.id, salesUser2.id, adminUserB.id] } },
  });
  await prisma.permission.deleteMany({
    where: { roleId: { in: [adminRoleA.id, salesRepRoleA_OwnScope.id, adminRoleB.id] } },
  });
  await prisma.role.deleteMany({
    where: { id: { in: [adminRoleA.id, salesRepRoleA_OwnScope.id, adminRoleB.id] } },
  });
  await prisma.company.deleteMany({
    where: { id: { in: [companyA.id, companyB.id] } },
  });

  console.log("🎉 Phase 6 Create Enquiry, Offerings, Price Override & Customer History Preview Test Suite Passed!\n");
}

if (require.main === module) {
  runPhase6CreateEnquiryOfferingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Phase 6 test suite failed:", err);
      process.exit(1);
    });
}
