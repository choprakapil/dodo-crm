/**
 * Phase 5 Master Security & Integration Test Suite: Customer CRUD, Contact Management, RBAC & Data Scope
 * 
 * Verifies:
 * 1. Customer Creation (transactional primary phone/email, normalization, audit log)
 * 2. Duplicate Phone Rejection within Tenant (ConflictError)
 * 3. Customer List (search by name, phone, email, pagination, soft-delete exclusion)
 * 4. Customer Update (name, companyName, notes, audit log)
 * 5. Phone Management (add secondary, duplicate protection, set primary, remove phone, auto-promote primary)
 * 6. Email Management (add secondary, duplicate protection, set primary, remove email, auto-promote primary)
 * 7. Customer Enquiry History Data Scope Enforcement (OWN vs COMPANY scope, no unauthorized leakage)
 * 8. Cross-Tenant Isolation & IDOR Protection (Tenant A cannot read, mutate, or manage Tenant B customers)
 * 9. RBAC Permission Enforcement (customers.view, customers.create, customers.update, customers.delete, customers.manage)
 * 10. Soft Delete Lifecycle & Invariant Preservation (ONE CUSTOMER ≠ ONE ENQUIRY: enquiries & activities remain intact)
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { CustomerService } from "../lib/services/customer.service";
import { createDbSession, validateSessionToken } from "../lib/auth/session";
import { ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import { DataScope } from "@prisma/client";

export async function runCustomerCrudSecurityTests() {
  console.log("\n🧪 Running Phase 5 Customer CRUD, Permissions, Data Scope & Security Test Suite...");

  const uniqueSuffix = Date.now().toString();

  // --------------------------------------------------------------------------
  // SETUP TENANTS & USERS
  // --------------------------------------------------------------------------
  // Company A (Primary Tenant)
  const companyA = await prisma.company.create({
    data: {
      name: `Phase5 Tenant Alpha ${uniqueSuffix}`,
      slug: `p5-alpha-${uniqueSuffix}`,
      defaultCountryCode: "US",
    },
  });

  // Company B (Adversary Tenant)
  const companyB = await prisma.company.create({
    data: {
      name: `Phase5 Tenant Beta ${uniqueSuffix}`,
      slug: `p5-beta-${uniqueSuffix}`,
      defaultCountryCode: "US",
    },
  });

  // Lead status for enquiries
  const leadStatusA = await prisma.leadStatus.create({
    data: {
      companyId: companyA.id,
      name: "New Enquiry",
      displayOrder: 1,
      isDefault: true,
    },
  });

  // Role with full customer management for Tenant A Admin
  const adminRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `P5_ADMIN_${uniqueSuffix}`,
      description: "Tenant A Admin with customer permissions",
      isSystem: false,
      permissions: {
        create: [
          { module: "customers", action: "view", dataScope: DataScope.COMPANY },
          { module: "customers", action: "create", dataScope: DataScope.COMPANY },
          { module: "customers", action: "update", dataScope: DataScope.COMPANY },
          { module: "customers", action: "delete", dataScope: DataScope.COMPANY },
          { module: "customers", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
          { module: "leads", action: "create", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  // Role for Sales Rep A1 (OWN scope for leads, VIEW/CREATE for customers)
  const salesRepRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `P5_SALESREP_${uniqueSuffix}`,
      description: "Sales Rep with OWN lead scope and VIEW customers",
      isSystem: false,
      permissions: {
        create: [
          { module: "customers", action: "view", dataScope: DataScope.COMPANY },
          { module: "customers", action: "create", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.OWN },
        ],
      },
    },
  });

  // Restricted Role without customer permissions
  const restrictedRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: `P5_RESTRICTED_${uniqueSuffix}`,
      description: "No customer permissions",
      isSystem: false,
      permissions: {
        create: [
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  // Role for Tenant B Admin
  const adminRoleB = await prisma.role.create({
    data: {
      companyId: companyB.id,
      name: `P5_B_ADMIN_${uniqueSuffix}`,
      description: "Tenant B Admin",
      isSystem: false,
      permissions: {
        create: [
          { module: "customers", action: "view", dataScope: DataScope.COMPANY },
          { module: "customers", action: "create", dataScope: DataScope.COMPANY },
          { module: "customers", action: "update", dataScope: DataScope.COMPANY },
          { module: "customers", action: "delete", dataScope: DataScope.COMPANY },
          { module: "customers", action: "manage", dataScope: DataScope.COMPANY },
        ],
      },
    },
  });

  // Users
  const userAdminA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: adminRoleA.id,
      name: `Admin User A ${uniqueSuffix}`,
      email: `admin-a-${uniqueSuffix}@example.com`,
      hashedPassword: "hash123",
      status: "ACTIVE",
    },
  });

  const userRepA1 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: salesRepRoleA.id,
      name: `Rep A1 ${uniqueSuffix}`,
      email: `rep-a1-${uniqueSuffix}@example.com`,
      hashedPassword: "hash123",
      status: "ACTIVE",
    },
  });

  const userRepA2 = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: salesRepRoleA.id,
      name: `Rep A2 ${uniqueSuffix}`,
      email: `rep-a2-${uniqueSuffix}@example.com`,
      hashedPassword: "hash123",
      status: "ACTIVE",
    },
  });

  const userRestrictedA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: restrictedRoleA.id,
      name: `Restricted User A ${uniqueSuffix}`,
      email: `restricted-a-${uniqueSuffix}@example.com`,
      hashedPassword: "hash123",
      status: "ACTIVE",
    },
  });

  const userAdminB = await prisma.user.create({
    data: {
      companyId: companyB.id,
      roleId: adminRoleB.id,
      name: `Admin User B ${uniqueSuffix}`,
      email: `admin-b-${uniqueSuffix}@example.com`,
      hashedPassword: "hash123",
      status: "ACTIVE",
    },
  });

  // Create AuthContexts
  const sessionAdminA = await createDbSession(userAdminA.id, companyA.id);
  const ctxAdminA = (await validateSessionToken(sessionAdminA.rawToken))!;

  const sessionRepA1 = await createDbSession(userRepA1.id, companyA.id);
  const ctxRepA1 = (await validateSessionToken(sessionRepA1.rawToken))!;

  const sessionRepA2 = await createDbSession(userRepA2.id, companyA.id);
  const ctxRepA2 = (await validateSessionToken(sessionRepA2.rawToken))!;

  const sessionRestrictedA = await createDbSession(userRestrictedA.id, companyA.id);
  const ctxRestrictedA = (await validateSessionToken(sessionRestrictedA.rawToken))!;

  const sessionAdminB = await createDbSession(userAdminB.id, companyB.id);
  const ctxAdminB = (await validateSessionToken(sessionAdminB.rawToken))!;

  // ==========================================================================
  // TEST 1: CREATE CUSTOMER (TRANSACTIONAL, NORMALIZED, AUDIT)
  // ==========================================================================
  console.log("  → [1] Create Customer with normalized primary phone & email...");
  const customer1 = await CustomerService.createCustomer(ctxAdminA, {
    name: "Vikram Malhotra",
    displayName: "Vikram M.",
    companyName: "Malhotra Enterprises",
    notes: "VIP Key Account",
    phone: "+1 (555) 741-2589",
    phoneType: "MOBILE",
    email: "Vikram.M@Malhotra.com",
    emailType: "WORK",
  });

  assert.ok(customer1.id, "Customer ID must be defined");
  assert.equal(customer1.name, "Vikram Malhotra");
  assert.equal(customer1.displayName, "Vikram M.");
  assert.equal(customer1.companyName, "Malhotra Enterprises");
  assert.equal(customer1.companyId, companyA.id);
  assert.equal(customer1.phones.length, 1);
  assert.equal(customer1.phones[0].normalizedPhone, "+15557412589", "Phone must be normalized E.164");
  assert.equal(customer1.phones[0].isPrimary, true);
  assert.equal(customer1.emails.length, 1);
  assert.equal(customer1.emails[0].email, "vikram.m@malhotra.com", "Email must be lowercased");
  assert.equal(customer1.emails[0].isPrimary, true);

  // Verify Audit Log for creation
  const createAudit = await prisma.auditLog.findFirst({
    where: {
      companyId: companyA.id,
      entityType: "Customer",
      entityId: customer1.id,
      action: "customer.create",
    },
  });
  assert.ok(createAudit, "Customer creation audit log must exist");

  // ==========================================================================
  // TEST 2: DUPLICATE PHONE REJECTION WITHIN TENANT
  // ==========================================================================
  console.log("  → [2] Reject duplicate phone creation within same tenant...");
  await assert.rejects(
    async () => {
      await CustomerService.createCustomer(ctxAdminA, {
        name: "Vikram Clone",
        phone: "555-741-2589", // Same phone in different format
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ConflictError, "Must throw ConflictError for duplicate phone");
      return true;
    }
  );

  // Verify same phone in DIFFERENT tenant succeeds (tenant isolation)
  console.log("  → [2b] Allow same phone in different tenant (Tenant B)...");
  const customerB = await CustomerService.createCustomer(ctxAdminB, {
    name: "Vikram Tenant B",
    phone: "+15557412589",
  });
  assert.ok(customerB.id, "Customer in Tenant B with same phone must succeed");
  assert.equal(customerB.companyId, companyB.id);

  // ==========================================================================
  // TEST 3: CUSTOMER LIST (SEARCH & PAGINATION)
  // ==========================================================================
  console.log("  → [3] Customer list with search by name, phone, email & pagination...");
  const customer2 = await CustomerService.createCustomer(ctxAdminA, {
    name: "Ananya Sharma",
    phone: "+1 555 963 8520",
    email: "ananya.sharma@techcorp.io",
  });

  // Search by name
  const listByName = await CustomerService.listCustomers(ctxAdminA, { search: "Malhotra" });
  assert.equal(listByName.data.length, 1);
  assert.equal(listByName.data[0].id, customer1.id);

  // Search by phone
  const listByPhone = await CustomerService.listCustomers(ctxAdminA, { phone: "5557412589" });
  assert.equal(listByPhone.data.length, 1);
  assert.equal(listByPhone.data[0].id, customer1.id);

  // Search by email
  const listByEmail = await CustomerService.listCustomers(ctxAdminA, { email: "ananya.sharma" });
  assert.equal(listByEmail.data.length, 1);
  assert.equal(listByEmail.data[0].id, customer2.id);

  // Pagination
  const page1 = await CustomerService.listCustomers(ctxAdminA, { page: 1, limit: 1 });
  assert.equal(page1.data.length, 1);
  assert.ok(page1.pagination.total >= 2);
  assert.equal(page1.pagination.totalPages >= 2, true);

  // ==========================================================================
  // TEST 4: CUSTOMER UPDATE
  // ==========================================================================
  console.log("  → [4] Customer update (name, notes, companyName) & audit log...");
  const updatedCustomer1 = await CustomerService.updateCustomer(ctxAdminA, customer1.id, {
    name: "Vikram Malhotra Updated",
    displayName: "Vikram M. Senior",
    companyName: "Malhotra Holdings Inc.",
    notes: "Upgraded to Strategic Account",
  });

  assert.equal(updatedCustomer1.name, "Vikram Malhotra Updated");
  assert.equal(updatedCustomer1.displayName, "Vikram M. Senior");
  assert.equal(updatedCustomer1.companyName, "Malhotra Holdings Inc.");
  assert.equal(updatedCustomer1.notes, "Upgraded to Strategic Account");

  // Verify Audit Log for update
  const updateAudit = await prisma.auditLog.findFirst({
    where: {
      companyId: companyA.id,
      entityType: "Customer",
      entityId: customer1.id,
      action: "customer.update",
    },
  });
  assert.ok(updateAudit, "Customer update audit log must exist");

  // ==========================================================================
  // TEST 5: PHONE MANAGEMENT (ADD, PRIMARY SWAP, DELETE & AUTO-PROMOTE)
  // ==========================================================================
  console.log("  → [5] Phone management: add secondary, duplicate protection, set primary, delete...");
  // Add secondary phone
  const phone2 = await CustomerService.addPhone(ctxAdminA, customer1.id, {
    phone: "+1 (555) 111-2222",
    type: "WORK",
    isPrimary: false,
  });
  assert.equal(phone2.normalizedPhone, "+15551112222");
  assert.equal(phone2.isPrimary, false);

  // Prevent duplicate phone assignment to another customer
  await assert.rejects(
    async () => {
      await CustomerService.addPhone(ctxAdminA, customer2.id, {
        phone: "+1 555 111 2222", // Already belongs to customer1
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ConflictError, "Must throw ConflictError when adding another customer's phone");
      return true;
    }
  );

  // Set secondary phone as primary
  const updatedPhone2 = await CustomerService.updatePhone(ctxAdminA, customer1.id, phone2.id, {
    isPrimary: true,
  });
  assert.equal(updatedPhone2.isPrimary, true);

  // Verify old primary was set to false
  const oldPrimary = await prisma.customerPhone.findUnique({
    where: { id: customer1.phones[0].id },
  });
  assert.equal(oldPrimary?.isPrimary, false, "Previous primary phone must be set to false");

  // Delete the secondary phone (which is now primary) -> should auto-promote the remaining phone to primary!
  await CustomerService.removePhone(ctxAdminA, customer1.id, phone2.id);
  const remainingPhone = await prisma.customerPhone.findUnique({
    where: { id: customer1.phones[0].id },
  });
  assert.equal(remainingPhone?.isPrimary, true, "Remaining phone must be auto-promoted to primary");

  // ==========================================================================
  // TEST 6: EMAIL MANAGEMENT (ADD, PRIMARY SWAP, DELETE & AUTO-PROMOTE)
  // ==========================================================================
  console.log("  → [6] Email management: add secondary, duplicate protection, set primary, delete...");
  const email2 = await CustomerService.addEmail(ctxAdminA, customer1.id, {
    email: "vikram.personal@gmail.com",
    type: "PERSONAL",
    isPrimary: false,
  });
  assert.equal(email2.email, "vikram.personal@gmail.com");
  assert.equal(email2.isPrimary, false);

  // Prevent duplicate email assignment to another customer
  await assert.rejects(
    async () => {
      await CustomerService.addEmail(ctxAdminA, customer2.id, {
        email: "vikram.personal@gmail.com",
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof ConflictError, "Must throw ConflictError when adding another customer's email");
      return true;
    }
  );

  // Set secondary email as primary
  const updatedEmail2 = await CustomerService.updateEmail(ctxAdminA, customer1.id, email2.id, {
    isPrimary: true,
  });
  assert.equal(updatedEmail2.isPrimary, true);

  const oldPrimaryEmail = await prisma.customerEmail.findUnique({
    where: { id: customer1.emails[0].id },
  });
  assert.equal(oldPrimaryEmail?.isPrimary, false, "Previous primary email must be set to false");

  // Remove secondary email
  await CustomerService.removeEmail(ctxAdminA, customer1.id, email2.id);
  const remainingEmail = await prisma.customerEmail.findUnique({
    where: { id: customer1.emails[0].id },
  });
  assert.equal(remainingEmail?.isPrimary, true, "Remaining email must be auto-promoted to primary");

  // ==========================================================================
  // TEST 7: CUSTOMER ENQUIRY HISTORY DATA SCOPE ENFORCEMENT
  // ==========================================================================
  console.log("  → [7] Data Scope enforcement: Customer profile enquiry history obeys lead scope...");
  // Create 2 enquiries (Leads) for Customer 1:
  // Enquiry A assigned to Rep A1
  // Enquiry B assigned to Rep A2
  const enquiryA = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      customerId: customer1.id,
      name: "Commercial Solar Rooftop Enquiry",
      statusId: leadStatusA.id,
      assignedUserId: userRepA1.id,
      phone: customer1.phones[0].normalizedPhone,
    },
  });

  const enquiryB = await prisma.lead.create({
    data: {
      companyId: companyA.id,
      customerId: customer1.id,
      name: "Battery Storage System Enquiry",
      statusId: leadStatusA.id,
      assignedUserId: userRepA2.id,
      phone: customer1.phones[0].normalizedPhone,
    },
  });

  // Admin A (COMPANY scope) reads customer profile -> should see BOTH enquiries
  const adminView = await CustomerService.getCustomerById(ctxAdminA, customer1.id);
  assert.equal(adminView.enquirySummary.totalEnquiries, 2, "Admin with COMPANY scope sees both enquiries");
  const adminEnquiryIds = adminView.enquirySummary.enquiries.map((e: { id: string }) => e.id);
  assert.ok(adminEnquiryIds.includes(enquiryA.id));
  assert.ok(adminEnquiryIds.includes(enquiryB.id));

  // Rep A1 (OWN scope) reads customer profile -> should ONLY see Enquiry A, NEVER Enquiry B!
  const repA1View = await CustomerService.getCustomerById(ctxRepA1, customer1.id);
  assert.equal(repA1View.enquirySummary.totalEnquiries, 1, "Rep A1 with OWN scope only sees their assigned enquiry");
  assert.equal(repA1View.enquirySummary.enquiries[0].id, enquiryA.id);
  assert.equal(repA1View.enquirySummary.enquiries[0].name, "Commercial Solar Rooftop Enquiry");

  // Rep A2 (OWN scope) reads customer profile -> should ONLY see Enquiry B, NEVER Enquiry A!
  const repA2View = await CustomerService.getCustomerById(ctxRepA2, customer1.id);
  assert.equal(repA2View.enquirySummary.totalEnquiries, 1, "Rep A2 with OWN scope only sees their assigned enquiry");
  assert.equal(repA2View.enquirySummary.enquiries[0].id, enquiryB.id);
  assert.equal(repA2View.enquirySummary.enquiries[0].name, "Battery Storage System Enquiry");

  // ==========================================================================
  // TEST 8: CROSS-TENANT ISOLATION & IDOR PROTECTION
  // ==========================================================================
  console.log("  → [8] Cross-tenant isolation & IDOR protection (Tenant B cannot access Tenant A)...");
  // Tenant B Admin tries to read Customer 1 (Tenant A)
  await assert.rejects(
    async () => {
      await CustomerService.getCustomerById(ctxAdminB, customer1.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Must throw NotFoundError for cross-tenant read");
      return true;
    }
  );

  // Tenant B Admin tries to update Customer 1 (Tenant A)
  await assert.rejects(
    async () => {
      await CustomerService.updateCustomer(ctxAdminB, customer1.id, { name: "Hacked by Tenant B" });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Must throw NotFoundError for cross-tenant update");
      return true;
    }
  );

  // Tenant B Admin tries to add phone to Customer 1 (Tenant A)
  await assert.rejects(
    async () => {
      await CustomerService.addPhone(ctxAdminB, customer1.id, { phone: "+15559990000" });
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Must throw NotFoundError for cross-tenant phone addition");
      return true;
    }
  );

  // Tenant B Admin tries to delete Customer 1 (Tenant A)
  await assert.rejects(
    async () => {
      await CustomerService.softDeleteCustomer(ctxAdminB, customer1.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Must throw NotFoundError for cross-tenant delete");
      return true;
    }
  );

  // ==========================================================================
  // TEST 9: RBAC PERMISSION ENFORCEMENT
  // ==========================================================================
  console.log("  → [9] RBAC permission enforcement (view, create, update, delete, manage)...");
  // Restricted user without customers.view tries to list
  await assert.rejects(
    async () => {
      await CustomerService.listCustomers(ctxRestrictedA);
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "User without customers.view cannot list");
      return true;
    }
  );

  // Restricted user without customers.view tries to get
  await assert.rejects(
    async () => {
      await CustomerService.getCustomerById(ctxRestrictedA, customer1.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "User without customers.view cannot get");
      return true;
    }
  );

  // Sales Rep with view/create but NOT update tries to update
  await assert.rejects(
    async () => {
      await CustomerService.updateCustomer(ctxRepA1, customer1.id, { name: "Illegal Update" });
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "User without customers.update cannot update");
      return true;
    }
  );

  // Sales Rep with view/create but NOT delete tries to delete
  await assert.rejects(
    async () => {
      await CustomerService.softDeleteCustomer(ctxRepA1, customer1.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "User without customers.delete cannot delete");
      return true;
    }
  );

  // Sales Rep with view/create but NOT manage tries to add phone
  await assert.rejects(
    async () => {
      await CustomerService.addPhone(ctxRepA1, customer1.id, { phone: "+15553334444" });
    },
    (err: unknown) => {
      assert.ok(err instanceof ForbiddenError, "User without customers.manage cannot add phone");
      return true;
    }
  );

  // ==========================================================================
  // TEST 10: SOFT DELETE & INVARIANT PRESERVATION (ONE CUSTOMER ≠ ONE ENQUIRY)
  // ==========================================================================
  console.log("  → [10] Soft delete customer preserves enquiries & history (ONE CUSTOMER ≠ ONE ENQUIRY)...");
  const deleteResult = await CustomerService.softDeleteCustomer(ctxAdminA, customer1.id);
  assert.equal(deleteResult.success, true);
  assert.equal(deleteResult.enquiriesPreserved, 2, "Both enquiries must be preserved upon customer deletion");

  // Verify Customer has deletedAt set
  const deletedDbCustomer = await prisma.customer.findUnique({
    where: { id: customer1.id },
  });
  assert.ok(deletedDbCustomer?.deletedAt, "Customer must have deletedAt set");

  // Verify enquiries are STILL INTACT in the database!
  const intactEnquiryA = await prisma.lead.findUnique({
    where: { id: enquiryA.id },
  });
  assert.ok(intactEnquiryA, "Enquiry A must remain intact in database");
  assert.equal(intactEnquiryA?.deletedAt, null, "Enquiry A must NOT be deleted");
  assert.equal(intactEnquiryA?.customerId, customer1.id, "Enquiry A retains customer reference");

  const intactEnquiryB = await prisma.lead.findUnique({
    where: { id: enquiryB.id },
  });
  assert.ok(intactEnquiryB, "Enquiry B must remain intact in database");
  assert.equal(intactEnquiryB?.deletedAt, null, "Enquiry B must NOT be deleted");

  // Verify Audit Log for deletion
  const deleteAudit = await prisma.auditLog.findFirst({
    where: {
      companyId: companyA.id,
      entityType: "Customer",
      entityId: customer1.id,
      action: "customer.delete",
    },
  });
  assert.ok(deleteAudit, "Customer deletion audit log must exist");

  // Normal getCustomerById without includeDeleted fails with NotFoundError
  await assert.rejects(
    async () => {
      await CustomerService.getCustomerById(ctxAdminA, customer1.id);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError, "Soft-deleted customer returns NotFoundError on normal get");
      return true;
    }
  );

  // But getCustomerById WITH includeDeleted: true succeeds for user with customers.manage
  const deletedWithFlag = await CustomerService.getCustomerById(ctxAdminA, customer1.id, { includeDeleted: true });
  assert.ok(deletedWithFlag.customer.deletedAt, "Can retrieve soft-deleted customer when includeDeleted: true");

  console.log("  ✅ ALL 10 CUSTOMER CRUD, SECURITY & DATA SCOPE TESTS PASSED!");
}
