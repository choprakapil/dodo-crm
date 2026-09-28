/**
 * Data Redaction & Sanitization Engine
 *
 * Phase B.5 Observability Foundation
 *
 * Guarantees:
 * - Defense-in-depth: Sensitive keys are stripped or masked from log metadata
 * - Zero secret leakage: Passwords, tokens, cookies, auth headers, and connection strings are sanitized
 * - Cycle-safe: Handles circular object structures gracefully
 * - Non-mutating: Operates on a safe clone; never mutates application objects
 */

const SENSITIVE_KEY_PATTERNS = [
  "password",
  "hashedpassword",
  "token",
  "tokenhash",
  "secret",
  "apikey",
  "cookie",
  "authorization",
  "session",
  "sessiontoken",
  "resettoken",
  "invitationtoken",
  "accesstoken",
  "refreshtoken",
  "privatekey",
  "databaseurl",
  "creditcard",
  "cvv",
];

const DB_URL_REGEX = /(postgres(?:ql)?:\/\/[^:\s\/]+:)([^@\s]+)(@[^\s]+)/gi;
const BEARER_AUTH_REGEX = /Bearer\s+[a-zA-Z0-9_\-.~+/]+=*/gi;

/**
 * Checks if a key name matches any known sensitive pattern.
 */
export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Redacts secrets from string values (e.g., database URLs, Bearer tokens).
 */
export function sanitizeString(val: string): string {
  if (!val || typeof val !== "string") return val;

  // Mask database credentials in URLs: postgresql://user:pass@host/db -> postgresql://user:***@host/db
  let result = val;
  if (DB_URL_REGEX.test(result)) {
    result = result.replace(DB_URL_REGEX, "$1***$3");
  }

  // Mask Authorization headers with Bearer tokens: Bearer abc123xyz -> Bearer [REDACTED]
  if (BEARER_AUTH_REGEX.test(result)) {
    result = result.replace(BEARER_AUTH_REGEX, "Bearer [REDACTED]");
  }

  return result;
}

export const redactSensitiveString = sanitizeString;

/**
 * Recursively sanitizes any arbitrary value, object, array, or error.
 * Strips sensitive credential keys entirely (preventing secret leakage) and masks strings.
 */
export function sanitizeLogValue(val: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") {
    return sanitizeString(val);
  }

  if (typeof val !== "object") {
    return val;
  }

  if (depth > 6) {
    return "[MAX_DEPTH_EXCEEDED]";
  }

  if (seen.has(val as object)) {
    return "[CIRCULAR_REFERENCE]";
  }

  seen.add(val as object);

  if (val instanceof Error) {
    return {
      name: val.name,
      message: sanitizeString(val.message),
      code: (val as any).code,
      stack: process.env.NODE_ENV !== "production" ? sanitizeString(val.stack || "") : undefined,
    };
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeLogValue(item, depth + 1, seen));
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
    // If the key is sensitive (e.g. password, token, secret, apiKey, cookie, authorization),
    // strip it entirely so the secret never enters logs
    if (isSensitiveKey(key)) {
      continue;
    }
    result[key] = sanitizeLogValue(value, depth + 1, seen);
  }

  return result;
}

/**
 * Public helper to sanitize context objects for structured logging.
 */
export function sanitizeLogContext<T extends Record<string, unknown>>(context: T): T {
  return sanitizeLogValue(context) as T;
}
