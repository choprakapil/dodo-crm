/**
 * Universal CRM Observability System
 *
 * Phase B.5 Observability Foundation
 *
 * Central export of:
 * - Ambient Request Execution Context & Request ID Correlation
 * - Structured Logger
 * - Deep Recursive Data Redaction & Sanitization
 * - HTTP Request & Performance Observation
 */

export * from "./context";
export * from "./redaction";
export * from "./client";
export { logger, type LogLevel, type LogContext } from "@/lib/logger";

import { logger, LogContext } from "@/lib/logger";
import { appConfig } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import {
  runWithRequestContext,
  resolveRequestId,
  getCompanyId,
  getUserId,
  getRequestContext,
} from "./context";
import { handleApiError } from "@/lib/errors";

/**
 * Records performance and completion diagnostics for an HTTP API request.
 * Warns if duration exceeds the configured SLOW_REQUEST_MS threshold.
 */
export function observeApiRequest(params: {
  requestId: string;
  method: string;
  pathname: string;
  statusCode: number;
  durationMs: number;
  companyId?: string;
  userId?: string;
  isSuperAdmin?: boolean;
  errorCode?: string;
}): void {
  const thresholdMs = appConfig.slowRequestThresholdMs();
  const isSlow = params.durationMs >= thresholdMs;
  const isError = params.statusCode >= 500;

  const logPayload: LogContext = {
    requestId: params.requestId,
    method: params.method,
    route: params.pathname,
    statusCode: params.statusCode,
    durationMs: params.durationMs,
    ...(params.companyId ? { companyId: params.companyId } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.isSuperAdmin ? { isSuperAdmin: true } : {}),
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
  };

  if (isError) {
    logger.error(`API ${params.method} ${params.pathname} returned ${params.statusCode} (${params.durationMs}ms)`, logPayload);
  } else if (isSlow) {
    logger.warn(`[SLOW_REQUEST] API ${params.method} ${params.pathname} took ${params.durationMs}ms (threshold: ${thresholdMs}ms)`, {
      ...logPayload,
      thresholdMs,
    });
  } else {
    logger.info(`API ${params.method} ${params.pathname} ${params.statusCode} (${params.durationMs}ms)`, logPayload);
  }
}

/**
 * Higher-order API route wrapper that guarantees:
 * 1. An AsyncLocalStorage request execution context is established for the entire route lifecycle.
 * 2. Incoming x-request-id is validated or a new secure ID is generated.
 * 3. Request duration is recorded and evaluated against SLOW_REQUEST_MS.
 * 4. observeApiRequest() is executed for every invocation.
 * 5. Outgoing response headers include X-Request-ID.
 * 6. Any unhandled error is caught, safely logged to server logs with stack trace, and returned as sanitized 500 JSON.
 */
export function withObservability<
  T extends (...args: any[]) => Promise<Response | NextResponse> | Response | NextResponse
>(handler: T): T {
  const wrapped = async (...args: Parameters<T>): Promise<Response | NextResponse> => {
    const req = args[0] as NextRequest | Request | undefined;
    const reqId = resolveRequestId(req?.headers?.get?.("x-request-id"));
    const startTime = Date.now();
    const pathname =
      (req as NextRequest)?.nextUrl?.pathname ??
      (req?.url ? new URL(req.url, "http://localhost").pathname : "/unknown");
    const method = req?.method ?? "UNKNOWN";

    return runWithRequestContext(
      {
        requestId: reqId,
        startTime,
        pathname,
        method,
      },
      async () => {
        try {
          const res = await handler(...args);
          const durationMs = Date.now() - startTime;
          const status = res?.status ?? 200;

          if (res?.headers && !res.headers.has("X-Request-ID")) {
            res.headers.set("X-Request-ID", reqId);
          }

          observeApiRequest({
            requestId: reqId,
            method,
            pathname,
            statusCode: status,
            durationMs,
            companyId: getCompanyId(),
            userId: getUserId(),
            isSuperAdmin: getRequestContext()?.isSuperAdmin,
          });

          return res;
        } catch (error) {
          const res = handleApiError(error, reqId);
          const durationMs = Date.now() - startTime;

          observeApiRequest({
            requestId: reqId,
            method,
            pathname,
            statusCode: res.status,
            durationMs,
            companyId: getCompanyId(),
            userId: getUserId(),
            isSuperAdmin: getRequestContext()?.isSuperAdmin,
            errorCode: (error as any)?.code ?? "INTERNAL_ERROR",
          });

          return res;
        }
      }
    );
  };

  return wrapped as unknown as T;
}
