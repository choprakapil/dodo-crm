/**
 * Production-Grade Structured Logger
 *
 * Phase B.5 Observability Foundation
 *
 * Rules (PRD §77, ADR per AGENTS.md):
 * - Every log entry in request scope automatically correlates: requestId, userId, companyId, route, method
 * - NEVER log: passwords, tokens, secrets, private credentials, session cookies, database credentials
 * - Multi-tenant aware: Automatically binds tenant context without leaking cross-tenant data
 * - Super Admin aware: Tags platform-wide operations cleanly
 * - Log level controlled by LOG_LEVEL environment variable (default: info)
 * - Outputs structured single-line JSON in production for log ingestion systems
 */

import { getRequestContext } from "@/lib/observability/context";
import { sanitizeLogContext } from "@/lib/observability/redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getCurrentLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getCurrentLevel()];
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  companyId?: string;
  route?: string;
  method?: string;
  status?: number;
  statusCode?: number;
  durationMs?: number;
  errorCode?: string;
  errorName?: string;
  errorMessage?: string;
  isSuperAdmin?: boolean;
  [key: string]: unknown;
}

/**
 * Emits a structured log entry to stdout or stderr.
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  // Retrieve active AsyncLocalStorage request execution context if available
  const reqContext = getRequestContext();

  // Combine ambient request context with explicitly provided log context
  const mergedContext: Record<string, unknown> = {
    ...(reqContext
      ? {
          requestId: reqContext.requestId,
          route: reqContext.pathname,
          method: reqContext.method,
          ...(reqContext.companyId ? { companyId: reqContext.companyId } : {}),
          ...(reqContext.userId ? { userId: reqContext.userId } : {}),
          ...(reqContext.isSuperAdmin ? { isSuperAdmin: true } : {}),
        }
      : {}),
    ...(context ?? {}),
  };

  const sanitized = sanitizeLogContext(mergedContext);

  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...sanitized,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log("debug", message, context),
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};
