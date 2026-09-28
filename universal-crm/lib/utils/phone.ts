/**
 * Universal Phone Normalization Utility (E.164 Standard)
 * 
 * Supports dynamic tenant-configured default countries (e.g., Company.defaultCountryCode).
 * Never assumes a single hard-coded country.
 * 
 * Rules:
 * 1. Explicit international prefix (starts with '+' or '00'):
 *    Respects the explicit country code without overriding it.
 * 2. Numbers without international prefix:
 *    Applies tenant's configured default country (ISO code e.g. "US", "IN", "GB" or dial code "+1", "+91").
 * 3. Canonical storage:
 *    E.164 (+<country_code><national_number>)
 */

export interface PhoneNormalizationResult {
  isValid: boolean;
  raw: string;
  normalized?: string;
  countryCode?: string;
  nationalNumber?: string;
  error?: string;
}

export const ISO_TO_CALLING_CODE: Record<string, string> = {
  IN: "91",
  US: "1",
  CA: "1",
  GB: "44",
  UK: "44",
  AU: "61",
  DE: "49",
  FR: "33",
  SG: "65",
  AE: "971",
  JP: "81",
  CN: "86",
  BR: "55",
  ZA: "27",
  NZ: "64",
  MX: "52",
  ES: "34",
  IT: "39",
  NL: "31",
  SE: "46",
  CH: "41",
  IE: "353",
};

export class PhoneNormalizer {
  /**
   * Resolves a country code or dial code into a clean numeric string without '+'.
   */
  static resolveDialCode(countryOrDialCode: string): string {
    if (!countryOrDialCode) return "91";
    const upper = countryOrDialCode.trim().toUpperCase();
    if (ISO_TO_CALLING_CODE[upper]) {
      return ISO_TO_CALLING_CODE[upper];
    }
    const digits = upper.replace(/\D/g, "");
    return digits || "91";
  }

  /**
   * Normalizes a raw phone string into canonical E.164 format.
   * @param rawPhone The input string from user / API / import
   * @param tenantCountry Default tenant country (ISO alpha-2 code e.g. "US", "IN", "GB" or dial code "+1", "+91")
   */
  static normalize(rawPhone: string, tenantCountry = "IN"): PhoneNormalizationResult {
    if (!rawPhone || typeof rawPhone !== "string") {
      return {
        isValid: false,
        raw: String(rawPhone || ""),
        error: "Phone number cannot be empty",
      };
    }

    const trimmed = rawPhone.trim();
    if (!trimmed) {
      return {
        isValid: false,
        raw: trimmed,
        error: "Phone number cannot be empty",
      };
    }

    // Convert international prefix "00" to "+"
    let working = trimmed;
    if (working.startsWith("00")) {
      working = "+" + working.slice(2).trim();
    }

    const hasExplicitPlus = working.startsWith("+");
    const digitsOnly = working.replace(/\D/g, "");

    // E.164 total digits: 7 to 15
    if (digitsOnly.length < 7) {
      return {
        isValid: false,
        raw: trimmed,
        error: "Phone number is too short (minimum 7 digits required)",
      };
    }

    if (digitsOnly.length > 15) {
      return {
        isValid: false,
        raw: trimmed,
        error: "Phone number is too long (maximum 15 digits per E.164)",
      };
    }

    let normalized: string;

    if (hasExplicitPlus) {
      // Respect explicit international prefix provided by caller
      normalized = `+${digitsOnly}`;
    } else {
      // National or un-prefixed number: apply tenant default country
      const tenantDialCode = PhoneNormalizer.resolveDialCode(tenantCountry);

      let national = digitsOnly;
      // Strip leading trunk '0' if present (e.g. 09876543210 -> 9876543210, 07911123456 -> 7911123456)
      if (national.startsWith("0") && national.length > 7) {
        national = national.slice(1);
      }

      // If user already included tenant's calling code without '+':
      if (national.startsWith(tenantDialCode) && national.length > tenantDialCode.length + 6) {
        normalized = `+${national}`;
      } else {
        normalized = `+${tenantDialCode}${national}`;
      }
    }

    // Final E.164 length check
    const finalDigits = normalized.replace(/\D/g, "");
    if (finalDigits.length < 7 || finalDigits.length > 15) {
      return {
        isValid: false,
        raw: trimmed,
        error: "Invalid E.164 length after normalization",
      };
    }

    return {
      isValid: true,
      raw: trimmed,
      normalized,
    };
  }

  /**
   * Quick boolean validator
   */
  static isValid(rawPhone: string, tenantCountry = "IN"): boolean {
    return PhoneNormalizer.normalize(rawPhone, tenantCountry).isValid;
  }
}
