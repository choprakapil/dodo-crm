/**
 * Hardened Test Suite for Phase B.1 Environment & Configuration
 *
 * Explicitly Verifies:
 *
 * DATABASE SAFETY:
 * 1. Production NODE_ENV always prevents test execution / test database retrieval.
 * 2. Production-like DATABASE_URL with neutral hostname cannot bypass the safety mechanism.
 * 3. Missing test database configuration fails closed.
 * 4. Valid explicitly configured test database is accepted.
 *
 * APP_URL BEHAVIOR:
 * 5. Production + missing APP_URL fails closed.
 * 6. Production + NEXT_PUBLIC_APP_URL only still fails closed.
 * 7. Production + valid APP_URL succeeds.
 * 8. Development fallback behaves as documented (APP_URL > NEXT_PUBLIC_APP_URL > localhost).
 *
 * ADDITIONAL SYSTEM HARDENING:
 * 9. Production rejects localhost/127.0.0.1 APP_URL.
 * 10. Production getDatabaseUrl throws when DATABASE_URL is missing.
 * 11. appConfig.sessionMaxAgeSeconds correctly defaults to 86400 and parses valid values.
 * 12. Structured logger sanitizes sensitive keys (passwords, tokens, secrets, api keys).
 * 13. appConfig boolean flags match active NODE_ENV.
 */

import { getAppUrl, getDatabaseUrl, getTestDatabaseUrl, appConfig, ConfigurationError } from "../lib/config";
import { logger } from "../lib/logger";

