/**
 * Hardened Test Suite for Phase B.5 Observability Foundation
 *
 * Explicitly Verifies all 24 requirements from Phase B.5 Specification:
 * 1.  requestId generated
 * 2.  requestId propagated to response
 * 3.  existing safe requestId behavior if supported
 * 4.  unexpected errors include requestId
 * 5.  client receives generic error
 * 6.  stack trace absent from client
 * 7.  companyId appears in safe server context
 * 8.  userId appears in safe server context
 * 9.  password is redacted
 * 10. token is redacted
 * 11. authorization header is redacted
 * 12. cookie is redacted
 * 13. invitation token is redacted
 * 14. database URL is redacted
 * 15. request body is not blindly logged
 * 16. health endpoint works
 * 17. readiness checks database
 * 18. liveness does not depend on database
 * 19. database failure produces safe readiness failure
 * 20. provider error is safely logged
 * 21. slow request detection works
 * 22. normal request does not produce excessive duplicate logs
 * 23. Super Admin context does not leak tenant context
 * 24. tenant context remains correctly isolated
 */

import fs from "fs";
import path from "path";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import {
  generateRequestId,
  validateRequestId,
  runWithRequestContext,
  getCompanyId,
  getUserId,
  setTraceContext,
} from "../lib/observability/context";
import { sanitizeLogValue, redactSensitiveString } from "../lib/observability/redaction";
import { logger } from "../lib/logger";
import { observeApiRequest, withObservability } from "../lib/observability";
import { handleApiError } from "../lib/errors";
import { GET as healthGet } from "../app/health/route";
import { GET as readyGet } from "../app/ready/route";
import { prisma } from "../lib/db";

