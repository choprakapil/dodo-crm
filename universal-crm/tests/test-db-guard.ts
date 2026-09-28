/**
 * Test Database Safety Guard
 *
 * Enforces positive test database identification before any test suite execution.
 * Fails closed immediately if TEST_DATABASE_URL is missing or NODE_ENV=production.
 * Overrides process.env.DATABASE_URL with the positively identified TEST_DATABASE_URL.
 */

import { getTestDatabaseUrl } from "../lib/config";

export function enforceTestDatabaseSafety(): string {
  // If running in a standalone Node runner (e.g. ts-node), load standard Next.js environment files
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(process.cwd());
  } catch {
    // Environment already loaded or @next/env unavailable
  }

  try {
    const testDbUrl = getTestDatabaseUrl();
    process.env.DATABASE_URL = testDbUrl;
    return testDbUrl;
  } catch (err: any) {
    console.error(`\n❌ CRITICAL DATABASE SAFETY ERROR: ${err.message}\n`);
    process.exit(1);
  }
}

// Execute immediately upon module import
enforceTestDatabaseSafety();
