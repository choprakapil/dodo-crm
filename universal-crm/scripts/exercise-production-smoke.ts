/**
 * Phase B.7 Real Production-Mode Smoke Test Runner
 *
 * Runs against a live `next start` server on port 3099.
 * Validates real HTTP status codes, headers, and payload structures.
 */

import assert from "assert";

const BASE_URL = "http://127.0.0.1:3099";

async function main() {
  console.log("\n=======================================================");
  console.log("🔥 STARTING REAL HTTP PRODUCTION-MODE SMOKE TEST");
  console.log("=======================================================");

  // 1. GET /health (Liveness)
  console.log("\n[1/8] Testing GET /health...");
  const healthRes = await fetch(`${BASE_URL}/health`, {
    headers: { "x-request-id": "req_smoke_health_01" },
  });
  console.log(`  Status: ${healthRes.status} ${healthRes.statusText}`);
  const healthData = await healthRes.json();
  console.log("  Response:", healthData);
  assert.equal(healthRes.status, 200, "Health probe must return 200");
  assert.equal(healthData.status, "ok");
  assert.equal(healthRes.headers.get("x-request-id"), "req_smoke_health_01");

  // 2. GET /ready (Readiness against disposable DB)
  console.log("\n[2/8] Testing GET /ready...");
  const readyRes = await fetch(`${BASE_URL}/ready`, {
    headers: { "x-request-id": "req_smoke_ready_01" },
  });
  console.log(`  Status: ${readyRes.status} ${readyRes.statusText}`);
  const readyData = await readyRes.json();
  console.log("  Response:", readyData);
  assert.equal(readyRes.status, 200, "Ready probe must return 200");
  assert.equal(readyData.status, "ok");
  assert.equal(readyData.checks?.database?.status, "ok");

  // 3. Unauthorized request
  console.log("\n[3/8] Testing Unauthorized API Request (no cookie)...");
  const unauthRes = await fetch(`${BASE_URL}/api/v1/leads`, {
    headers: { "x-request-id": "req_smoke_unauth_01" },
  });
  console.log(`  Status: ${unauthRes.status} ${unauthRes.statusText}`);
  const unauthData = await unauthRes.json();
  console.log("  Response:", unauthData);
  assert.equal(unauthRes.status, 401, "Unauthenticated request must return 401");
  assert.equal(unauthData.success, false);
  assert.equal(unauthData.error?.code, "UNAUTHORIZED");

  // 4. Login as Tenant User (admin@acmecorp.com)
  console.log("\n[4/8] Testing Tenant Login (POST /api/v1/auth/login)...");
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "req_smoke_login_01",
    },
    body: JSON.stringify({
      email: "admin@acmecorp.com",
      password: "Admin@Acme123!",
    }),
  });
  console.log(`  Status: ${loginRes.status} ${loginRes.statusText}`);
  const loginData = await loginRes.json();
  console.log("  Response Data:", JSON.stringify(loginData, null, 2));
  assert.equal(loginRes.status, 200, "Login must return 200");
  assert(loginData.success, "Login must succeed");

  // Extract session cookie from Set-Cookie
  const setCookieHeader = loginRes.headers.get("set-cookie") || "";
  console.log("  Set-Cookie Header Raw:", setCookieHeader);
  const sessionMatch = setCookieHeader.match(/universal_crm_session=([^;]+)/);
  assert(sessionMatch, "universal_crm_session cookie must be set upon successful login");
  const sessionCookie = `universal_crm_session=${sessionMatch[1]}`;
  console.log("  Extracted Cookie:", sessionCookie);

  // 5. Authenticated tenant API request
  console.log("\n[5/8] Testing Authenticated Tenant Request (GET /api/v1/leads)...");
  const leadsRes = await fetch(`${BASE_URL}/api/v1/leads`, {
    headers: {
      Cookie: sessionCookie,
      "x-request-id": "req_smoke_leads_01",
    },
  });
  console.log(`  Status: ${leadsRes.status} ${leadsRes.statusText}`);
  const leadsData = await leadsRes.json();
  console.log("  Response Success:", leadsData.success, "Count:", leadsData.data?.leads?.length ?? 0);
  assert.equal(leadsRes.status, 200, "Authenticated leads query must return 200");
  assert(leadsData.success, "Leads response must succeed");

  // 6. Cross-tenant access attempt (Company A user requesting Company B's lead)
  console.log("\n[6/8] Testing Cross-Tenant Access Isolation...");
  // Attempting to access a non-existent or foreign tenant lead
  const crossTenantRes = await fetch(`${BASE_URL}/api/v1/leads/cl_foreign_lead_company_b`, {
    headers: {
      Cookie: sessionCookie,
      "x-request-id": "req_smoke_cross_01",
    },
  });
  console.log(`  Status: ${crossTenantRes.status} ${crossTenantRes.statusText}`);
  const crossTenantData = await crossTenantRes.json();
  console.log("  Response:", crossTenantData);
  assert(
    crossTenantRes.status === 404 || crossTenantRes.status === 403,
    "Cross-tenant access must return 404 or 403"
  );
  assert.equal(crossTenantData.success, false);

  // 7. Super Admin Request (POST /api/v1/admin/auth/login)
  console.log("\n[7/8] Testing Super Admin Login & Companies List...");
  const saLoginRes = await fetch(`${BASE_URL}/api/v1/admin/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "req_smoke_sa_01",
    },
    body: JSON.stringify({
      email: "superadmin@universalcrm.com",
      password: "ChangeMe@SuperAdmin123!",
    }),
  });
  console.log(`  Status: ${saLoginRes.status} ${saLoginRes.statusText}`);
  const saLoginData = await saLoginRes.json();
  console.log("  Response Success:", saLoginData.success);
  assert.equal(saLoginRes.status, 200, "Super admin login must return 200");
  assert(saLoginData.success, "Super admin login must succeed");

  const saSetCookie = saLoginRes.headers.get("set-cookie") || "";
  const saMatch = saSetCookie.match(/universal_crm_superadmin_session=([^;]+)/);
  assert(saMatch, "universal_crm_superadmin_session cookie must be set upon super admin login");
  const saCookie = `universal_crm_superadmin_session=${saMatch[1]}`;

  const saCompRes = await fetch(`${BASE_URL}/api/v1/admin/companies`, {
    headers: {
      Cookie: saCookie,
      "x-request-id": "req_smoke_sa_comp_01",
    },
  });
  console.log(`  Status: ${saCompRes.status} ${saCompRes.statusText}`);
  const saCompData = await saCompRes.json();
  console.log("  Response Success:", saCompData.success, "Companies count:", saCompData.data?.companies?.length ?? 0);
  assert.equal(saCompRes.status, 200, "Super admin companies query must return 200");

  // 8. Intentional sanitized error & Request ID correlation
  console.log("\n[8/8] Testing Sanitized Error & Request ID Correlation...");
  const invalidRes = await fetch(`${BASE_URL}/api/v1/leads`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      "x-request-id": "req_smoke_correlate_999",
    },
    body: JSON.stringify({ invalidField: 123 }), // Missing mandatory title/name
  });
  console.log(`  Status: ${invalidRes.status} ${invalidRes.statusText}`);
  const invalidData = await invalidRes.json();
  console.log("  Response:", invalidData);
  assert.equal(invalidRes.status, 400, "Invalid payload must return 400");
  assert.equal(invalidData.success, false);
  assert.equal(invalidRes.headers.get("x-request-id"), "req_smoke_correlate_999");

  // 9. Rate-limited endpoint
  console.log("\n[9/9] Testing Rate-Limited Endpoint (429 Too Many Requests)...");
  const rateLimitRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "rate_limited_ip_999",
      "x-request-id": "req_smoke_ratelimit_01",
    },
    body: JSON.stringify({
      email: "admin@acmecorp.com",
      password: "WrongPassword123!",
    }),
  });
  console.log(`  Status: ${rateLimitRes.status} ${rateLimitRes.statusText}`);
  const rateLimitData = await rateLimitRes.json();
  console.log("  Response:", rateLimitData);
  assert.equal(rateLimitRes.status, 429, "Rate-limited endpoint must return 429");
  assert.equal(rateLimitData.error?.code, "RATE_LIMITED");

  // Verify CSRF cross-origin blocking
  console.log("\n[Bonus] Testing CSRF Cross-Origin Mutation Rejection...");
  const csrfRes = await fetch(`${BASE_URL}/api/v1/leads`, {
    method: "POST",
    headers: {
      Cookie: sessionCookie,
      "Content-Type": "application/json",
      Origin: "https://malicious-attacker.com",
      "x-request-id": "req_smoke_csrf_01",
    },
    body: JSON.stringify({ name: "Hacked Lead" }),
  });
  console.log(`  Status: ${csrfRes.status} ${csrfRes.statusText}`);
  const csrfData = await csrfRes.json();
  console.log("  Response:", csrfData);
  assert.equal(csrfRes.status, 403, "Cross-origin mutation must return 403");
  assert.equal(csrfData.error?.code, "FORBIDDEN");

  console.log("\n=======================================================");
  console.log("🎉 ALL REAL HTTP PRODUCTION SMOKE TESTS PASSED!");
  console.log("=======================================================\n");
}

main().catch((err) => {
  console.error("❌ Production smoke test failed:", err);
  process.exit(1);
});
