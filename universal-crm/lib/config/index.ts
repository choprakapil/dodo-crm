/**
 * Centralized Application Configuration & Environment Hardening
 *
 * PHASE B.1: Environment & Configuration Hardening
 *
 * Rules:
 * - Server-only execution (strictly prevents client bundle inclusion)
 * - Safe defaults for development/test
 * - Fail-closed enforcement for production
 * - Zero secret logging
 * - Positive test database identification (no unverified heuristic guessing)
 */

if (typeof (globalThis as any).window !== "undefined") {
  throw new Error("CRITICAL SECURITY ERROR: lib/config cannot be imported in client-side code.");
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Returns the validated base application URL.
 *
 * Rules:
 * - In production: APP_URL is strictly required and authoritative (e.g. https://crm.yourdomain.com).
 *   NEXT_PUBLIC_APP_URL must NOT be used as a production fallback for canonical server URL generation.
 *   Throws ConfigurationError if APP_URL is missing or points to localhost/127.0.0.1.
 * - In development/test: Falls back to NEXT_PUBLIC_APP_URL, or defaults safely to "http://localhost:3000".
 */
export function getAppUrl(): string {
  if (process.env.NODE_ENV === "production") {
    const appUrl = process.env.APP_URL;
    if (!appUrl || !appUrl.trim()) {
      throw new ConfigurationError(
        "Missing required production configuration: APP_URL must be set to the public application domain (e.g. https://crm.yourdomain.com). NEXT_PUBLIC_APP_URL cannot be used as a production fallback."
      );
    }
    const clean = appUrl.trim().replace(/\/+$/, "");
    if (clean.includes("localhost") || clean.includes("127.0.0.1")) {
      throw new ConfigurationError(
        `Insecure production configuration: APP_URL cannot point to localhost ('${clean}'). Must be a valid public HTTPS origin.`
      );
    }
    return clean;
  }

  // Development / Test fallback
  const rawUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  return (rawUrl ? rawUrl.trim().replace(/\/+$/, "") : "") || "http://localhost:3000";
}

/**
 * Positively identifies and validates the test database connection string.
 *
 * Requirements:
 * 1. NODE_ENV=production must always abort tests.
 * 2. Tests must positively identify the intended test database via TEST_DATABASE_URL.
 * 3. If TEST_DATABASE_URL is missing, tests fail closed.
 * 4. Never exposes credentials in error messages.
 */
export function getTestDatabaseUrl(): string {
  if (process.env.NODE_ENV === "production") {
    throw new ConfigurationError(
      "Test execution prohibited: NODE_ENV is set to 'production'. Test suite cannot run in production mode."
    );
  }

  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl || !testDbUrl.trim()) {
    throw new ConfigurationError(
      "Missing required test database configuration: TEST_DATABASE_URL must be explicitly configured to run tests. Test runner refuses to implicitly connect to DATABASE_URL."
    );
  }

  return testDbUrl.trim();
}

/**
 * Validates that DATABASE_URL is defined.
 */
export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.trim()) {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigurationError(
        "Missing required production configuration: DATABASE_URL must be defined."
      );
    }
    return "postgresql://postgres:password@localhost:5432/universal_crm_dev";
  }
  return dbUrl.trim();
}

/**
 * Typed configuration accessor.
 */
export const appConfig = {
  get env(): "production" | "development" | "test" {
    return (process.env.NODE_ENV ?? "development") as "production" | "development" | "test";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get isDevelopment(): boolean {
    return process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  },
  get isTest(): boolean {
    return process.env.NODE_ENV === "test";
  },
  getAppUrl,
  getDatabaseUrl,
  getTestDatabaseUrl,
  logLevel: () => (process.env.LOG_LEVEL ?? "info").toLowerCase(),
  sessionMaxAgeSeconds: () => {
    const raw = process.env.SESSION_MAX_AGE_SECONDS;
    if (!raw) return 86400; // 24 hours
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed <= 0 ? 86400 : parsed;
  },
  slowRequestThresholdMs: () => {
    const raw = process.env.SLOW_REQUEST_MS;
    if (!raw) return 1000;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) || parsed <= 0 ? 1000 : parsed;
  },
  enableRequestLogging: () => {
    if (process.env.ENABLE_REQUEST_LOGGING !== undefined) {
      return process.env.ENABLE_REQUEST_LOGGING === "true" || process.env.ENABLE_REQUEST_LOGGING === "1";
    }
    return true;
  },
};
