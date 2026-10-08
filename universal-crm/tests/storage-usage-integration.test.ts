/**
 * Storage Usage Integration & Security Tests
 *
 * Validates storage filesystem scanning, multi-tenant aggregation,
 * plan limit overrides, and Super Admin access control on /api/v1/admin/usage.
 */

import { prisma } from "../lib/db";
import { storageService } from "../lib/services/storage";
import { PlatformUsageService } from "../lib/services/platform-usage.service";
import { createSuperAdminSession } from "../lib/auth/super-admin-session";
import { hashPassword } from "../lib/auth/password";
import { NextRequest } from "next/server";
import { GET as adminUsageGet } from "../app/api/v1/admin/usage/route";

export async function runStorageUsageIntegrationTests() {
  console.log("\n🧪 Running Storage Usage Integration & Security Tests...");

  const testSuffix = `test_storage_${Date.now()}`;
  const superAdminEmail = `superadmin_${testSuffix}@example.com`;
  const companySlug = `company_${testSuffix}`;

  // 1. Create Super Admin for test session
  const superAdmin = await prisma.superAdmin.create({
    data: {
      email: superAdminEmail,
      name: "Storage Test Super Admin",
      hashedPassword: await hashPassword("SuperAdminPass123!"),
    },
  });

  const sessionResult = await createSuperAdminSession(superAdmin.id, {
    userAgent: "IntegrationTestRunner/1.0",
    ipAddress: "127.0.0.1",
  });

  // 2. Create Test Company with Plan
  const plan = await prisma.plan.findFirst({ where: { code: "STARTER" } });

  const testCompany = await prisma.company.create({
    data: {
      name: "Storage Telemetry Test Corp",
      slug: companySlug,
      currency: "USD",
      planId: plan?.id,
    },
  });

  const createdFileKeys: string[] = [];

  try {
    // 3. Verify Empty Company Storage
    console.log("  → [Storage] Empty company storage verification...");
    const emptyStats = await storageService.getCompanyStorageUsage(testCompany.id);
    if (emptyStats.usedBytes !== 0 || emptyStats.fileCount !== 0) {
      throw new Error(`Expected 0 bytes and 0 files, got ${emptyStats.usedBytes} bytes, ${emptyStats.fileCount} files`);
    }

    // 4. Upload Files via storageService
    console.log("  → [Storage] Uploading test files across namespaces...");
    const buf1 = Buffer.alloc(1024, "A"); // 1 KB
    const buf2 = Buffer.alloc(2048, "B"); // 2 KB

    const res1 = await storageService.upload({
      companyId: testCompany.id,
      folder: "leads",
      filename: "lead_document.pdf",
      mimeType: "application/pdf",
      buffer: buf1,
    });
    createdFileKeys.push(res1.key);

    const res2 = await storageService.upload({
      companyId: testCompany.id,
      folder: "logos",
      filename: "company_logo.png",
      mimeType: "image/png",
      buffer: buf2,
    });
    createdFileKeys.push(res2.key);

    // 5. Verify Company Storage Aggregation
    console.log("  → [Storage] Validating measured usage and categories...");
    const populatedStats = await storageService.getCompanyStorageUsage(testCompany.id);

    if (populatedStats.usedBytes !== 3072) {
      throw new Error(`Expected 3072 bytes, got ${populatedStats.usedBytes}`);
    }
    if (populatedStats.fileCount !== 2) {
      throw new Error(`Expected 2 files, got ${populatedStats.fileCount}`);
    }
    if (!populatedStats.categories.leads || populatedStats.categories.leads.usedBytes !== 1024) {
      throw new Error(`Expected 1024 bytes in leads category, got ${JSON.stringify(populatedStats.categories)}`);
    }
    if (!populatedStats.categories.logos || populatedStats.categories.logos.usedBytes !== 2048) {
      throw new Error(`Expected 2048 bytes in logos category, got ${JSON.stringify(populatedStats.categories)}`);
    }

    // 6. Test PlatformUsageService Telemetry
    console.log("  → [PlatformUsageService] Aggregating fleet telemetry...");
    const telemetry = await PlatformUsageService.getPlatformUsageTelemetry();

    if (telemetry.platform.totalOrganizations <= 0) {
      throw new Error("Expected totalOrganizations > 0");
    }
    if (telemetry.platform.totalStorageUsedBytes < 3072) {
      throw new Error(`Expected totalStorageUsedBytes >= 3072, got ${telemetry.platform.totalStorageUsedBytes}`);
    }

    const matchedOrg = telemetry.organizations.find((o) => o.id === testCompany.id);
    if (!matchedOrg) {
      throw new Error(`Test company ${testCompany.id} not found in telemetry reports`);
    }
    if (matchedOrg.storage.usedBytes !== 3072 || matchedOrg.storage.fileCount !== 2) {
      throw new Error(`Matched org storage mismatch: ${JSON.stringify(matchedOrg.storage)}`);
    }

    // 7. Test Limit Overrides Integration
    console.log("  → [PlatformUsageService] Limit overrides & threshold transitions...");
    // Case A: Override 10,000 bytes (Healthy)
    await prisma.company.update({
      where: { id: testCompany.id },
      data: {
        historyPreviewFields: {
          __limitOverrides: { maxStorageBytes: 10000 },
        },
      },
    });

    const reportA = await PlatformUsageService.getCompanyStorageUsage(testCompany.id);
    if (reportA.storage.limitBytes !== 10000) {
      throw new Error(`Expected limitBytes 10000, got ${reportA.storage.limitBytes}`);
    }
    if (reportA.storage.usagePercentage !== 30.7) {
      throw new Error(`Expected 30.7%, got ${reportA.storage.usagePercentage}%`);
    }
    if (reportA.storage.status !== "HEALTHY") {
      throw new Error(`Expected HEALTHY, got ${reportA.storage.status}`);
    }

    // Case B: Override 3,500 bytes (Near Limit: 3072/3500 = 87.8%)
    await prisma.company.update({
      where: { id: testCompany.id },
      data: {
        historyPreviewFields: {
          __limitOverrides: { maxStorageBytes: 3500 },
        },
      },
    });

    const reportB = await PlatformUsageService.getCompanyStorageUsage(testCompany.id);
    if (reportB.storage.status !== "NEAR_LIMIT") {
      throw new Error(`Expected NEAR_LIMIT, got ${reportB.storage.status}`);
    }

    // Case C: Override 3,000 bytes (Over Limit: 3072 >= 3000)
    await prisma.company.update({
      where: { id: testCompany.id },
      data: {
        historyPreviewFields: {
          __limitOverrides: { maxStorageBytes: 3000 },
        },
      },
    });

    const reportC = await PlatformUsageService.getCompanyStorageUsage(testCompany.id);
    if (reportC.storage.status !== "OVER_LIMIT") {
      throw new Error(`Expected OVER_LIMIT, got ${reportC.storage.status}`);
    }

    // 8. Super Admin API Route Authorization Tests
    console.log("  → [API Route Security] /api/v1/admin/usage access control...");

    // 8a. Missing session -> 401 Unauthorized
    const unauthReq = new NextRequest("http://localhost:3000/api/v1/admin/usage");
    const unauthRes = await adminUsageGet(unauthReq);
    if (unauthRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for missing session, got ${unauthRes.status}`);
    }

    // 8b. Valid Super Admin Session -> 200 OK with telemetry
    const authReq = new NextRequest("http://localhost:3000/api/v1/admin/usage", {
      headers: {
        Cookie: `universal_crm_superadmin_session=${sessionResult.rawToken}`,
      },
    });
    const authRes = await adminUsageGet(authReq);
    if (authRes.status !== 200) {
      throw new Error(`Expected 200 OK for valid Super Admin, got ${authRes.status}`);
    }
    const authJson = (await authRes.json()) as any;
    if (!authJson.success || !authJson.data.platform || !authJson.data.organizations) {
      throw new Error(`Invalid telemetry API response structure: ${JSON.stringify(authJson)}`);
    }

    console.log("  ✓ Storage Usage Integration & Security Tests Passed Successfully!");
  } finally {
    // 9. Cleanup test files & DB records
    for (const key of createdFileKeys) {
      try {
        await storageService.delete(key, testCompany.id);
      } catch {
        // Ignore deletion errors during cleanup
      }
    }

    await prisma.company.delete({ where: { id: testCompany.id } }).catch(() => {});
    await prisma.superAdminSession.deleteMany({ where: { superAdminId: superAdmin.id } }).catch(() => {});
    await prisma.superAdmin.delete({ where: { id: superAdmin.id } }).catch(() => {});
  }
}

if (require.main === module) {
  runStorageUsageIntegrationTests().catch((e) => {
    console.error("Storage usage integration test failed:", e);
    process.exit(1);
  });
}
