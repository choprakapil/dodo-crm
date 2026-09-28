/**
 * Unit Tests for Slice 2 Authentication & Tenant Foundation
 */

import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validatePasswordStrength } from "../lib/auth/password";
import { generateSecureToken, hashToken } from "../lib/utils/tokens";
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../lib/auth/validation";

async function runUnitTests() {
  console.log("\n🧪 Running Unit Tests: Auth, Tokens & Validation...");

  // 1. Password Hashing & Verification
  console.log("  → Testing password hashing & verification...");
  const rawPassword = "TestPassword@123!";
  const hash = await hashPassword(rawPassword);
  assert.ok(hash.startsWith("$2"), "Hash should be a bcrypt format string");
  assert.notEqual(hash, rawPassword, "Hash must not equal raw password");

  const isMatch = await verifyPassword(rawPassword, hash);
  assert.equal(isMatch, true, "Valid password should verify successfully");

  const isWrongMatch = await verifyPassword("WrongPassword@999!", hash);
  assert.equal(isWrongMatch, false, "Wrong password should fail verification");

  // 2. Password Strength Validation
  console.log("  → Testing password strength rules...");
  const strong = validatePasswordStrength("StrongP@ss1");
  assert.equal(strong.valid, true, "Strong password should be valid");
  assert.equal(strong.errors.length, 0);

  const tooShort = validatePasswordStrength("Sh0rt!");
  assert.equal(tooShort.valid, false, "Short password should fail");
  assert.ok(tooShort.errors.some((e) => e.includes("at least 8 characters")));

  const noUpper = validatePasswordStrength("lowercase1@pass");
  assert.equal(noUpper.valid, false, "No uppercase should fail");
  assert.ok(noUpper.errors.some((e) => e.includes("uppercase")));

  const noSpecial = validatePasswordStrength("NoSpecialPass123");
  assert.equal(noSpecial.valid, false, "No special char should fail");
  assert.ok(noSpecial.errors.some((e) => e.includes("special character")));

  // 3. Token Generation & Hashing
  console.log("  → Testing secure token generation and hashing...");
  const token1 = generateSecureToken(32);
  const token2 = generateSecureToken(32);
  assert.notEqual(token1, token2, "Tokens must be unique");
  assert.ok(token1.length >= 40, "32-byte base64url token should be at least 43 chars");

  const hash1 = hashToken(token1);
  const hash1Repeat = hashToken(token1);
  const hash2 = hashToken(token2);
  assert.equal(hash1, hash1Repeat, "SHA-256 hash must be deterministic");
  assert.notEqual(hash1, hash2, "Different tokens must produce different hashes");
  assert.equal(hash1.length, 64, "SHA-256 hex string must be 64 characters long");

  // 4. Input Validation Schemas
  console.log("  → Testing Zod validation schemas...");
  const validLogin = loginSchema.safeParse({
    email: "  USER@Example.COM  ",
    password: "secretpassword",
  });
  assert.equal(validLogin.success, true);
  if (validLogin.success) {
    assert.equal(validLogin.data.email, "user@example.com", "Email must be normalized to lowercase and trimmed");
  }

  const invalidLoginEmail = loginSchema.safeParse({
    email: "not-an-email",
    password: "password123",
  });
  assert.equal(invalidLoginEmail.success, false, "Invalid email format must fail validation");

  const validForgot = forgotPasswordSchema.safeParse({
    email: "  ADMIN@AcmeCorp.COM  ",
  });
  assert.equal(validForgot.success, true);
  if (validForgot.success) {
    assert.equal(validForgot.data.email, "admin@acmecorp.com");
  }

  const validReset = resetPasswordSchema.safeParse({
    token: "valid-token-string",
    password: "NewP@ssword123",
  });
  assert.equal(validReset.success, true);

  const invalidReset = resetPasswordSchema.safeParse({
    token: "valid-token-string",
    password: "weak",
  });
  assert.equal(invalidReset.success, false, "Weak password in reset must fail");

  console.log("✅ Unit tests passed successfully!\n");
}

export { runUnitTests };

if (require.main === module) {
  runUnitTests().catch((err) => {
    console.error("❌ Unit tests failed:", err);
    process.exit(1);
  });
}
