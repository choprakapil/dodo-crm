/**
 * Unit Tests for Phase 2: Phone Normalization (E.164 Standard)
 * 
 * Verifies:
 * 1. Standard Indian 10-digit number with default IN (+91)
 * 2. Universal tenant configuration: US tenant (+1), GB tenant (+44)
 * 3. Numbers with explicit international prefixes (+1, +91, +44, 00...) are never overridden
 * 4. Cleaning of trunk 0, formatting noise, spaces, hyphens, brackets
 * 5. Rejection of invalid phone inputs
 */

import assert from "node:assert/strict";
import { PhoneNormalizer } from "../lib/utils/phone";

export async function runPhoneNormalizationUnitTests() {
  console.log("\n🧪 Running Phase 2 Unit Tests: Universal Phone Normalization...");

  // 1. Standard 10-digit Indian Mobile with IN tenant
  console.log("  → Testing standard 10-digit local format with IN tenant...");
  const res1 = PhoneNormalizer.normalize("9876543210", "IN");
  assert.equal(res1.isValid, true);
  assert.equal(res1.normalized, "+919876543210");

  // 2. Trunk prefix "0" with 10 digits
  console.log("  → Testing leading 0 trunk prefix with IN tenant...");
  const res2 = PhoneNormalizer.normalize("09876543210", "IN");
  assert.equal(res2.isValid, true);
  assert.equal(res2.normalized, "+919876543210");

  // 3. International format with spaces
  console.log("  → Testing international format with whitespace...");
  const res3 = PhoneNormalizer.normalize("+91 98765 43210", "IN");
  assert.equal(res3.isValid, true);
  assert.equal(res3.normalized, "+919876543210");

  // 4. Dashes and dots
  console.log("  → Testing dashes and formatting noise...");
  const res4 = PhoneNormalizer.normalize("+91-98765-43210", "IN");
  assert.equal(res4.isValid, true);
  assert.equal(res4.normalized, "+919876543210");

  // 5. Universal tenant: US Company (defaultCountryCode = "US")
  console.log("  → Testing US tenant normalizing 10-digit national number to +1...");
  const resUS = PhoneNormalizer.normalize("5550192834", "US");
  assert.equal(resUS.isValid, true);
  assert.equal(resUS.normalized, "+15550192834", "US tenant must normalize national number with +1");

  // 6. Universal tenant: GB Company (defaultCountryCode = "GB")
  console.log("  → Testing GB tenant normalizing national number with leading 0 to +44...");
  const resGB = PhoneNormalizer.normalize("07911123456", "GB");
  assert.equal(resGB.isValid, true);
  assert.equal(resGB.normalized, "+447911123456", "GB tenant must normalize national number with +44");

  // 7. Invariant: Explicit international prefix is NEVER overridden by tenant's default country
  console.log("  → Testing explicit international prefix is preserved across different tenant countries...");
  // US number arriving in an Indian tenant company
  const resUSinIN = PhoneNormalizer.normalize("+1 (555) 019-2834", "IN");
  assert.equal(resUSinIN.isValid, true);
  assert.equal(resUSinIN.normalized, "+15550192834", "US number with +1 must NOT be converted to +91 in IN tenant");

  // Indian number arriving in a US tenant company
  const resINinUS = PhoneNormalizer.normalize("+91 98765 43210", "US");
  assert.equal(resINinUS.isValid, true);
  assert.equal(resINinUS.normalized, "+919876543210", "IN number with +91 must NOT be converted to +1 in US tenant");

  // 8. International 00 access code
  console.log("  → Testing 00 international prefix...");
  const res6 = PhoneNormalizer.normalize("0091 9876543210", "US");
  assert.equal(res6.isValid, true);
  assert.equal(res6.normalized, "+919876543210", "00 prefix must resolve explicit international calling code");

  // 9. Rejection of invalid phone inputs
  console.log("  → Testing invalid phone inputs...");
  const empty = PhoneNormalizer.normalize("");
  assert.equal(empty.isValid, false);

  const letters = PhoneNormalizer.normalize("invalid-phone-number");
  assert.equal(letters.isValid, false);

  const tooShort = PhoneNormalizer.normalize("12345");
  assert.equal(tooShort.isValid, false);
  assert.ok(tooShort.error?.includes("too short"));

  const tooLong = PhoneNormalizer.normalize("+12345678901234567890");
  assert.equal(tooLong.isValid, false);
  assert.ok(tooLong.error?.includes("too long"));

  console.log("  ✅ Universal Phone Normalization Unit Tests Passed!");
}

if (require.main === module) {
  runPhoneNormalizationUnitTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
