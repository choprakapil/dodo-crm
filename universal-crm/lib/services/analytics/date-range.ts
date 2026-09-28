import { AnalyticsPreset } from "@/lib/validations/analytics";
import { ResolvedDateRange } from "./types";

/**
 * Calculates zero-safe percentage change between current and previous periods.
 */
export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  const diff = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(diff * 10) / 10;
}

/**
 * Resolves current and previous date bounds for the given preset or custom dates.
 */
export function resolveDateRange(params: {
  preset: AnalyticsPreset;
  from?: string;
  to?: string;
  timezone?: string;
  referenceNow?: Date;
}): ResolvedDateRange {
  const now = params.referenceNow ? new Date(params.referenceNow) : new Date();
  const tz = params.timezone || "UTC";

  let start: Date;
  let end: Date;

  switch (params.preset) {
    case "TODAY": {
      start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      break;
    }

    case "YESTERDAY": {
      start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 1);
      start.setUTCHours(0, 0, 0, 0);
      end = new Date(start);
      end.setUTCHours(23, 59, 59, 999);
      break;
    }

    case "LAST_7_DAYS": {
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      start.setUTCHours(0, 0, 0, 0);
      break;
    }

    case "LAST_30_DAYS": {
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 29);
      start.setUTCHours(0, 0, 0, 0);
      break;
    }

    case "THIS_MONTH": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      break;
    }

    case "LAST_MONTH": {
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      break;
    }

    case "THIS_QUARTER": {
      const currentQuarter = Math.floor(now.getUTCMonth() / 3);
      start = new Date(Date.UTC(now.getUTCFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0));
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      break;
    }

    case "THIS_YEAR": {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
      end = new Date(now);
      end.setUTCHours(23, 59, 59, 999);
      break;
    }

    case "CUSTOM": {
      if (!params.from || !params.to) {
        // Fallback to last 30 days if custom dates are missing
        end = new Date(now);
        end.setUTCHours(23, 59, 59, 999);
        start = new Date(end);
        start.setUTCDate(start.getUTCDate() - 29);
        start.setUTCHours(0, 0, 0, 0);
      } else {
        start = new Date(params.from);
        if (params.from.length === 10) {
          start.setUTCHours(0, 0, 0, 0);
        }
        end = new Date(params.to);
        if (params.to.length === 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
      }
      break;
    }

    default: {
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
      start = new Date(end);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    }
  }

  // Calculate matching previous period immediately preceding the current period
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  return {
    current: { start, end },
    previous: { start: prevStart, end: prevEnd },
    preset: params.preset,
    timezone: tz,
  };
}
