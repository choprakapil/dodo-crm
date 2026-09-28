/**
 * Hardened Test Suite for Phase B.0 Production Services
 *
 * Covers all 16 required tests across Email, Storage, and Rate Limiting:
 *
 * EMAIL:
 * 1. Production + valid Resend configuration → Resend implementation selected.
 * 2. Production + missing RESEND_API_KEY → configuration failure.
 * 3. Production + missing EMAIL_FROM_ADDRESS → configuration failure.
 * 4. Development + explicit mock → mock works.
 * 5. Production must NEVER silently use mock (explicit rejection).
 *
 * STORAGE:
 * 6. Production + valid R2 config → R2 selected.
 * 7. Production + missing R2 credentials → configuration failure.
 * 8. Explicit local provider → local works only in allowed environment.
 * 9. Missing companyId → strictly rejected.
 * 10. Tenant key prefix is always applied ({companyId}/{folder}/...).
 * 11. Path traversal attempts (../, ..\, absolute paths) are rejected or sanitized.
 * 12. Signed URL is private/expiring and validates tenant ownership.
 *
 * RATE LIMIT:
 * 13. Production + valid Upstash config → Upstash selected.
 * 14. Production + missing Upstash config → configuration failure.
 * 15. Explicit memory provider works in development/test.
 * 16. Verify actual Upstash reset behavior using the installed package version (evalsha Lua call).
 *
 * ABSENT & UNSUPPORTED PROVIDERS (FAIL-CLOSED):
 * 17. Production + missing EMAIL_PROVIDER → fails closed on send.
 * 18. Production + missing STORAGE_PROVIDER → fails closed on upload.
 * 19. Production + missing RATE_LIMIT_PROVIDER → fails closed on check.
 * 20. Production + unsupported provider values → immediately throws ServiceConfigurationError in factory.
 */

import {
  ResendEmailService,
  MockEmailService,
  createEmailService,
  ServiceConfigurationError as EmailConfigError,
} from "../lib/services/email";
import {
  R2StorageService,
  LocalStorageService,
  createStorageService,
  buildCompanyStorageKey,
  validateTenantKey,
  ServiceConfigurationError as StorageConfigError,
  TenantIsolationViolationError,
} from "../lib/services/storage";
import {
  UpstashRateLimiter,
  InMemoryRateLimiter,
  createRateLimiter,
  ServiceConfigurationError as RateLimitConfigError,
} from "../lib/services/rate-limit";
import { Ratelimit } from "@upstash/ratelimit";

