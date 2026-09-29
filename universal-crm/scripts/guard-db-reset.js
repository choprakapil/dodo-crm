/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Database Reset Safety Guard
 *
 * Strict pre-execution safety gate for destructive database operations.
 * Fails closed in production environments and on non-local/production database targets.
 */

const { URL } = require("url");

function guardDatabaseReset() {
  const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();
  const rawDbUrl = process.env.DATABASE_URL;

  // 1. Strict Production Environment Gate: ALWAYS fails closed
  if (nodeEnv === "production") {
    console.error("❌ FATAL: Destructive database reset is PERMANENTLY FORBIDDEN in NODE_ENV=production.");
    console.error("   ALLOW_DESTRUCTIVE_RESET cannot override production environment safety.");
    process.exit(1);
  }

  // 2. Validate DATABASE_URL existence
  if (!rawDbUrl) {
    console.error("❌ FATAL: DATABASE_URL is not set. Cannot verify database target identity.");
    process.exit(1);
  }

  // 3. Parse and inspect database connection target
  let parsedUrl;
  try {
    parsedUrl = new URL(rawDbUrl);
  } catch {
    console.error("❌ FATAL: Invalid DATABASE_URL format. Fails closed.");
    process.exit(1);
  }

  const hostname = (parsedUrl.hostname || "").toLowerCase();
  const dbName = (parsedUrl.pathname || "").replace(/^\//, "").toLowerCase();

  // 4. Remote / Cloud / Production host detection
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  const remoteProdIndicators = [
    "aws", "rds", "neon", "supabase", "elephantsql", "heroku",
    "render", "railway", "fly.dev", "cloud", "prod", "production"
  ];

  const hasProdIndicator = remoteProdIndicators.some((indicator) =>
    hostname.includes(indicator) || dbName.includes(indicator)
  );

  if (!isLocalHost || hasProdIndicator) {
    console.error(`❌ FATAL: Destructive database reset is FORBIDDEN on remote or production-like host '${hostname}/${dbName}'.`);
    console.error("   Destructive resets are strictly constrained to verified local development or test databases.");
    process.exit(1);
  }

  // 5. Check if target is a recognized test database
  const isTestDb =
    nodeEnv === "test" ||
    dbName.endsWith("_test") ||
    dbName.includes("test");

  if (isTestDb) {
    console.log(`ℹ️ Test database identified: '${dbName}' on '${hostname}'. Reset authorized for test execution.`);
    process.exit(0);
  }

  // 6. Development database requires explicit environment variable authorization
  const allowDestructive = process.env.ALLOW_DESTRUCTIVE_RESET === "true";

  if (!allowDestructive) {
    console.error(`❌ BLOCKED: Destructive database reset on local database '${dbName}' requires explicit authorization.`);
    console.error("   To reset your local development database, run:");
    console.error("   ALLOW_DESTRUCTIVE_RESET=true npm run db:reset");
    process.exit(1);
  }

  console.log(`⚠️ Local development database reset authorized via ALLOW_DESTRUCTIVE_RESET=true on '${dbName}'.`);
  process.exit(0);
}

guardDatabaseReset();
