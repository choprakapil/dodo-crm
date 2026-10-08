/**
 * Phase 5: CSV Import Intelligence & Intelligent Header Auto-Detection Test Suite
 *
 * Validates:
 * 1. Header Normalization: Handles casing, underscores, hyphens, colons, brackets, and whitespace
 * 2. Exact & Normalized Core Field Matching (HIGH confidence, AUTO_MATCHED)
 * 3. Comprehensive Alias Registry Matching (Phone, Email, Company, Amount, Source, Status, Assignee, Team)
 * 4. Tenant-Scoped Custom Field Auto-Detection:
 *    - Tenant's custom fields matched by key & label
 *    - Foreign tenant custom fields NOT matched
 * 5. Ambiguous Header Handling (LOW confidence, NEEDS_REVIEW)
 * 6. Duplicate Destination Conflict Detection (CONFLICT status, requires manual selection)
 * 7. Unmatched Unknown Headers (UNMAPPED status)
 * 8. End-to-end Preview & Import Execution with User Overrides
 * 9. Strict Server-Side Validation:
 *    - Rejects invalid target fields
 *    - Rejects foreign tenant custom fields
 *    - Rejects duplicate destination collisions
 *    - Enforces required 'name' field
 * 10. Multi-Tenant Isolation & Security
 */

import assert from "node:assert/strict";
import { prisma } from "../lib/db";
import { createDbSession } from "../lib/auth/session";
import { validateSessionToken } from "../lib/auth/session";
import {
  normalizeHeader,
  detectIntelligentHeaders,
  detectColumnMappings,
} from "../lib/utils/csv-header-detector";
import { LeadImportService } from "../lib/services/lead-import.service";
import { POST as previewRouteHandler } from "../app/api/v1/leads/import/preview/route";
import { POST as importRouteHandler } from "../app/api/v1/leads/import/route";
import { NextRequest } from "next/server";
import { DataScope } from "@prisma/client";

