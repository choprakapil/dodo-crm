import { withObservability } from "@/lib/observability";
/**
 * Liveness Health Check Route
 * GET /health
 *
 * Answers: "Is the application process alive and responding to HTTP requests?"
 *
 * Rules:
 * - Independent of external services (PostgreSQL, Redis, Storage, Email)
 * - Machine-readable with correlation Request ID
 * - No authentication required (public health check for load balancers / orchestrators)
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveRequestId } from "@/lib/observability/context";

export const GET = withObservability(async function GET(req?: NextRequest) {
  const reqId = resolveRequestId(req?.headers.get("x-request-id"));

  const response = NextResponse.json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      requestId: reqId,
      service: "universal-crm",
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: 200 }
  );

  response.headers.set("X-Request-ID", reqId);
  return response;
});
