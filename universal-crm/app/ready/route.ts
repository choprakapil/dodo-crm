import { withObservability } from "@/lib/observability";
/**
 * Readiness Probe Route
 * GET /ready
 *
 * Answers: "Can this application instance serve production traffic?"
 *
 * Rules:
 * - Verifies critical runtime dependencies: PostgreSQL Database connectivity
 * - Non-critical/optional dependencies (e.g. email provider) do not fail readiness
 * - Never exposes credentials, SQL errors, or connection strings in responses
 * - Includes Request ID correlation
 * - Returns 200 (ready) or 503 (not_ready)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestId } from "@/lib/observability/context";
import { logger } from "@/lib/logger";

export const GET = withObservability(async function GET(req?: NextRequest) {
  const reqId = resolveRequestId(req?.headers.get("x-request-id"));
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number }> = {};

  // 1. Critical Dependency: PostgreSQL Database Connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: "ok",
      latencyMs: Date.now() - dbStart,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - dbStart;
    checks.database = {
      status: "error",
      latencyMs,
    };
    logger.error("Database readiness probe failed: PostgreSQL connection unserviceable", {
      requestId: reqId,
      latencyMs,
      errorName: err?.name,
      errorMessage: err?.message,
    });
  }

  const isReady = checks.database.status === "ok";

  const response = NextResponse.json(
    {
      status: isReady ? "ok" : "not_ready",
      timestamp: new Date().toISOString(),
      requestId: reqId,
      checks,
    },
    { status: isReady ? 200 : 503 }
  );

  response.headers.set("X-Request-ID", reqId);
  return response;
});