export async function runPhaseB5ObservabilityTests() {
  console.log("\n====================================================================");
  console.log("🚀 RUNNING PHASE B.5 OBSERVABILITY FOUNDATION TEST SUITE");
  console.log("====================================================================");

  let passedTests = 0;
  const totalTests = 24;

  // Capture console logs for log verification
  const capturedLogs: Array<{ type: string; message: string; meta?: any }> = [];
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  function captureConsole() {
    capturedLogs.length = 0;
    console.log = (...args: any[]) => {
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      capturedLogs.push({ type: "log", message: msg, meta: args });
      // Keep silent during captured test sections
    };
    console.warn = (...args: any[]) => {
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      capturedLogs.push({ type: "warn", message: msg, meta: args });
    };
    console.error = (...args: any[]) => {
      const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
      capturedLogs.push({ type: "error", message: msg, meta: args });
    };
  }

  function restoreConsole() {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: requestId generated
    // -------------------------------------------------------------------------
    const generatedId = generateRequestId();
    if (!generatedId || typeof generatedId !== "string") {
      throw new Error(`Test 1 Failed: Generated requestId is invalid, got: ${generatedId}`);
    }
    const idPattern = /^req_[a-f0-9]{16,}$/;
    if (!idPattern.test(generatedId)) {
      throw new Error(`Test 1 Failed: Generated requestId did not match pattern ^req_[a-f0-9]{16,}, got: ${generatedId}`);
    }
    console.log("  ✓ Test 1: Cryptographically secure requestId generated successfully");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 2: requestId propagated to response
    // -------------------------------------------------------------------------
    const testReqId2 = generateRequestId();
    const req2 = new NextRequest("http://localhost:3000/health", {
      headers: { "x-request-id": testReqId2 },
    });
    const res2 = await healthGet(req2);
    const headerReqId2 = res2.headers.get("x-request-id");
    if (headerReqId2 !== testReqId2) {
      throw new Error(`Test 2 Failed: Expected X-Request-ID header '${testReqId2}', got: '${headerReqId2}'`);
    }
    const body2 = (await res2.json()) as any;
    if (body2.requestId !== testReqId2) {
      throw new Error(`Test 2 Failed: Expected response body requestId '${testReqId2}', got: '${body2.requestId}'`);
    }
    console.log("  ✓ Test 2: requestId correctly propagated to HTTP response header and body");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 3: existing safe requestId behavior if supported
    // -------------------------------------------------------------------------
    // Safe ID should be preserved
    const safeCustomId = "req_client_abc123-xyz";
    const validSafe = validateRequestId(safeCustomId);
    if (validSafe !== safeCustomId) {
      throw new Error(`Test 3 Failed: Safe requestId was rejected: ${validSafe}`);
    }

    // Malicious/Unsafe IDs must be rejected and return null
    const unsafeChars = "<script>alert(1)</script>";
    if (validateRequestId(unsafeChars) !== null) {
      throw new Error("Test 3 Failed: Unsafe XSS requestId was not rejected!");
    }
    const withSpaces = "req abc 123";
    if (validateRequestId(withSpaces) !== null) {
      throw new Error("Test 3 Failed: Space-containing requestId was not rejected!");
    }
    const tooLong = "a".repeat(150);
    if (validateRequestId(tooLong) !== null) {
      throw new Error("Test 3 Failed: Excessively long requestId was not rejected!");
    }
    console.log("  ✓ Test 3: Existing safe requestId validated; malicious/invalid IDs rejected");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 4: unexpected errors include requestId
    // -------------------------------------------------------------------------
    const testReqId4 = generateRequestId();
    let errResponse4: any;
    runWithRequestContext({ requestId: testReqId4 }, () => {
      errResponse4 = handleApiError(new Error("Unexpected core service failure"));
    });
    const errBody4 = (await errResponse4.json()) as any;
    if (errBody4.error?.requestId !== testReqId4) {
      throw new Error(`Test 4 Failed: Expected error body to include requestId '${testReqId4}', got: '${errBody4.error?.requestId}'`);
    }
    if (errResponse4.headers.get("x-request-id") !== testReqId4) {
      throw new Error(`Test 4 Failed: Expected error response header X-Request-ID '${testReqId4}'`);
    }
    console.log("  ✓ Test 4: Unexpected errors include ambient requestId in body and headers");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 5: client receives generic error
    // -------------------------------------------------------------------------
    const internalSecretMessage = "FATAL: connection to postgres://admin:secretPass@10.0.0.1:5432/prod failed";
    const rawError = new Error(internalSecretMessage);
    const clientSafeResponse = handleApiError(rawError);
    const clientSafeBody = (await clientSafeResponse.json()) as any;
    if (clientSafeBody.error.message.includes("postgres") || clientSafeBody.error.message.includes("secretPass")) {
      throw new Error("Test 5 Failed: Internal database error message was leaked to client!");
    }
    if (clientSafeBody.error.message !== "An unexpected error occurred") {
      throw new Error(`Test 5 Failed: Client did not receive generic error message, got: ${clientSafeBody.error.message}`);
    }
    if (clientSafeBody.error.code !== "INTERNAL_ERROR") {
      throw new Error(`Test 5 Failed: Expected error code 'INTERNAL_ERROR', got: ${clientSafeBody.error.code}`);
    }
    console.log("  ✓ Test 5: Client receives sanitized generic error without internal implementation details");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 6: stack trace absent from client
    // -------------------------------------------------------------------------
    if (clientSafeBody.error.stack || clientSafeBody.stack || clientSafeBody.error.trace) {
      throw new Error("Test 6 Failed: Stack trace leaked in client error response!");
    }
    const rawResponseBodyStr = JSON.stringify(clientSafeBody);
    if (rawResponseBodyStr.includes(".ts") || rawResponseBodyStr.includes("at Object.") || rawResponseBodyStr.includes("/universal-crm/")) {
      throw new Error("Test 6 Failed: Stack trace file paths detected in client response!");
    }
    console.log("  ✓ Test 6: Stack trace and internal file paths strictly absent from client");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 7: companyId appears in safe server context
    // -------------------------------------------------------------------------
    const testCompanyId7 = "comp_test_7777";
    let capturedCompany7: string | undefined;
    runWithRequestContext({ companyId: testCompanyId7 }, () => {
      capturedCompany7 = getCompanyId();
    });
    if (capturedCompany7 !== testCompanyId7) {
      throw new Error(`Test 7 Failed: Expected context companyId '${testCompanyId7}', got: '${capturedCompany7}'`);
    }
    console.log("  ✓ Test 7: companyId correctly bound to ambient server context");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 8: userId appears in safe server context
    // -------------------------------------------------------------------------
    const testUserId8 = "usr_test_8888";
    let capturedUser8: string | undefined;
    runWithRequestContext({ userId: testUserId8 }, () => {
      capturedUser8 = getUserId();
    });
    if (capturedUser8 !== testUserId8) {
      throw new Error(`Test 8 Failed: Expected context userId '${testUserId8}', got: '${capturedUser8}'`);
    }
    console.log("  ✓ Test 8: userId correctly bound to ambient server context");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 9: password is redacted
    // -------------------------------------------------------------------------
    const inputWithPassword = {
      username: "admin_user",
      password: "VerySecretPassword123!",
      nested: { newPassword: "AnotherPassword456!" },
    };
    const sanitizedPassword = sanitizeLogValue(inputWithPassword) as any;
    if (sanitizedPassword.password !== undefined || sanitizedPassword.nested?.newPassword !== undefined) {
      throw new Error("Test 9 Failed: Password keys were not stripped/redacted from log payload!");
    }
    console.log("  ✓ Test 9: Password fields strictly redacted from log structures");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 10: token is redacted
    // -------------------------------------------------------------------------
    const inputWithTokens = {
      action: "auth_verify",
      token: "secret_session_token_abc",
      nested: { accessToken: "tok_access_xyz", refreshToken: "tok_refresh_123" },
    };
    const sanitizedTokens = sanitizeLogValue(inputWithTokens) as any;
    if (sanitizedTokens.token !== undefined || sanitizedTokens.nested?.accessToken !== undefined) {
      throw new Error("Test 10 Failed: Token keys were not stripped/redacted from log payload!");
    }
    console.log("  ✓ Test 10: Token fields strictly redacted from log structures");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 11: authorization header is redacted
    // -------------------------------------------------------------------------
    const inputWithAuth = {
      headers: {
        authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super_secret",
      },
      rawHeader: "Bearer secret_bearer_token_string",
    };
    const sanitizedAuth = sanitizeLogValue(inputWithAuth) as any;
    if (sanitizedAuth.headers?.authorization !== undefined) {
      throw new Error("Test 11 Failed: Authorization header key was not stripped!");
    }
    if (sanitizedAuth.rawHeader.includes("secret_bearer_token_string")) {
      throw new Error("Test 11 Failed: Bearer token in raw string was not masked!");
    }
    console.log("  ✓ Test 11: Authorization header and Bearer tokens strictly redacted");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 12: cookie is redacted
    // -------------------------------------------------------------------------
    const inputWithCookie = {
      headers: {
        cookie: "crm_session=s%3Aabc123456; Path=/; HttpOnly",
      },
    };
    const sanitizedCookie = sanitizeLogValue(inputWithCookie) as any;
    if (sanitizedCookie.headers?.cookie !== undefined) {
      throw new Error("Test 12 Failed: Cookie header key was not stripped!");
    }
    console.log("  ✓ Test 12: Cookie header strictly redacted from logs");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 13: invitation token is redacted
    // -------------------------------------------------------------------------
    const inputWithInvite = {
      invitationToken: "inv_tok_classified_secret_999",
      nested: { inviteToken: "invite_tok_secret_888" },
    };
    const sanitizedInvite = sanitizeLogValue(inputWithInvite) as any;
    if (sanitizedInvite.invitationToken !== undefined || sanitizedInvite.nested?.inviteToken !== undefined) {
      throw new Error("Test 13 Failed: Invitation token keys were not stripped!");
    }
    console.log("  ✓ Test 13: Invitation tokens strictly redacted from logs");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 14: database URL is redacted
    // -------------------------------------------------------------------------
    const rawDbUrl = "postgresql://crm_admin:SecretDbPassword42@postgres.internal.net:5432/universal_crm_prod?sslmode=require";
    const maskedDbUrl = redactSensitiveString(rawDbUrl);
    if (maskedDbUrl.includes("SecretDbPassword42")) {
      throw new Error("Test 14 Failed: Database password was not masked in connection string!");
    }
    if (!maskedDbUrl.includes("postgresql://crm_admin:***@")) {
      throw new Error(`Test 14 Failed: Expected masked format 'postgresql://crm_admin:***@', got: ${maskedDbUrl}`);
    }
    // Also test object key stripping
    const objWithDbUrl = sanitizeLogValue({ databaseUrl: rawDbUrl }) as any;
    if (objWithDbUrl.databaseUrl !== undefined) {
      throw new Error("Test 14 Failed: databaseUrl key was not stripped from metadata object!");
    }
    console.log("  ✓ Test 14: Database connection credentials strictly redacted");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 15: request body is not blindly logged
    // -------------------------------------------------------------------------
    captureConsole();
    observeApiRequest({
      requestId: "req_test_15",
      method: "POST",
      pathname: "/api/v1/leads",
      statusCode: 201,
      durationMs: 45,
      companyId: "comp_15",
      userId: "usr_15",
    });
    restoreConsole();
    const loggedStr15 = capturedLogs[0]?.message ?? "";
    const parsedLog15 = JSON.parse(loggedStr15);
    // Observe that body/payload is NOT in parsed log
    if (parsedLog15.body || parsedLog15.payload || parsedLog15.data) {
      throw new Error("Test 15 Failed: Request observation included full body payload!");
    }
    if (parsedLog15.route !== "/api/v1/leads" || parsedLog15.method !== "POST" || parsedLog15.statusCode !== 201) {
      throw new Error("Test 15 Failed: Request observation metadata missing essential route/method/status!");
    }
    console.log("  ✓ Test 15: Request observability records structural telemetry without logging bodies");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 16: health endpoint works (Liveness)
    // -------------------------------------------------------------------------
    const healthReq = new NextRequest("http://localhost:3000/health");
    const healthRes = await healthGet(healthReq);
    if (healthRes.status !== 200) {
      throw new Error(`Test 16 Failed: /health returned status ${healthRes.status}, expected 200`);
    }
    const healthData = (await healthRes.json()) as any;
    if (healthData.status !== "ok" || !healthData.requestId || !healthData.timestamp) {
      throw new Error(`Test 16 Failed: /health response invalid: ${JSON.stringify(healthData)}`);
    }
    console.log("  ✓ Test 16: /health liveness probe operates with status 200 and machine-readable payload");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 17: readiness checks database
    // -------------------------------------------------------------------------
    const readyReq = new NextRequest("http://localhost:3000/ready");
    const readyRes = await readyGet(readyReq);
    if (readyRes.status !== 200) {
      throw new Error(`Test 17 Failed: /ready returned status ${readyRes.status}, expected 200`);
    }
    const readyData = (await readyRes.json()) as any;
    if (readyData.status !== "ok" || readyData.checks?.database?.status !== "ok") {
      throw new Error(`Test 17 Failed: /ready checks.database.status is not ok: ${JSON.stringify(readyData)}`);
    }
    console.log("  ✓ Test 17: /ready probe validates database connectivity and returns checks.database = ok");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 18: liveness does not depend on database
    // -------------------------------------------------------------------------
    // Mock prisma.$queryRaw to simulate database outage
    const originalQueryRaw = prisma.$queryRaw;
    (prisma as any).$queryRaw = async () => {
      throw new Error("SIMULATED DATABASE OUTAGE");
    };

    try {
      const livenessDuringDbDown = await healthGet(new NextRequest("http://localhost:3000/health"));
      if (livenessDuringDbDown.status !== 200) {
        throw new Error(`Test 18 Failed: Liveness probe failed when database was down! Status: ${livenessDuringDbDown.status}`);
      }
      const livenessBody = (await livenessDuringDbDown.json()) as any;
      if (livenessBody.status !== "ok") {
        throw new Error("Test 18 Failed: Liveness body was not ok during database outage");
      }
      console.log("  ✓ Test 18: Liveness probe remains healthy during database downtime (process survival)");
      passedTests++;

      // -----------------------------------------------------------------------
      // TEST 19: database failure produces safe readiness failure
      // -----------------------------------------------------------------------
      captureConsole();
      const readyDuringDbDown = await readyGet(new NextRequest("http://localhost:3000/ready"));
      restoreConsole();

      if (readyDuringDbDown.status !== 503) {
        throw new Error(`Test 19 Failed: Expected 503 status when database is down, got ${readyDuringDbDown.status}`);
      }
      const readyFailureBody = (await readyDuringDbDown.json()) as any;
      if (readyFailureBody.status !== "not_ready") {
        throw new Error(`Test 19 Failed: Expected status 'not_ready', got '${readyFailureBody.status}'`);
      }
      if (readyFailureBody.checks?.database?.status !== "error") {
        throw new Error("Test 19 Failed: Expected checks.database.status to be 'error'");
      }
      // Verify no internal stack traces or connection strings in response
      const failJsonStr = JSON.stringify(readyFailureBody);
      if (failJsonStr.includes("SIMULATED DATABASE OUTAGE") || failJsonStr.includes("postgresql://")) {
        throw new Error("Test 19 Failed: Database error details leaked in readiness response!");
      }
      console.log("  ✓ Test 19: Database failure produces 503 not_ready status without leaking internal error details");
      passedTests++;
    } finally {
      // Restore prisma
      (prisma as any).$queryRaw = originalQueryRaw;
    }

    // -------------------------------------------------------------------------
    // TEST 20: provider error is safely logged
    // -------------------------------------------------------------------------
    captureConsole();
    logger.error("Provider operation failed", {
      service: "EmailService",
      provider: "resend",
      operation: "send",
      durationMs: 120,
      errorCode: "APIKeyRevoked",
      errorMessage: "The API key was revoked",
    });
    restoreConsole();
    const providerLogStr = capturedLogs[0]?.message ?? "";
    const providerLog = JSON.parse(providerLogStr);
    if (providerLog.service !== "EmailService" || providerLog.provider !== "resend" || providerLog.operation !== "send") {
      throw new Error("Test 20 Failed: Provider failure log did not include expected service/provider/operation!");
    }
    if (providerLog.durationMs !== 120 || providerLog.errorCode !== "APIKeyRevoked") {
      throw new Error("Test 20 Failed: Provider failure log did not include duration and error code!");
    }
    console.log("  ✓ Test 20: Provider error logged with structured service, provider, operation, and error code");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 21: slow request detection works
    // -------------------------------------------------------------------------
    captureConsole();
    observeApiRequest({
      requestId: "req_slow_21",
      method: "GET",
      pathname: "/api/v1/analytics/pipeline",
      statusCode: 200,
      durationMs: 1500, // Above default 1000ms threshold
      companyId: "comp_21",
    });
    restoreConsole();
    const slowLogStr = capturedLogs[0]?.message ?? "";
    const slowLog = JSON.parse(slowLogStr);
    const slowLevel = String(slowLog.level).toUpperCase();
    if (slowLevel !== "WARN") {
      throw new Error(`Test 21 Failed: Expected log level 'WARN' for slow request, got '${slowLog.level}'`);
    }
    if (!slowLog.message.includes("[SLOW_REQUEST]")) {
      throw new Error(`Test 21 Failed: Expected message to include '[SLOW_REQUEST]', got '${slowLog.message}'`);
    }
    if (slowLog.durationMs !== 1500 || slowLog.thresholdMs !== 1000) {
      throw new Error("Test 21 Failed: Slow request log did not include durationMs or thresholdMs");
    }
    console.log("  ✓ Test 21: Slow request detection fires WARN with durationMs and thresholdMs");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 22: normal request does not produce excessive duplicate logs
    // -------------------------------------------------------------------------
    captureConsole();
    observeApiRequest({
      requestId: "req_normal_22",
      method: "GET",
      pathname: "/api/v1/leads",
      statusCode: 200,
      durationMs: 45,
      companyId: "comp_22",
    });
    restoreConsole();
    if (capturedLogs.length !== 1) {
      throw new Error(`Test 22 Failed: Normal request produced ${capturedLogs.length} logs, expected exactly 1!`);
    }
    const normalLog = JSON.parse(capturedLogs[0].message);
    const normalLevel = String(normalLog.level).toUpperCase();
    if (normalLevel !== "INFO") {
      throw new Error(`Test 22 Failed: Expected 'INFO' level for normal request, got: ${normalLog.level}`);
    }
    console.log("  ✓ Test 22: Normal request produces exactly one structured log entry without duplication");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 23: Super Admin context does not leak tenant context
    // -------------------------------------------------------------------------
    captureConsole();
    runWithRequestContext({ userId: "sa_usr_999", isSuperAdmin: true }, () => {
      logger.info("Super admin platform configuration updated", {
        operation: "update_global_config",
      });
    });
    restoreConsole();
    const saLogStr = capturedLogs[0]?.message ?? "";
    const saLog = JSON.parse(saLogStr);
    if (!saLog.isSuperAdmin) {
      throw new Error("Test 23 Failed: Super admin log did not include isSuperAdmin flag!");
    }
    if (saLog.companyId !== undefined) {
      throw new Error(`Test 23 Failed: Super admin context leaked tenant companyId '${saLog.companyId}'!`);
    }
    console.log("  ✓ Test 23: Super Admin platform context strictly isolates from tenant companyId");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 24: tenant context remains correctly isolated
    // -------------------------------------------------------------------------
    const tenant1Company = "company_tenant_alpha";
    const tenant2Company = "company_tenant_beta";

    let context1Observed: string | undefined;
    let context2Observed: string | undefined;

    // Run context 1
    runWithRequestContext({ companyId: tenant1Company, userId: "usr_alpha" }, () => {
      context1Observed = getCompanyId();

      // Nested or adjacent context 2
      runWithRequestContext({ companyId: tenant2Company, userId: "usr_beta" }, () => {
        context2Observed = getCompanyId();
      });

      // Context 1 must not be mutated
      if (getCompanyId() !== tenant1Company) {
        throw new Error("Test 24 Failed: Context 1 mutated after Context 2 exited!");
      }
    });

    if (context1Observed !== tenant1Company) {
      throw new Error(`Test 24 Failed: Expected context 1 '${tenant1Company}', got '${context1Observed}'`);
    }
    if (context2Observed !== tenant2Company) {
      throw new Error(`Test 24 Failed: Expected context 2 '${tenant2Company}', got '${context2Observed}'`);
    }
    console.log("  ✓ Test 24: Tenant execution contexts remain strictly isolated across concurrent/nested flows");
    passedTests++;

    // -------------------------------------------------------------------------
    // HARDENING TEST A & B: Request enters API route & deep service automatically receives requestId
    // -------------------------------------------------------------------------
    captureConsole();
    async function deepServiceB() {
      logger.info("Deep service operation executed", { operation: "deep_fetch" });
    }
    const testRouteAB = withObservability(async function testGet(req: NextRequest) {
      await deepServiceB();
      return NextResponse.json({ success: true });
    });

    const testReqIdAB = "req_trace_ab_123456789012";
    const resAB = await testRouteAB(new NextRequest("http://localhost:3000/api/v1/leads", {
      headers: { "x-request-id": testReqIdAB },
    }));
    restoreConsole();

    const serviceLogAB = capturedLogs.find((l) => l.message.includes("Deep service operation executed"));
    if (!serviceLogAB) {
      throw new Error("Hardening Test A/B Failed: Deep service log was not captured!");
    }
    const parsedLogAB = JSON.parse(serviceLogAB.message);
    if (parsedLogAB.requestId !== testReqIdAB) {
      throw new Error(`Hardening Test A/B Failed: Expected deep service requestId '${testReqIdAB}', got '${parsedLogAB.requestId}'`);
    }
    if (resAB.headers.get("x-request-id") !== testReqIdAB) {
      throw new Error("Hardening Test A/B Failed: Response missing X-Request-ID header!");
    }
    console.log("  ✓ Hardening Test A & B: Request enters route; deep service logger automatically receives requestId");

    // -------------------------------------------------------------------------
    // HARDENING TEST C: Same request retains companyId and userId after requireAuth()
    // -------------------------------------------------------------------------
    captureConsole();
    async function deepServiceC() {
      logger.info("Deep service with tenant context", { entity: "lead", entityId: "lead_123" });
    }
    const testRouteC = withObservability(async function testPost(req: NextRequest) {
      // Simulate requireAuth trace context enrichment
      setTraceContext({ companyId: "company_c_999", userId: "user_c_888" });
      await deepServiceC();
      return NextResponse.json({ success: true });
    });

    const testReqIdC = "req_trace_c_987654321012";
    await testRouteC(new NextRequest("http://localhost:3000/api/v1/leads", {
      method: "POST",
      headers: { "x-request-id": testReqIdC },
    }));
    restoreConsole();

    const serviceLogC = capturedLogs.find((l) => l.message.includes("Deep service with tenant context"));
    if (!serviceLogC) {
      throw new Error("Hardening Test C Failed: Deep service log C was not captured!");
    }
    const parsedLogC = JSON.parse(serviceLogC.message);
    if (parsedLogC.requestId !== testReqIdC) {
      throw new Error(`Hardening Test C Failed: Expected requestId '${testReqIdC}', got '${parsedLogC.requestId}'`);
    }
    if (parsedLogC.companyId !== "company_c_999" || parsedLogC.userId !== "user_c_888") {
      throw new Error(`Hardening Test C Failed: Expected companyId 'company_c_999' and userId 'user_c_888', got: ${JSON.stringify(parsedLogC)}`);
    }
    console.log("  ✓ Hardening Test C: Request retains companyId and userId after auth across deep service logs");

    // -------------------------------------------------------------------------
    // HARDENING TEST D: Anonymous request has requestId but no tenant/user context
    // -------------------------------------------------------------------------
    captureConsole();
    async function deepAnonymousService() {
      logger.info("Anonymous public operation executed");
    }
    const testRouteD = withObservability(async function testAnon(req: NextRequest) {
      await deepAnonymousService();
      return NextResponse.json({ success: true });
    });

    const testReqIdD = "req_anon_d_123456789012";
    await testRouteD(new NextRequest("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "x-request-id": testReqIdD },
    }));
    restoreConsole();

    const serviceLogD = capturedLogs.find((l) => l.message.includes("Anonymous public operation executed"));
    if (!serviceLogD) {
      throw new Error("Hardening Test D Failed: Anonymous service log was not captured!");
    }
    const parsedLogD = JSON.parse(serviceLogD.message);
    if (parsedLogD.requestId !== testReqIdD) {
      throw new Error(`Hardening Test D Failed: Expected requestId '${testReqIdD}', got '${parsedLogD.requestId}'`);
    }
    if (parsedLogD.companyId !== undefined || parsedLogD.userId !== undefined || parsedLogD.isSuperAdmin !== undefined) {
      throw new Error(`Hardening Test D Failed: Anonymous log leaked context: ${JSON.stringify(parsedLogD)}`);
    }
    console.log("  ✓ Hardening Test D: Anonymous request contains requestId with zero tenant or user leakage");

    // -------------------------------------------------------------------------
    // HARDENING TEST E: Super Admin request has requestId + isSuperAdmin=true, no companyId
    // -------------------------------------------------------------------------
    captureConsole();
    async function deepSuperAdminService() {
      logger.info("Super admin global operation executed", { scope: "platform" });
    }
    const testRouteE = withObservability(async function testAdmin(req: NextRequest) {
      // Simulate requireSuperAdmin trace context enrichment
      setTraceContext({ userId: "sa_usr_e_777", isSuperAdmin: true });
      await deepSuperAdminService();
      return NextResponse.json({ success: true });
    });

    const testReqIdE = "req_admin_e_123456789012";
    await testRouteE(new NextRequest("http://localhost:3000/api/v1/admin/dashboard", {
      headers: { "x-request-id": testReqIdE },
    }));
    restoreConsole();

    const serviceLogE = capturedLogs.find((l) => l.message.includes("Super admin global operation executed"));
    if (!serviceLogE) {
      throw new Error("Hardening Test E Failed: Super admin service log was not captured!");
    }
    const parsedLogE = JSON.parse(serviceLogE.message);
    if (parsedLogE.requestId !== testReqIdE) {
      throw new Error(`Hardening Test E Failed: Expected requestId '${testReqIdE}', got '${parsedLogE.requestId}'`);
    }
    if (parsedLogE.isSuperAdmin !== true || parsedLogE.userId !== "sa_usr_e_777") {
      throw new Error(`Hardening Test E Failed: Expected isSuperAdmin:true and userId:sa_usr_e_777, got: ${JSON.stringify(parsedLogE)}`);
    }
    if (parsedLogE.companyId !== undefined) {
      throw new Error(`Hardening Test E Failed: Super Admin log leaked tenant companyId: ${parsedLogE.companyId}`);
    }
    console.log("  ✓ Hardening Test E: Super Admin request correctly sets isSuperAdmin=true with zero tenant companyId");

    // -------------------------------------------------------------------------
    // HARDENING TEST F: Exception inside deep service still logs the same requestId
    // -------------------------------------------------------------------------
    captureConsole();
    async function failingDeepService() {
      throw new Error("Simulated deep storage provider connection failure");
    }
    const testRouteF = withObservability(async function testFail(req: NextRequest) {
      setTraceContext({ companyId: "comp_f_111", userId: "usr_f_222" });
      await failingDeepService();
      return NextResponse.json({ success: true });
    });

    const testReqIdF = "req_error_f_123456789012";
    const resF = await testRouteF(new NextRequest("http://localhost:3000/api/v1/leads/export", {
      headers: { "x-request-id": testReqIdF },
    }));
    restoreConsole();

    if (resF.status !== 500) {
      throw new Error(`Hardening Test F Failed: Expected 500 status, got ${resF.status}`);
    }
    if (resF.headers.get("x-request-id") !== testReqIdF) {
      throw new Error("Hardening Test F Failed: Error response missing X-Request-ID header!");
    }
    const resBodyF = (await resF.json()) as any;
    if (resBodyF.error?.requestId !== testReqIdF) {
      throw new Error(`Hardening Test F Failed: Response body missing requestId, got: ${JSON.stringify(resBodyF)}`);
    }
    const errorLogF = capturedLogs.find((l) => l.message.includes("Internal API error occurred"));
    if (!errorLogF) {
      throw new Error("Hardening Test F Failed: Server error log was not captured!");
    }
    const parsedErrLogF = JSON.parse(errorLogF.message);
    if (parsedErrLogF.requestId !== testReqIdF) {
      throw new Error(`Hardening Test F Failed: Error log requestId mismatch: expected '${testReqIdF}', got '${parsedErrLogF.requestId}'`);
    }
    console.log("  ✓ Hardening Test F: Exception in deep service is correlated with requestId in logs and response");

    // -------------------------------------------------------------------------
    // HARDENING TEST G: Concurrent requests do NOT cross-contaminate AsyncLocalStorage
    // -------------------------------------------------------------------------
    captureConsole();
    const reqAId = "req_concurrent_alpha_11111111";
    const reqBId = "req_concurrent_beta_22222222";

    const routeConcurrent = withObservability(async function testConcurrent(req: NextRequest) {
      const isAlpha = req.headers.get("x-request-id") === reqAId;
      const compId = isAlpha ? "comp_alpha" : "comp_beta";
      const usrId = isAlpha ? "usr_alpha" : "usr_beta";

      setTraceContext({ companyId: compId, userId: usrId });
      logger.info(`Step 1 for ${isAlpha ? "Alpha" : "Beta"}`);

      // Artificial asynchronous delay to interleave execution
      await new Promise((resolve) => setTimeout(resolve, isAlpha ? 50 : 20));

      logger.info(`Step 2 for ${isAlpha ? "Alpha" : "Beta"}`);

      return NextResponse.json({ success: true, client: isAlpha ? "Alpha" : "Beta" });
    });

    const [resAlpha, resBeta] = await Promise.all([
      routeConcurrent(new NextRequest("http://localhost:3000/api/v1/leads", {
        headers: { "x-request-id": reqAId },
      })),
      routeConcurrent(new NextRequest("http://localhost:3000/api/v1/leads", {
        headers: { "x-request-id": reqBId },
      })),
    ]);
    restoreConsole();

    // Verify all logs for Alpha strictly have reqAId and comp_alpha
    const alphaLogs = capturedLogs
      .map((l) => JSON.parse(l.message))
      .filter((p) => p.message?.includes("Alpha"));
    if (alphaLogs.length < 2) {
      throw new Error(`Hardening Test G Failed: Expected at least 2 Alpha logs, got ${alphaLogs.length}`);
    }
    for (const log of alphaLogs) {
      if (log.requestId !== reqAId) {
        throw new Error(`Hardening Test G Cross-Contamination: Alpha log contained wrong requestId '${log.requestId}'!`);
      }
      if (log.companyId !== "comp_alpha" || log.userId !== "usr_alpha") {
        throw new Error(`Hardening Test G Cross-Contamination: Alpha log contained wrong tenant context: ${JSON.stringify(log)}`);
      }
    }

    // Verify all logs for Beta strictly have reqBId and comp_beta
    const betaLogs = capturedLogs
      .map((l) => JSON.parse(l.message))
      .filter((p) => p.message?.includes("Beta"));
    if (betaLogs.length < 2) {
      throw new Error(`Hardening Test G Failed: Expected at least 2 Beta logs, got ${betaLogs.length}`);
    }
    for (const log of betaLogs) {
      if (log.requestId !== reqBId) {
        throw new Error(`Hardening Test G Cross-Contamination: Beta log contained wrong requestId '${log.requestId}'!`);
      }
      if (log.companyId !== "comp_beta" || log.userId !== "usr_beta") {
        throw new Error(`Hardening Test G Cross-Contamination: Beta log contained wrong tenant context: ${JSON.stringify(log)}`);
      }
    }
    console.log("  ✓ Hardening Test G: Concurrent interleaved requests maintain strictly isolated AsyncLocalStorage contexts");

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // HARDENING TEST H: Individual HTTP handler wrapping verification (AST-based)
    // -------------------------------------------------------------------------
    function getAllApiRouteFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      list.forEach((file: string) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(getAllApiRouteFiles(fullPath));
        } else if (file === "route.ts") {
          results.push(fullPath);
        }
      });
      return results;
    }

    const allApiRoutes = [
      ...getAllApiRouteFiles(path.resolve(process.cwd(), "app/api")),
      path.resolve(process.cwd(), "app/health/route.ts"),
      path.resolve(process.cwd(), "app/ready/route.ts"),
    ];

    const HTTP_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS", "HEAD"]);
    let scannedTotalHandlers = 0;
    let scannedWrappedHandlers = 0;
    const unwrappedHandlersList: Array<{ file: string; method: string }> = [];

    for (const routeFile of allApiRoutes) {
      const fileContent = fs.readFileSync(routeFile, "utf8");
      const relFile = path.relative(process.cwd(), routeFile);
      const source = ts.createSourceFile(routeFile, fileContent, ts.ScriptTarget.Latest, true);

      ts.forEachChild(source, (node) => {
        if (ts.isVariableStatement(node)) {
          const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
          if (isExported) {
            for (const decl of node.declarationList.declarations) {
              const name = decl.name.getText(source);
              if (HTTP_METHODS.has(name)) {
                scannedTotalHandlers++;
                let isWrapped = false;
                if (decl.initializer && ts.isCallExpression(decl.initializer)) {
                  const exprText = decl.initializer.expression.getText(source);
                  if (exprText === "withObservability") {
                    isWrapped = true;
                  }
                }
                if (isWrapped) {
                  scannedWrappedHandlers++;
                } else {
                  unwrappedHandlersList.push({ file: relFile, method: name });
                }
              }
            }
          }
        } else if (ts.isFunctionDeclaration(node)) {
          const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
          if (isExported && node.name) {
            const name = node.name.getText(source);
            if (HTTP_METHODS.has(name)) {
              scannedTotalHandlers++;
              unwrappedHandlersList.push({ file: relFile, method: name });
            }
          }
        }
      });
    }

    if (unwrappedHandlersList.length > 0) {
      throw new Error(`Hardening Test H Failed: Found ${unwrappedHandlersList.length} unwrapped handlers:\n${JSON.stringify(unwrappedHandlersList, null, 2)}`);
    }
    if (allApiRoutes.length !== 86 || scannedTotalHandlers !== 123 || scannedWrappedHandlers !== 123) {
      throw new Error(`Hardening Test H Failed: Inconsistent handler counts: files=${allApiRoutes.length} (expected 86), handlers=${scannedTotalHandlers} (expected 123), wrapped=${scannedWrappedHandlers} (expected 123)`);
    }
    console.log(`  ✓ Hardening Test H: 100% of individual HTTP handlers (${scannedWrappedHandlers}/${scannedTotalHandlers} across ${allApiRoutes.length} route files) verified wrapped via AST`);

    console.log("\n====================================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} B.5 CORE TESTS & ALL HARDENING TESTS A-H PASSED!`);
    console.log("====================================================================");
  } catch (err: any) {
    restoreConsole();
    console.error(`\n❌ B.5 OBSERVABILITY TEST SUITE FAILED:`, err);
    throw err;
  }
}

// Allow direct execution
if (require.main === module) {
  runPhaseB5ObservabilityTests().catch(() => {
    process.exit(1);
  });
}