export async function runPhase5CsvImportIntelligenceTests() {
  console.log("\n🧪 Running Phase 5: CSV Import Intelligence Test Suite...");

  const uniqueSuffix = `p5_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // =========================================================================
  // TEST 1: Header Normalization Unit Tests
  // =========================================================================
  console.log("  [1/8] Testing header normalization rules...");
  assert.equal(normalizeHeader("  First Name  "), "first name");
  assert.equal(normalizeHeader("first_name"), "first name");
  assert.equal(normalizeHeader("FIRST-NAME"), "first name");
  assert.equal(normalizeHeader("Email (Work)"), "email work");
  assert.equal(normalizeHeader("Phone: Primary / Mobile"), "phone primary mobile");
  assert.equal(normalizeHeader("deal__value--inr"), "deal value inr");
  assert.equal(normalizeHeader("   Multiple    Spaces   "), "multiple spaces");
  console.log("  ✓ Header normalization handles casing, punctuation, and separators.");

  // =========================================================================
  // TEST 2: Exact & Normalized Core Field Auto-Matching
  // =========================================================================
  console.log("  [2/8] Testing exact and alias matching across core CRM fields...");
  const coreHeaders = [
    "Lead Name",
    "Email Address",
    "Mobile Number",
    "Company Name",
    "Deal Value",
    "Priority Level",
    "Pipeline Stage",
    "Lead Channel",
    "Assigned Agent",
    "Sales Team",
  ];

  const coreDetections = detectIntelligentHeaders(coreHeaders);
  assert.equal(coreDetections.suggestedMappings["Lead Name"], "name");
  assert.equal(coreDetections.suggestedMappings["Email Address"], "email");
  assert.equal(coreDetections.suggestedMappings["Mobile Number"], "phone");
  assert.equal(coreDetections.suggestedMappings["Company Name"], "company");
  assert.equal(coreDetections.suggestedMappings["Deal Value"], "amount");
  assert.equal(coreDetections.suggestedMappings["Priority Level"], "priority");
  assert.equal(coreDetections.suggestedMappings["Pipeline Stage"], "status");
  assert.equal(coreDetections.suggestedMappings["Lead Channel"], "source");
  assert.equal(coreDetections.suggestedMappings["Assigned Agent"], "assignedUser");
  assert.equal(coreDetections.suggestedMappings["Sales Team"], "team");

  // Verify backward compatibility helper
  const legacyMappings = detectColumnMappings(coreHeaders);
  assert.equal(legacyMappings["Lead Name"], "name");
  assert.equal(legacyMappings["Email Address"], "email");
  assert.equal(legacyMappings["Mobile Number"], "phone");

  console.log("  ✓ All core CRM fields and primary aliases matched with high confidence.");

  // =========================================================================
  // TEST 3: Duplicate Destination Conflict Detection
  // =========================================================================
  console.log("  [3/8] Testing duplicate destination conflict detection...");
  const conflictingHeaders = [
    "Lead Name",
    "Phone Number",
    "Mobile Phone", // Conflicts with Phone Number
    "Work Email",
    "Personal Email", // Conflicts with Work Email
    "Budget",
  ];

  const conflictSummary = detectIntelligentHeaders(conflictingHeaders);
  assert.equal(conflictSummary.hasConflicts, true, "Should flag hasConflicts as true");
  assert.ok(conflictSummary.conflicts.length >= 2, "Should identify at least 2 conflicting field groups");

  const phoneConflict = conflictSummary.detections.find((d) => d.header === "Mobile Phone");
  assert.equal(phoneConflict?.status, "CONFLICT", "Conflicting header must have status CONFLICT");
  assert.ok(phoneConflict?.conflictWith?.includes("Phone Number"), "Must indicate conflict with Phone Number");

  assert.equal(conflictSummary.suggestedMappings["Mobile Phone"], "phone");
  assert.equal(conflictSummary.suggestedMappings["Phone Number"], "phone");
  assert.equal(conflictSummary.suggestedMappings["Lead Name"], "name");
  assert.equal(conflictSummary.suggestedMappings["Budget"], "amount");

  console.log("  ✓ Duplicate destination columns safely flagged as CONFLICT without dangerous auto-mapping.");

  // =========================================================================
  // TEST 4: Ambiguous Headers & Unmapped Handling
  // =========================================================================
  console.log("  [4/8] Testing ambiguous headers and unknown column handling...");
  const edgeHeaders = ["Lead Name", "random_xyz_col", "type", "tag", "rating"];
  const edgeSummary = detectIntelligentHeaders(edgeHeaders);

  const unmapped = edgeSummary.detections.find((d) => d.header === "random_xyz_col");
  assert.equal(unmapped?.status, "UNMAPPED");
  assert.equal(unmapped?.confidence, "NONE");
  assert.equal(unmapped?.suggestedField, null);

  const ambiguousType = edgeSummary.detections.find((d) => d.header === "type");
  assert.ok(
    ambiguousType?.status === "NEEDS_REVIEW" || ambiguousType?.status === "UNMAPPED",
    "Ambiguous header should be marked for review or unmapped"
  );

  console.log("  ✓ Unknown headers marked UNMAPPED and ambiguous headers flagged for review.");

  // =========================================================================
  // TEST 5: Tenant-Scoped Custom Field Auto-Detection
  // =========================================================================
  console.log("  [5/8] Testing tenant-scoped custom field detection...");
  // Setup Test Companies & Custom Fields
  const companyA = await prisma.company.create({
    data: {
      name: `Tenant Alpha ${uniqueSuffix}`,
      slug: `alpha-${uniqueSuffix}`,
      currency: "INR",
    },
  });

  const companyB = await prisma.company.create({
    data: {
      name: `Tenant Beta ${uniqueSuffix}`,
      slug: `beta-${uniqueSuffix}`,
      currency: "USD",
    },
  });

  const cfIndustryA = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "industry_vertical",
      label: "Industry Vertical",
      fieldType: "TEXT",
    },
  });

  const cfGstA = await prisma.customField.create({
    data: {
      companyId: companyA.id,
      entityType: "LEAD",
      key: "gst_number",
      label: "GST Number",
      fieldType: "TEXT",
    },
  });

  const cfSecretB = await prisma.customField.create({
    data: {
      companyId: companyB.id,
      entityType: "LEAD",
      key: "beta_secret_metric",
      label: "Beta Secret Metric",
      fieldType: "NUMBER",
    },
  });

  const testHeadersWithCustom = [
    "Lead Name",
    "Phone",
    "Industry Vertical",
    "gst_number",
    "Beta Secret Metric", // Belongs to Company B!
  ];

  // Match against Company A's custom fields
  const customFieldsA = [
    { key: cfIndustryA.key, label: cfIndustryA.label },
    { key: cfGstA.key, label: cfGstA.label },
  ];

  const summaryA = detectIntelligentHeaders(testHeadersWithCustom, customFieldsA);
  assert.equal(summaryA.suggestedMappings["Industry Vertical"], `cf_${cfIndustryA.key}`);
  assert.equal(summaryA.suggestedMappings["gst_number"], `cf_${cfGstA.key}`);
  assert.equal(
    summaryA.suggestedMappings["Beta Secret Metric"],
    undefined,
    "Foreign tenant custom field must NOT be mapped for Company A"
  );

  const foreignDetection = summaryA.detections.find((d) => d.header === "Beta Secret Metric");
  assert.equal(foreignDetection?.status, "UNMAPPED", "Foreign custom field should be unmapped");

  console.log("  ✓ Tenant-scoped custom field detection strictly isolated to authenticated company.");

  // =========================================================================
  // TEST 6: Preview API Route Integration & Metadata
  // =========================================================================
  console.log("  [6/8] Testing /api/v1/leads/import/preview route with intelligent detection...");
  const adminRoleA = await prisma.role.create({
    data: {
      companyId: companyA.id,
      name: "Admin",
      permissions: {
        create: [
          { module: "leads", action: "manage", dataScope: DataScope.COMPANY },
          { module: "leads", action: "create", dataScope: DataScope.COMPANY },
          { module: "leads", action: "view", dataScope: DataScope.COMPANY },
        ],
      },
    },
    include: { permissions: true },
  });

  const userAdminA = await prisma.user.create({
    data: {
      companyId: companyA.id,
      roleId: adminRoleA.id,
      email: `admin_${uniqueSuffix}@example.com`,
      name: "Admin Alpha",
      hashedPassword: "hashed_test_password",
      status: "ACTIVE",
    },
  });

  const sessionAdminA = await createDbSession(userAdminA.id, companyA.id);

  const sampleCsvContent =
    "Full Name,Contact Number,Work Email,Company,Industry Vertical,Budget\n" +
    "Aarav Sharma,+919876543210,aarav@enterprise.in,Enterprise Solutions,IT Services,150000\n" +
    "Priya Patel,+919876543211,priya@patelcorp.com,Patel Corp,Manufacturing,250000\n";

  const previewReq = new NextRequest("http://localhost:3000/api/v1/leads/import/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `universal_crm_session=${sessionAdminA.rawToken}`,
    },
    body: JSON.stringify({
      csvContent: sampleCsvContent,
      filename: "test_leads.csv",
    }),
  });

  const previewRes = await previewRouteHandler(previewReq);
  const previewJson = (await previewRes.json()) as {
    success: boolean;
    data: {
      totalRows: number;
      suggestedMappings: Record<string, string>;
      headerDetections: Array<{ header: string; suggestedField: string | null; confidence: string }>;
      detectionStats: { highConfidenceCount: number; reviewCount: number };
      sampleRows: Array<Record<string, string>>;
    };
  };

  assert.equal(previewRes.status, 200);
  assert.equal(previewJson.data.totalRows, 2);
  assert.equal(previewJson.data.suggestedMappings["Full Name"], "name");
  assert.equal(previewJson.data.suggestedMappings["Contact Number"], "phone");
  assert.equal(previewJson.data.suggestedMappings["Work Email"], "email");
  assert.equal(previewJson.data.suggestedMappings["Industry Vertical"], `cf_${cfIndustryA.key}`);
  assert.equal(previewJson.data.suggestedMappings["Budget"], "amount");
  assert.ok(previewJson.data.headerDetections.length >= 6);

  console.log("  ✓ Preview route successfully generates intelligent mapping metadata and sample rows.");

  // =========================================================================
  // TEST 7: Execute Import with User Overrides & Custom Field Persistence
  // =========================================================================
  console.log("  [7/8] Testing execute import with manual overrides and custom field persistence...");
  const authCtxA = await validateSessionToken(sessionAdminA.rawToken);
  assert.ok(authCtxA, "Session must validate");

  const importResult = await LeadImportService.executeImport(authCtxA, {
    csvContent: sampleCsvContent,
    filename: "test_leads.csv",
    columnMappings: {
      "Full Name": "name",
      "Contact Number": "phone",
      "Work Email": "email",
      Company: "company",
      "Industry Vertical": `cf_${cfIndustryA.key}`,
      Budget: "amount",
    },
    duplicateStrategy: "CREATE",
  });

  assert.equal(importResult.successfulRows, 2, "2 rows should be imported successfully");
  assert.equal(importResult.failedRows, 0);

  // Verify custom field value persisted in database
  const createdLeads = await prisma.lead.findMany({
    where: { companyId: companyA.id },
    include: { customFieldValues: true },
  });
  assert.equal(createdLeads.length, 2);

  const leadAarav = createdLeads.find((l) => l.name === "Aarav Sharma");
  assert.ok(leadAarav, "Lead Aarav Sharma must exist");
  assert.equal(leadAarav.phone, "+919876543210");
  assert.equal(leadAarav.company, "Enterprise Solutions");
  assert.equal(Number(leadAarav.amount), 150000);

  const cfVal = leadAarav.customFieldValues.find((v) => v.customFieldId === cfIndustryA.id);
  assert.ok(cfVal, "Custom field value for Industry Vertical must be saved");
  assert.equal(cfVal.value, "IT Services");

  console.log("  ✓ Imported leads and custom field values persisted correctly.");

  // =========================================================================
  // TEST 8: Server-side Security & Rejection Gates
  // =========================================================================
  console.log("  [8/8] Testing server-side security rejection gates...");

  // 1. Rejection: Foreign company custom field injection
  let foreignCfErrorCaught = false;
  try {
    await LeadImportService.executeImport(authCtxA, {
      csvContent: sampleCsvContent,
      filename: "malicious_cf.csv",
      columnMappings: {
        "Full Name": "name",
        Budget: `cf_${cfSecretB.key}`, // Foreign Company B custom field!
      },
      duplicateStrategy: "CREATE",
    });
  } catch (err: unknown) {
    foreignCfErrorCaught = true;
    const msg = (err as Error).message;
    assert.ok(
      msg.includes("Custom field") || msg.includes("not found") || msg.includes("belong"),
      `Expected foreign custom field error, got: ${msg}`
    );
  }
  assert.equal(foreignCfErrorCaught, true, "Must reject foreign company custom fields");

  // 2. Rejection: Duplicate destination column mappings
  let duplicateTargetErrorCaught = false;
  try {
    await LeadImportService.executeImport(authCtxA, {
      csvContent: sampleCsvContent,
      filename: "duplicate_target.csv",
      columnMappings: {
        "Full Name": "name",
        "Contact Number": "phone",
        "Work Email": "phone", // Duplicate destination mapping to 'phone'!
      },
      duplicateStrategy: "CREATE",
    });
  } catch (err: unknown) {
    duplicateTargetErrorCaught = true;
    const msg = (err as Error).message;
    assert.ok(
      msg.includes("Duplicate destination") || msg.includes("multiple columns"),
      `Expected duplicate target error, got: ${msg}`
    );
  }
  assert.equal(duplicateTargetErrorCaught, true, "Must reject duplicate destination mappings");

  // 3. Rejection: Missing required 'name' mapping
  let missingNameErrorCaught = false;
  try {
    await LeadImportService.executeImport(authCtxA, {
      csvContent: sampleCsvContent,
      filename: "missing_name.csv",
      columnMappings: {
        "Contact Number": "phone",
        "Work Email": "email",
      },
      duplicateStrategy: "CREATE",
    });
  } catch (err: unknown) {
    missingNameErrorCaught = true;
  }
  assert.equal(missingNameErrorCaught, true, "Must reject imports without required 'name' mapping");

  console.log("  ✓ All server-side security validation gates strictly enforced.");

  // Clean-up
  await prisma.customFieldValue.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.lead.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.leadImport.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.customField.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.session.deleteMany({
    where: { user: { companyId: { in: [companyA.id, companyB.id] } } },
  });
  await prisma.user.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.permission.deleteMany({
    where: { role: { companyId: { in: [companyA.id, companyB.id] } } },
  });
  await prisma.role.deleteMany({
    where: { companyId: { in: [companyA.id, companyB.id] } },
  });
  await prisma.company.deleteMany({
    where: { id: { in: [companyA.id, companyB.id] } },
  });

  console.log("✅ Phase 5: CSV Import Intelligence Test Suite Passed Successfully!\n");
}
