/**
 * Storage Unit Formatting and Utilization Utilities
 *
 * Provides standardized binary (1024-based) byte conversion,
 * human-readable string formatting, and safe utilization percentage calculations.
 */

export const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
export type ByteUnit = (typeof BYTE_UNITS)[number];

export interface FormattedBytes {
  value: number;
  unit: ByteUnit;
  formatted: string;
}

/**
 * Formats a raw byte number into a clean human-readable string (e.g., "1.84 GB", "420 KB", "0 B").
 *
 * @param bytes - Non-negative number of bytes
 * @param decimals - Decimal places for display (default: 2, but trailing zeros omitted where appropriate)
 */
export function formatBytes(bytes: number | null | undefined, decimals = 2): string {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
    return "0 B";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const k = 1024;
  const dm = Math.max(0, decimals);
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const clampedIndex = Math.min(i, BYTE_UNITS.length - 1);

  const rawValue = bytes / Math.pow(k, clampedIndex);
  // Strip trailing zeros after fixed precision for cleaner UI (e.g. 10 GB instead of 10.00 GB)
  const formattedNumber = parseFloat(rawValue.toFixed(dm)).toString();

  return `${formattedNumber} ${BYTE_UNITS[clampedIndex]}`;
}

/**
 * Deconstructs bytes into raw value and unit.
 */
export function parseBytesToUnit(bytes: number | null | undefined, decimals = 2): FormattedBytes {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes <= 0) {
    return { value: 0, unit: "B", formatted: "0 B" };
  }

  const k = 1024;
  const dm = Math.max(0, decimals);
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), BYTE_UNITS.length - 1);
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

  return {
    value: val,
    unit: BYTE_UNITS[i],
    formatted: `${val} ${BYTE_UNITS[i]}`,
  };
}

/**
 * Calculates usage percentage with safety against division by zero, NaN, and negative numbers.
 *
 * @param usedBytes - Actual measured storage in bytes
 * @param limitBytes - Configured storage limit in bytes (null/0 means unconfigured/unmetered)
 * @returns number (e.g. 18.4) or null if limit is not configured
 */
export function calculateUsagePercentage(
  usedBytes: number | null | undefined,
  limitBytes: number | null | undefined
): number | null {
  if (limitBytes === null || limitBytes === undefined || isNaN(limitBytes) || limitBytes <= 0) {
    return null; // Limit not configured or unlimited
  }

  const used = Math.max(0, usedBytes ?? 0);
  const rawPercentage = (used / limitBytes) * 100;

  // Round to 1 decimal place (e.g. 18.4%)
  return Math.round(rawPercentage * 10) / 10;
}

/**
 * Evaluates storage quota status.
 */
export function evaluateStorageStatus(
  usedBytes: number,
  limitBytes: number | null | undefined
): "HEALTHY" | "NEAR_LIMIT" | "CRITICAL_90" | "OVER_LIMIT" | "LIMIT_NOT_CONFIGURED" {
  if (limitBytes === null || limitBytes === undefined || limitBytes <= 0) {
    return "LIMIT_NOT_CONFIGURED";
  }

  if (usedBytes >= limitBytes) {
    return "OVER_LIMIT";
  }

  const percentage = (usedBytes / limitBytes) * 100;
  if (percentage >= 90) {
    return "CRITICAL_90";
  }
  if (percentage >= 80) {
    return "NEAR_LIMIT";
  }

  return "HEALTHY";
}
