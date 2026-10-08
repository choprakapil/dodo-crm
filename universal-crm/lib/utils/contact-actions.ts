/**
 * One-Click Contact Actions Utility
 *
 * Provides safe, validated formatting for commercial communication channels:
 * - Phone calling: tel:+...
 * - WhatsApp messaging: https://wa.me/...
 * - Email client: mailto:...
 *
 * Security:
 * - Prevents javascript: or unsafe protocol injection
 * - Validates E.164 and clean digit strings
 * - Strictly encodes email parameters
 */

/**
 * Returns safe tel: link or null if phone is invalid/empty
 */
export function getTelUrl(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Extract valid telephone characters: digits and leading +
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length < 5) return null;

  const cleanNumber = hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
  return `tel:${cleanNumber}`;
}

/**
 * Returns safe https://wa.me/<digits> link or null if phone is invalid/empty
 */
export function getWhatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== "string") return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // wa.me expects country code + number with digits only (no +, no spaces, no dashes)
  const digitsOnly = trimmed.replace(/\D/g, "");

  // International phone numbers typically range from 7 to 15 digits
  if (digitsOnly.length < 7 || digitsOnly.length > 15) return null;

  return `https://wa.me/${digitsOnly}`;
}

/**
 * Returns safe mailto: link or null if email is invalid/empty
 */
export function getMailtoUrl(email: string | null | undefined, subject?: string): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim();
  if (!trimmed) return null;

  // Basic RFC 5322 validation check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;

  const encodedEmail = encodeURIComponent(trimmed);
  if (subject && subject.trim()) {
    return `mailto:${encodedEmail}?subject=${encodeURIComponent(subject.trim())}`;
  }

  return `mailto:${encodedEmail}`;
}