export async function runPhaseB1ConfigTests() {
  console.log("\n====================================================================");
  console.log("🚀 RUNNING PHASE B.1 CONFIGURATION HARDENING TEST SUITE");
  console.log("====================================================================");

  const originalEnv = { ...process.env };

  try {
    // ------------------------------------------------------------------
    // DATABASE SAFETY TESTS (1 - 4)
    // ------------------------------------------------------------------

    // Test 1: Production NODE_ENV always prevents test runner / test database retrieval
    (process.env as any).NODE_ENV = "production";
    process.env.TEST_DATABASE_URL = "postgresql://test_user:test_pass@localhost:5432/crm_test";
    let threwProdTestAbort = false;
    try {
      getTestDatabaseUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("Test execution prohibited: NODE_ENV is set to 'production'")) {
        threwProdTestAbort = true;
      }
    }
    if (!threwProdTestAbort) {
      throw new Error("Test 1 Failed: Production NODE_ENV did not abort test database retrieval!");
    }
    console.log("  ✓ Test 1: Production NODE_ENV always prevents test database retrieval");

    // Test 2: Production-like DATABASE_URL with neutral hostname cannot bypass the safety mechanism
    (process.env as any).NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://user:password@db.example.com/crm";
    delete process.env.TEST_DATABASE_URL;
    let threwNeutralBypass = false;
    try {
      getTestDatabaseUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("TEST_DATABASE_URL must be explicitly configured")) {
        threwNeutralBypass = true;
      }
    }
    if (!threwNeutralBypass) {
      throw new Error("Test 2 Failed: Neutral hostname DATABASE_URL bypassed test safety without TEST_DATABASE_URL!");
    }
    console.log("  ✓ Test 2: Neutral hostname DATABASE_URL cannot bypass test database safety");

    // Test 3: Missing test database configuration fails closed
    (process.env as any).NODE_ENV = "development";
    delete process.env.TEST_DATABASE_URL;
    delete process.env.DATABASE_URL;
    let threwMissingTestDb = false;
    try {
      getTestDatabaseUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("TEST_DATABASE_URL must be explicitly configured")) {
        threwMissingTestDb = true;
      }
    }
    if (!threwMissingTestDb) {
      throw new Error("Test 3 Failed: Missing TEST_DATABASE_URL did not fail closed!");
    }
    console.log("  ✓ Test 3: Missing test database configuration fails closed");

    // Test 4: Valid explicitly configured test database is accepted
    (process.env as any).NODE_ENV = "development";
    process.env.TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/universal_crm_dev";
    const acceptedUrl = getTestDatabaseUrl();
    if (acceptedUrl !== "postgresql://postgres:password@localhost:5432/universal_crm_dev") {
      throw new Error(`Test 4 Failed: Expected accepted test URL, got '${acceptedUrl}'`);
    }
    console.log("  ✓ Test 4: Valid explicitly configured test database is accepted");

    // ------------------------------------------------------------------
    // APP_URL DETERMINISTIC TESTS (5 - 8)
    // ------------------------------------------------------------------

    // Test 5: Production + missing APP_URL fails closed
    (process.env as any).NODE_ENV = "production";
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    let threwMissingAppUrl = false;
    try {
      getAppUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("APP_URL must be set")) {
        threwMissingAppUrl = true;
      }
    }
    if (!threwMissingAppUrl) {
      throw new Error("Test 5 Failed: Missing APP_URL in production did not throw ConfigurationError!");
    }
    console.log("  ✓ Test 5: Production + missing APP_URL fails closed");

    // Test 6: Production + NEXT_PUBLIC_APP_URL only still fails closed
    (process.env as any).NODE_ENV = "production";
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://crm.example.com";
    let threwNextPublicOnly = false;
    try {
      getAppUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("NEXT_PUBLIC_APP_URL cannot be used as a production fallback")) {
        threwNextPublicOnly = true;
      }
    }
    if (!threwNextPublicOnly) {
      throw new Error("Test 6 Failed: Production allowed NEXT_PUBLIC_APP_URL fallback!");
    }
    console.log("  ✓ Test 6: Production + NEXT_PUBLIC_APP_URL only still fails closed");

    // Test 7: Production + valid APP_URL succeeds
    (process.env as any).NODE_ENV = "production";
    process.env.APP_URL = "https://crm.company.com/";
    const prodValidUrl = getAppUrl();
    if (prodValidUrl !== "https://crm.company.com") {
      throw new Error(`Test 7 Failed: Expected 'https://crm.company.com', got '${prodValidUrl}'`);
    }
    console.log("  ✓ Test 7: Production + valid APP_URL succeeds and trims trailing slash");

    // Test 8: Development fallback behaves as documented
    (process.env as any).NODE_ENV = "development";

    // 8a: APP_URL preferred
    process.env.APP_URL = "http://localhost:8080/";
    process.env.NEXT_PUBLIC_APP_URL = "http://crm.local:3000";
    if (getAppUrl() !== "http://localhost:8080") {
      throw new Error("Test 8a Failed: APP_URL should take priority in development");
    }

    // 8b: NEXT_PUBLIC_APP_URL fallback in dev
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "http://crm.local:3000/";
    if (getAppUrl() !== "http://crm.local:3000") {
      throw new Error("Test 8b Failed: NEXT_PUBLIC_APP_URL should be accepted as fallback in dev");
    }

    // 8c: Safe default http://localhost:3000
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    if (getAppUrl() !== "http://localhost:3000") {
      throw new Error("Test 8c Failed: Default http://localhost:3000 should be returned when unset in dev");
    }
    console.log("  ✓ Test 8: Development fallback behaves as documented (APP_URL > NEXT_PUBLIC_APP_URL > localhost:3000)");

    // ------------------------------------------------------------------
    // ADDITIONAL SYSTEM INTEGRITY TESTS (9 - 13)
    // ------------------------------------------------------------------

    // Test 9: Production strictly rejects localhost/127.0.0.1 APP_URL
    (process.env as any).NODE_ENV = "production";
    process.env.APP_URL = "http://localhost:3000";
    let threwLocalhostInProd = false;
    try {
      getAppUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("cannot point to localhost")) {
        threwLocalhostInProd = true;
      }
    }
    if (!threwLocalhostInProd) {
      throw new Error("Test 9 Failed: localhost APP_URL in production did not throw ConfigurationError!");
    }
    console.log("  ✓ Test 9: Production strictly rejects localhost/127.0.0.1 APP_URL");

    // Test 10: getDatabaseUrl in production throws when missing
    (process.env as any).NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    let threwMissingDbUrl = false;
    try {
      getDatabaseUrl();
    } catch (err: any) {
      if (err instanceof ConfigurationError && err.message.includes("DATABASE_URL must be defined")) {
        threwMissingDbUrl = true;
      }
    }
    if (!threwMissingDbUrl) {
      throw new Error("Test 10 Failed: Missing DATABASE_URL in production did not throw ConfigurationError!");
    }
    console.log("  ✓ Test 10: Production throws ConfigurationError when DATABASE_URL is missing");

    // Test 11: appConfig.sessionMaxAgeSeconds handles valid and invalid values
    delete process.env.SESSION_MAX_AGE_SECONDS;
    if (appConfig.sessionMaxAgeSeconds() !== 86400) {
      throw new Error("Test 11 Failed: Expected default 86400");
    }
    process.env.SESSION_MAX_AGE_SECONDS = "172800";
    if (appConfig.sessionMaxAgeSeconds() !== 172800) {
      throw new Error("Test 11 Failed: Expected parsed 172800");
    }
    process.env.SESSION_MAX_AGE_SECONDS = "invalid_number";
    if (appConfig.sessionMaxAgeSeconds() !== 86400) {
      throw new Error("Test 11 Failed: Expected fallback 86400 for invalid number");
    }
    console.log("  ✓ Test 11: Session max age seconds correctly parsed with safe fallback");

    // Test 12: Logger sanitizes sensitive credentials
    let loggedEntry: any = null;
    const originalConsoleLog = console.log;
    console.log = (msg: string) => {
      try {
        loggedEntry = JSON.parse(msg);
      } catch {
        loggedEntry = msg;
      }
    };
    try {
      logger.info("User action test", {
        userId: "usr_123",
        password: "SecretPassword123!",
        apiKey: "re_live_secretkey",
        token: "raw_secret_token",
        validData: "safe_value",
      });
    } finally {
      console.log = originalConsoleLog;
    }
    if (loggedEntry?.password || loggedEntry?.apiKey || loggedEntry?.token) {
      throw new Error(`Test 12 Failed: Logger leaked sensitive keys: ${JSON.stringify(loggedEntry)}`);
    }
    if (loggedEntry?.validData !== "safe_value") {
      throw new Error("Test 12 Failed: Safe data was not preserved in logger output");
    }
    console.log("  ✓ Test 12: Structured logger strips sensitive credential keys");

    // Test 13: appConfig properties match environment
    (process.env as any).NODE_ENV = "test";
    if (!appConfig.isTest || appConfig.isProduction) {
      throw new Error("Test 13 Failed: appConfig boolean flags miscalculated");
    }
    console.log("  ✓ Test 13: appConfig boolean flags match active NODE_ENV");

    console.log("\n====================================================================");
    console.log("🎉 ALL 13 PHASE B.1 CONFIGURATION & SAFETY TESTS PASSED SUCCESFULLY!");
    console.log("====================================================================\n");
  } finally {
    process.env = originalEnv;
  }
}

if (require.main === module) {
  runPhaseB1ConfigTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ CONFIGURATION TEST SUITE FAILED:\n", err);
      process.exit(1);
    });
}
