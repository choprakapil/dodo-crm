/**
 * Timezone Utilities
 *
 * ADR-013: All timestamps stored as UTC. Display in company timezone.
 * PRD §76: DST handled by proper timezone libraries.
 * PRD §51: Date-based report boundaries use company-local calendar.
 *
 * Uses date-fns-tz for timezone-aware operations.
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";

export const DEFAULT_TIMEZONE = "UTC";

/**
 * Format a UTC date for display in a given timezone.
 */
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  formatStr = "MMM d, yyyy h:mm a"
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatInTimeZone(d, timezone, formatStr);
}

/**
 * Format a UTC date as a date-only string in a given timezone.
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string
): string {
  return formatInTimezone(date, timezone, "MMM d, yyyy");
}

/**
 * Format a UTC date as a relative time string (e.g. "2 hours ago").
 * Simple implementation without external library.
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return format(d, "MMM d, yyyy");
}

/**
 * Get the start of a day in a given timezone, returned as UTC.
 * Used for report date-range filtering.
 */
export function startOfDayInTimezone(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const startOfDayZoned = startOfDay(zonedDate);
  return fromZonedTime(startOfDayZoned, timezone);
}

/**
 * Get the end of a day in a given timezone, returned as UTC.
 * Used for report date-range filtering.
 */
export function endOfDayInTimezone(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const endOfDayZoned = endOfDay(zonedDate);
  return fromZonedTime(endOfDayZoned, timezone);
}

/**
 * Get date range for "today" in a given timezone, returned as UTC bounds.
 */
export function getTodayRangeInTimezone(timezone: string): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  return {
    start: startOfDayInTimezone(now, timezone),
    end: endOfDayInTimezone(now, timezone),
  };
}

/**
 * Check if a date is overdue (past now) in UTC.
 * The due date is stored in UTC; comparison is straightforward.
 */
export function isOverdue(dueAt: Date): boolean {
  return dueAt < new Date();
}

/**
 * Validate a timezone string. Returns true if valid IANA timezone.
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