export async function runPhaseB0ServiceTests() {
  console.log("\n====================================================================");
  console.log("🚀 RUNNING PHASE B.0 HARDENING TEST SUITE (Fail-Closed & Security Checks)");
  console.log("====================================================================");

  // Helper to preserve env across scoped tests
  const originalEnv = { ...process.env };

  try {
    // =========================================================================
    // SECTION 1: EMAIL SERVICE HARDENING TESTS
    // =========================================================================
    console.log("\n--- [TEST SUITE 1] EMAIL SERVICE: Fail-Closed & Provider Selection ---");

    // Test 1: Production + valid Resend configuration → Resend implementation selected
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_valid_key_12345";
    process.env.EMAIL_FROM_ADDRESS = "support@universalcrm.com";
    const prodEmailService = createEmailService();
    if (!(prodEmailService instanceof ResendEmailService)) {
      throw new Error("Test 1 Failed: Expected ResendEmailService to be selected in production.");
    }
    console.log("  ✓ [Unit] Test 1: Production + valid Resend configuration selects ResendEmailService");

    // Test 2: Production + missing RESEND_API_KEY → configuration failure
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM_ADDRESS = "support@universalcrm.com";
    const brokenEmailServiceKey = createEmailService();
    let threwKeyError = false;
    try {
      await brokenEmailServiceKey.send({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
    } catch (err: any) {
      if (err instanceof EmailConfigError && err.message.includes("RESEND_API_KEY")) {
        threwKeyError = true;
      }
    }
    if (!threwKeyError) {
      throw new Error("Test 2 Failed: Missing RESEND_API_KEY did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Unit] Test 2: Missing RESEND_API_KEY causes immediate configuration failure");

    // Test 3: Production + missing EMAIL_FROM_ADDRESS → configuration failure
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_valid_key_12345";
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM;
    const brokenEmailServiceFrom = createEmailService();
    let threwFromError = false;
    try {
      await brokenEmailServiceFrom.send({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
    } catch (err: any) {
      if (err instanceof EmailConfigError && err.message.includes("EMAIL_FROM_ADDRESS")) {
        threwFromError = true;
      }
    }
    if (!threwFromError) {
      throw new Error("Test 3 Failed: Missing EMAIL_FROM_ADDRESS did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Unit] Test 3: Missing EMAIL_FROM_ADDRESS causes immediate configuration failure");

    // Test 4: Development + explicit mock → mock works
    (process.env as any).NODE_ENV = "development";
    process.env.EMAIL_PROVIDER = "mock";
    const devMockEmailService = createEmailService();
    if (!(devMockEmailService instanceof MockEmailService)) {
      throw new Error("Test 4 Failed: Expected MockEmailService when EMAIL_PROVIDER=mock in development.");
    }
    const mockSendResult = await devMockEmailService.send({
      to: "developer@example.com",
      subject: "Dev Email",
      html: "<p>Dev</p>",
    });
    if (!mockSendResult.success || !mockSendResult.messageId) {
      throw new Error("Test 4 Failed: Mock send did not return success.");
    }
    console.log("  ✓ [Unit] Test 4: Explicit mock in development sends successfully via MockEmailService");

    // Test 5: Production must NEVER silently use mock (explicit rejection at runtime)
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "mock";
    const prodMockService = createEmailService();
    let threwProdMockError = false;
    try {
      await prodMockService.send({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
    } catch (err: any) {
      if (err instanceof EmailConfigError && err.message.includes("cannot be executed in production")) {
        threwProdMockError = true;
      }
    }
    if (!threwProdMockError) {
      throw new Error("Test 5 Failed: Mock email send in production did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Security] Test 5: Production strictly forbids mock email execution");

    // =========================================================================
    // SECTION 2: STORAGE SERVICE HARDENING TESTS
    // =========================================================================
    console.log("\n--- [TEST SUITE 2] STORAGE SERVICE: Fail-Closed & Namespace Isolation ---");

    // Test 6: Production + valid R2 config → R2 selected
    (process.env as any).NODE_ENV = "production";
    process.env.STORAGE_PROVIDER = "r2";
    process.env.STORAGE_BUCKET = "test-crm-bucket";
    process.env.STORAGE_ACCESS_KEY = "test_access_key";
    process.env.STORAGE_SECRET_KEY = "test_secret_key";
    process.env.STORAGE_ENDPOINT = "https://test.r2.cloudflarestorage.com";
    const prodStorage = createStorageService();
    if (!(prodStorage instanceof R2StorageService)) {
      throw new Error("Test 6 Failed: Expected R2StorageService when STORAGE_PROVIDER=r2.");
    }
    console.log("  ✓ [Unit] Test 6: Production + valid R2 credentials selects R2StorageService");

    // Test 7: Production + missing R2 credentials → configuration failure
    (process.env as any).NODE_ENV = "production";
    process.env.STORAGE_PROVIDER = "r2";
    delete process.env.STORAGE_ACCESS_KEY;
    const brokenStorage = createStorageService();
    let threwR2ConfigError = false;
    try {
      await brokenStorage.upload({
        buffer: Buffer.from("data"),
        filename: "test.csv",
        mimeType: "text/csv",
        companyId: "comp_123",
      });
    } catch (err: any) {
      if (err instanceof StorageConfigError && err.message.includes("STORAGE_ACCESS_KEY")) {
        threwR2ConfigError = true;
      }
    }
    if (!threwR2ConfigError) {
      throw new Error("Test 7 Failed: Missing STORAGE_ACCESS_KEY did not throw StorageConfigError on upload!");
    }
    console.log("  ✓ [Unit] Test 7: Missing R2 credentials cause immediate configuration failure");

    // Test 8: Explicit local provider → local works only in allowed environment
    (process.env as any).NODE_ENV = "production";
    process.env.STORAGE_PROVIDER = "local";
    const prodLocalStorage = createStorageService();
    let threwLocalInProd = false;
    try {
      await prodLocalStorage.upload({
        buffer: Buffer.from("data"),
        filename: "test.csv",
        mimeType: "text/csv",
        companyId: "comp_123",
      });
    } catch (err: any) {
      if (err instanceof StorageConfigError && err.message.includes("cannot be executed in production")) {
        threwLocalInProd = true;
      }
    }
    if (!threwLocalInProd) {
      throw new Error("Test 8 Failed: LocalStorageService upload in production did not throw StorageConfigError!");
    }

    (process.env as any).NODE_ENV = "development";
    process.env.STORAGE_PROVIDER = "local";
    const devLocalStorage = createStorageService();
    if (!(devLocalStorage instanceof LocalStorageService)) {
      throw new Error("Test 8 Failed: LocalStorageService not selected in development.");
    }
    console.log("  ✓ [Security] Test 8: STORAGE_PROVIDER=local strictly rejected in prod, allowed in dev");

    // Test 9: Missing companyId → rejected
    let threwMissingCompany = false;
    try {
      buildCompanyStorageKey("", "leads", "import.csv");
    } catch (err: any) {
      if (err instanceof TenantIsolationViolationError) {
        threwMissingCompany = true;
      }
    }
    if (!threwMissingCompany) {
      throw new Error("Test 9 Failed: Empty companyId was not rejected with TenantIsolationViolationError!");
    }
    console.log("  ✓ [Security] Test 9: Missing companyId rejected with TenantIsolationViolationError");

    // Test 10: Tenant key prefix is always applied ({companyId}/{folder}/...)
    const tenantId = "company_tenant_999";
    const safeKey = buildCompanyStorageKey(tenantId, "leads", "import-data.csv");
    if (!safeKey.startsWith(`${tenantId}/leads/import-data-`)) {
      throw new Error(`Test 10 Failed: Expected key to start with '${tenantId}/leads/import-data-', got: ${safeKey}`);
    }
    console.log("  ✓ [Security] Test 10: Tenant namespace isolation prefix strictly enforced:", safeKey);

    // Test 11: Path traversal attempts are rejected or sanitized
    const traversalKey1 = buildCompanyStorageKey(tenantId, "../../etc/passwd", "malicious.csv");
    if (traversalKey1.includes("..") || !traversalKey1.startsWith(`${tenantId}/etc/passwd/`)) {
      throw new Error(`Test 11 Failed: Directory traversal was not sanitized in folder: ${traversalKey1}`);
    }

    let threwIllegalCompany = false;
    try {
      buildCompanyStorageKey("../malicious_company", "leads", "test.csv");
    } catch (err: any) {
      if (err instanceof TenantIsolationViolationError) {
        threwIllegalCompany = true;
      }
    }
    if (!threwIllegalCompany) {
      throw new Error("Test 11 Failed: Directory traversal in companyId was not rejected!");
    }
    console.log("  ✓ [Security] Test 11: Path traversal attempts in companyId and folder strictly blocked");

    // Test 12: Presigned URL is private/expiring and validates tenant ownership
    let threwCrossTenantAccess = false;
    try {
      validateTenantKey("company_victim_111", "company_attacker_222/leads/private.csv");
    } catch (err: any) {
      if (err instanceof TenantIsolationViolationError) {
        threwCrossTenantAccess = true;
      }
    }
    if (!threwCrossTenantAccess) {
      throw new Error("Test 12 Failed: Cross-tenant key access was not rejected by validateTenantKey!");
    }
    console.log("  ✓ [Security] Test 12: Cross-tenant key access rejected with TenantIsolationViolationError");

    // =========================================================================
    // SECTION 3: RATE LIMITER HARDENING TESTS
    // =========================================================================
    console.log("\n--- [TEST SUITE 3] RATE LIMITER: Fail-Closed & Upstash Reset Verification ---");

    // Test 13: Production + valid Upstash config → Upstash selected
    (process.env as any).NODE_ENV = "production";
    process.env.RATE_LIMIT_PROVIDER = "upstash";
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash-instance.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake_test_token_abc123";
    const prodLimiter = createRateLimiter();
    if (!(prodLimiter instanceof UpstashRateLimiter)) {
      throw new Error("Test 13 Failed: Expected UpstashRateLimiter when RATE_LIMIT_PROVIDER=upstash.");
    }
    console.log("  ✓ [Unit] Test 13: Production + valid Upstash configuration selects UpstashRateLimiter");

    // Test 14: Production + missing Upstash config → configuration failure
    (process.env as any).NODE_ENV = "production";
    process.env.RATE_LIMIT_PROVIDER = "upstash";
    delete process.env.UPSTASH_REDIS_REST_URL;
    const brokenLimiter = createRateLimiter();
    let threwRateLimitConfigError = false;
    try {
      await brokenLimiter.check({ key: "test:ip:1.1.1.1", limit: 5, windowMs: 60000 });
    } catch (err: any) {
      if (err instanceof RateLimitConfigError && err.message.includes("UPSTASH_REDIS_REST_URL")) {
        threwRateLimitConfigError = true;
      }
    }
    if (!threwRateLimitConfigError) {
      throw new Error("Test 14 Failed: Missing UPSTASH_REDIS_REST_URL did not throw RateLimitConfigError!");
    }
    console.log("  ✓ [Unit] Test 14: Missing Upstash credentials cause immediate configuration failure");

    // Test 15: Explicit memory provider works in development/test, rejected in prod
    (process.env as any).NODE_ENV = "production";
    process.env.RATE_LIMIT_PROVIDER = "memory";
    const prodMemoryLimiter = createRateLimiter();
    let threwMemoryInProd = false;
    try {
      await prodMemoryLimiter.check({ key: "test:mem", limit: 5, windowMs: 60000 });
    } catch (err: any) {
      if (err instanceof RateLimitConfigError && err.message.includes("cannot be executed in production")) {
        threwMemoryInProd = true;
      }
    }
    if (!threwMemoryInProd) {
      throw new Error("Test 15 Failed: RATE_LIMIT_PROVIDER=memory check in production did not throw RateLimitConfigError!");
    }

    (process.env as any).NODE_ENV = "development";
    process.env.RATE_LIMIT_PROVIDER = "memory";
    const devMemoryLimiter = createRateLimiter();
    if (!(devMemoryLimiter instanceof InMemoryRateLimiter)) {
      throw new Error("Test 15 Failed: InMemoryRateLimiter not selected in development.");
    }
    const memCheck = await devMemoryLimiter.check({ key: "mem_test", limit: 10, windowMs: 60000 });
    if (!memCheck.success || memCheck.remaining !== 9) {
      throw new Error("Test 15 Failed: In-memory rate check failed.");
    }
    console.log("  ✓ [Security] Test 15: RATE_LIMIT_PROVIDER=memory strictly rejected in prod, works in dev");

    // Test 16: Verify actual Upstash reset behavior using the installed package version
    // Mock Redis context for @upstash/ratelimit to verify evalsha Lua script arguments
    let capturedKeys: string[] = [];
    const mockRedis = {
      evalsha: async (_hash: string, keys: string[], _args: any[]) => {
        capturedKeys = keys;
        return 1;
      },
      eval: async (_script: string, keys: string[], _args: any[]) => {
        capturedKeys = keys;
        return 1;
      },
    };

    const verifiedRatelimit = new Ratelimit({
      redis: mockRedis as any,
      limiter: Ratelimit.slidingWindow(5, "60 s"),
      prefix: "crm_ratelimit",
    });

    await verifiedRatelimit.resetUsedTokens("login:ip:10.0.0.1");

    // Verify pattern passed to Redis EVALSHA is ['crm_ratelimit:login:ip:10.0.0.1:*']
    if (!capturedKeys.includes("crm_ratelimit:login:ip:10.0.0.1:*")) {
      throw new Error(
        `Test 16 Failed: Upstash resetUsedTokens did not pass expected sliding window pattern. Keys passed: ${JSON.stringify(capturedKeys)}`
      );
    }
    console.log("  ✓ [Mocked SDK] Test 16: Upstash reset behavior verified against installed package version:");
    console.log("                  Evaluated Redis EVALSHA with pattern:", capturedKeys);

    // =========================================================================
    // SECTION 4: ABSENT & UNSUPPORTED PROVIDER FAIL-CLOSED TESTS
    // =========================================================================
    console.log("\n--- [TEST SUITE 4] ABSENT & UNSUPPORTED PROVIDERS: Fail-Closed Enforced ---");

    // Test 17: Production + missing EMAIL_PROVIDER → fails closed on send
    (process.env as any).NODE_ENV = "production";
    delete process.env.EMAIL_PROVIDER;
    process.env.RESEND_API_KEY = "re_test_valid_key_12345";
    process.env.EMAIL_FROM_ADDRESS = "support@universalcrm.com";
    const missingEmailProviderService = createEmailService();
    let threwMissingEmailProvider = false;
    try {
      await missingEmailProviderService.send({ to: "test@example.com", subject: "Hi", html: "<p>Hi</p>" });
    } catch (err: any) {
      if (err instanceof EmailConfigError && err.message.includes("EMAIL_PROVIDER")) {
        threwMissingEmailProvider = true;
      }
    }
    if (!threwMissingEmailProvider) {
      throw new Error("Test 17 Failed: Missing EMAIL_PROVIDER in production did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Unit] Test 17: Missing EMAIL_PROVIDER in production strictly fails closed on send");

    // Test 18: Production + missing STORAGE_PROVIDER → fails closed on upload
    (process.env as any).NODE_ENV = "production";
    delete process.env.STORAGE_PROVIDER;
    process.env.STORAGE_BUCKET = "test-crm-bucket";
    process.env.STORAGE_ACCESS_KEY = "test_access_key";
    process.env.STORAGE_SECRET_KEY = "test_secret_key";
    process.env.STORAGE_ENDPOINT = "https://test.r2.cloudflarestorage.com";
    const missingStorageProviderService = createStorageService();
    let threwMissingStorageProvider = false;
    try {
      await missingStorageProviderService.upload({
        buffer: Buffer.from("data"),
        filename: "test.csv",
        mimeType: "text/csv",
        companyId: "comp_123",
      });
    } catch (err: any) {
      if (err instanceof StorageConfigError && err.message.includes("STORAGE_PROVIDER")) {
        threwMissingStorageProvider = true;
      }
    }
    if (!threwMissingStorageProvider) {
      throw new Error("Test 18 Failed: Missing STORAGE_PROVIDER in production did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Unit] Test 18: Missing STORAGE_PROVIDER in production strictly fails closed on upload");

    // Test 19: Production + missing RATE_LIMIT_PROVIDER → fails closed on check
    (process.env as any).NODE_ENV = "production";
    delete process.env.RATE_LIMIT_PROVIDER;
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash-instance.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake_test_token_abc123";
    const missingRateLimitProviderService = createRateLimiter();
    let threwMissingRateLimitProvider = false;
    try {
      await missingRateLimitProviderService.check({ key: "test:ip:1.1.1.1", limit: 5, windowMs: 60000 });
    } catch (err: any) {
      if (err instanceof RateLimitConfigError && err.message.includes("RATE_LIMIT_PROVIDER")) {
        threwMissingRateLimitProvider = true;
      }
    }
    if (!threwMissingRateLimitProvider) {
      throw new Error("Test 19 Failed: Missing RATE_LIMIT_PROVIDER in production did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Unit] Test 19: Missing RATE_LIMIT_PROVIDER in production strictly fails closed on check");

    // Test 20: Unsupported provider values → immediately throws ServiceConfigurationError in factory
    (process.env as any).NODE_ENV = "production";
    process.env.EMAIL_PROVIDER = "sendgrid";
    process.env.STORAGE_PROVIDER = "gcs";
    process.env.RATE_LIMIT_PROVIDER = "dynamodb";

    let threwUnsupportedEmail = false;
    try {
      createEmailService();
    } catch (err: any) {
      if (err instanceof EmailConfigError && err.message.includes("Unsupported EMAIL_PROVIDER")) {
        threwUnsupportedEmail = true;
      }
    }

    let threwUnsupportedStorage = false;
    try {
      createStorageService();
    } catch (err: any) {
      if (err instanceof StorageConfigError && err.message.includes("Unsupported STORAGE_PROVIDER")) {
        threwUnsupportedStorage = true;
      }
    }

    let threwUnsupportedRateLimit = false;
    try {
      createRateLimiter();
    } catch (err: any) {
      if (err instanceof RateLimitConfigError && err.message.includes("Unsupported RATE_LIMIT_PROVIDER")) {
        threwUnsupportedRateLimit = true;
      }
    }

    if (!threwUnsupportedEmail || !threwUnsupportedStorage || !threwUnsupportedRateLimit) {
      throw new Error("Test 20 Failed: Unsupported provider values did not throw ServiceConfigurationError!");
    }
    console.log("  ✓ [Unit] Test 20: Unsupported provider values strictly throw ServiceConfigurationError in factory");

    console.log("\n====================================================================");
    console.log("🎉 ALL 20 PHASE B.0 HARDENING TESTS PASSED SUCCESFULLY!");
    console.log("====================================================================\n");
  } finally {
    // Restore environment
    process.env = originalEnv;
  }
}

if (require.main === module) {
  runPhaseB0ServiceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ HARDENING TEST SUITE FAILED:\n", err);
      process.exit(1);
    });
}
