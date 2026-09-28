/**
 * ID and Token Generation Utilities
 *
 * Uses Node.js crypto (built-in, no external dependency) for token generation.
 * Tokens are stored as SHA-256 hashes in the database; raw tokens sent to clients.
 *
 * Security rules:
 * - Never store raw tokens in the database
 * - Always hash tokens before DB storage
 * - Use crypto.randomBytes for cryptographically secure random values
 */

import crypto from "crypto";

/**
 * Generate a cryptographically secure random token.
 * Returns a URL-safe base64 string.
 * Default length: 32 bytes = 43 characters URL-safe base64.
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("base64url");
}

/**
 * Hash a token for secure database storage.
 * Uses SHA-256 — fast and appropriate for tokens with sufficient entropy.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a slug from a company name.
 * Lowercase, alphanumeric + hyphens only.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

/**
 * Generate a unique slug by appending a random suffix.
 * Use when the base slug is already taken.
 */
export function generateUniqueSlug(name: string): string {
  const base = generateSlug(name);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

/**
 * Generate a request ID for tracing.
 * Format: req_<timestamp_hex><random_hex>
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(16);
  const random = crypto.randomBytes(6).toString("hex");
  return `req_${timestamp}${random}`;
}

/**
 * Generate a CUID-style ID using crypto for collision resistance.
 * Format: c<timestamp><fingerprint><random>
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString("base36" as BufferEncoding);
  return `c${timestamp}${random}`;
}
