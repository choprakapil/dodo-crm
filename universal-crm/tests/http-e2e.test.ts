/**
 * HTTP End-to-End Runtime Verification for Slice 2 APIs & Protected Routes
 */

import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface HealthResponse {
  status: string;
}

interface ReadyResponse {
  status: string;
  checks: {
    database: {
      status: string;
    };
  };
}

interface ApiError {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
}

interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
    };
    company: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

interface MeResponse {
  success: boolean;
  data: {
    user: {
      email: string;
    };
    company: {
      slug: string;
    };
    permissions: Array<{
      module: string;
      action: string;
    }>;
  };
}

interface GenericResponse {
  success: boolean;
  message?: string;
}

interface AnalyticsOverviewHttpPayload {
  success: boolean;
  data: {
    kpis: {
      totalLeads: number;
    };
    trends: Array<{ date: string; leads: number }>;
    statuses: Array<{ id: string; name: string }>;
    sources: Array<{ id: string; name: string }>;
    pipeline: { totalValue: number };
    team: Array<{ userId: string; name: string; email: string }>;
  };
  meta?: {
    preset: string;
  };
}

async function runHttpVerification() {
  console.log("\n🌐 Running HTTP Runtime Verification against live server...");

  // 1. Check /health
  console.log("  → GET /health...");
  const healthRes = await fetch(`${BASE_URL}/health`);
  assert.equal(healthRes.status, 200);
  const healthData = (await healthRes.json()) as HealthResponse;
  assert.equal(healthData.status, "ok");

  // 2. Check /ready
  console.log("  → GET /ready...");
  const readyRes = await fetch(`${BASE_URL}/ready`);
  assert.equal(readyRes.status, 200);
  const readyData = (await readyRes.json()) as ReadyResponse;
  assert.equal(readyData.status, "ready");
  assert.equal(readyData.checks.database.status, "ok");

  // 3. Unauthenticated access to /api/v1/auth/me -> 401
  console.log("  → GET /api/v1/auth/me (unauthenticated)...");
  const meUnauth = await fetch(`${BASE_URL}/api/v1/auth/me`);
  assert.equal(meUnauth.status, 401);
  const meUnauthData = (await meUnauth.json()) as ApiError;
  assert.equal(meUnauthData.success, false);
  assert.equal(meUnauthData.error.code, "UNAUTHORIZED");

  // 4. Unauthenticated access to /app -> redirect to /login
  console.log("  → GET /app (unauthenticated, expect redirect)...");
  const appUnauth = await fetch(`${BASE_URL}/app`, { redirect: "manual" });
  assert.ok(
    appUnauth.status === 307 || appUnauth.status === 302,
    `Expected 307 or 302 redirect, got ${appUnauth.status}`
  );
  const location = appUnauth.headers.get("location");
  assert.ok(location?.includes("/login"), `Expected redirect to /login, got ${location}`);

  // 5. Invalid login credentials -> 401
  const RUN_IP = `10.99.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
  console.log("  → POST /api/v1/auth/login (invalid credentials)...");
  const badLogin = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": RUN_IP,
    },
    body: JSON.stringify({
      email: "admin@acmecorp.com",
      password: "WrongPassword123!",
    }),
  });
  assert.equal(badLogin.status, 401);

  // 6. Valid login credentials -> 200 + Set-Cookie
  console.log("  → POST /api/v1/auth/login (valid Acme credentials)...");
  const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": RUN_IP,
    },
    body: JSON.stringify({
      email: "admin@acmecorp.com",
      password: "Admin@Acme123!",
    }),
  });
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get("set-cookie");
  assert.ok(setCookie, "Login response must set cookie");
  assert.ok(setCookie.includes("universal_crm_session"), "Cookie name must be universal_crm_session");
  assert.ok(setCookie.toLowerCase().includes("httponly"), "Cookie must be HttpOnly");
  assert.ok(setCookie.toLowerCase().includes("samesite=lax"), "Cookie must specify SameSite=Lax");

  const loginData = (await loginRes.json()) as LoginResponse;
  assert.equal(loginData.success, true);
  assert.equal(loginData.data.user.email, "admin@acmecorp.com");
  assert.equal(loginData.data.company.slug, "acme-corp");

  // Extract cookie token for subsequent requests
  const cookieValue = setCookie.split(";")[0];

  // 7. Authenticated /me with session cookie -> 200 + User Context
  console.log("  → GET /api/v1/auth/me (authenticated with cookie)...");
  const meAuth = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(meAuth.status, 200);
  const meData = (await meAuth.json()) as MeResponse;
  assert.equal(meData.success, true);
  assert.equal(meData.data.user.email, "admin@acmecorp.com");
  assert.equal(meData.data.company.slug, "acme-corp");
  assert.ok(meData.data.permissions.length > 0, "Permissions array must be populated");

  // 8. Authenticated access to /app with session cookie -> 200
  console.log("  → GET /app (authenticated with cookie)...");
  const appAuth = await fetch(`${BASE_URL}/app`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(appAuth.status, 200);
  const appHtml = await appAuth.text();
  assert.ok(appHtml.includes("Acme Corp"), "App HTML must contain tenant company name");
  assert.ok(appHtml.includes("admin@acmecorp.com"), "App HTML must contain authenticated user email");

  // =========================================================================
  // SLICE 3: LEAD MANAGEMENT CORE HTTP VERIFICATION
  // =========================================================================
  console.log("  → [Slice 3] GET /api/v1/leads without auth (expect 401)...");
  const unauthLeads = await fetch(`${BASE_URL}/api/v1/leads`);
  assert.equal(unauthLeads.status, 401);

  console.log("  → [Slice 3] GET /api/v1/leads/config (authenticated)...");
  const configRes = await fetch(`${BASE_URL}/api/v1/leads/config`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(configRes.status, 200);
  const configJson = (await configRes.json()) as { success: boolean; data: { statuses: Array<{ id: string }>; sources: Array<{ id: string }> } };
  assert.equal(configJson.success, true);
  assert.ok(configJson.data.statuses.length > 0);

  const defaultStatusId = configJson.data.statuses[0].id;
  const activeSourceId = configJson.data.sources[0]?.id;

  console.log("  → [Slice 3] POST /api/v1/leads (Create Lead)...");
  const createLeadRes = await fetch(`${BASE_URL}/api/v1/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieValue,
    },
    body: JSON.stringify({
      name: `HTTP E2E Lead ${Date.now()}`,
      email: "e2e.prospect@testcorp.com",
      phone: "+1 555 987 6543",
      company: "E2E Test Corp",
      amount: 45000,
      priority: "HIGH",
      statusId: defaultStatusId,
      sourceId: activeSourceId,
    }),
  });
  assert.equal(createLeadRes.status, 201);
  const createdLeadJson = (await createLeadRes.json()) as { success: boolean; data: { id: string; name: string; amount: string | number } };
  assert.equal(createdLeadJson.success, true);
  const createdLeadId = createdLeadJson.data.id;
  assert.ok(createdLeadId);

  console.log("  → [Slice 3] GET /api/v1/leads (List Leads with Search)...");
  const listLeadsRes = await fetch(
    `${BASE_URL}/api/v1/leads?search=E2E%20Test%20Corp&page=1&limit=10`,
    { headers: { Cookie: cookieValue } }
  );
  assert.equal(listLeadsRes.status, 200);
  const listLeadsJson = (await listLeadsRes.json()) as {
    success: boolean;
    data: Array<{ id: string; name: string }>;
    pagination: { total: number };
  };
  assert.equal(listLeadsJson.success, true);
  assert.ok(listLeadsJson.data.some((l) => l.id === createdLeadId));

  console.log("  → [Slice 3] GET /api/v1/leads/:id (Lead Detail)...");
  const getLeadRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(getLeadRes.status, 200);
  const getLeadJson = (await getLeadRes.json()) as {
    success: boolean;
    data: { id: string; statusHistories: unknown[]; activities: unknown[] };
  };
  assert.equal(getLeadJson.success, true);
  assert.equal(getLeadJson.data.id, createdLeadId);
  assert.ok(getLeadJson.data.statusHistories.length >= 1);
  assert.ok(getLeadJson.data.activities.length >= 1);

  console.log("  → [Slice 3] PATCH /api/v1/leads/:id (Update Lead)...");
  const updateLeadRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieValue,
    },
    body: JSON.stringify({
      amount: 99000,
      priority: "URGENT",
    }),
  });
  assert.equal(updateLeadRes.status, 200);

  console.log("  → [Slice 3] GET /app/leads (Render Leads UI)...");
  const leadsPageRes = await fetch(`${BASE_URL}/app/leads`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(leadsPageRes.status, 200);
  const leadsPageHtml = await leadsPageRes.text();
  assert.ok(leadsPageHtml.includes("Lead Management"), "UI must render Lead Management header");

  console.log("  → [Slice 4] POST /api/v1/leads/:id/activities (Log Call Activity)...");
  const createActRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieValue,
    },
    body: JSON.stringify({
      type: "CALL",
      subject: "E2E Discovery Call",
      description: "Live HTTP test logged discovery call successfully.",
    }),
  });
  assert.equal(createActRes.status, 201);
  const actData = (await createActRes.json()) as { success: boolean; data: { type: string } };
  assert.equal(actData.success, true);
  assert.equal(actData.data.type, "CALL");

  console.log("  → [Slice 4] GET /api/v1/leads/:id/activities (List Activities)...");
  const listActRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}/activities`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(listActRes.status, 200);
  const listActData = (await listActRes.json()) as { success: boolean; data: Array<unknown> };
  assert.equal(listActData.success, true);
  assert.ok(listActData.data.length > 0);

  console.log("  → [Slice 4] POST /api/v1/follow-ups (Schedule Follow-up)...");
  const createFollowUpRes = await fetch(`${BASE_URL}/api/v1/follow-ups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieValue,
    },
    body: JSON.stringify({
      leadId: createdLeadId,
      title: "E2E Contract Review Follow-up",
      priority: "HIGH",
    }),
  });
  assert.equal(createFollowUpRes.status, 201);
  const followUpData = (await createFollowUpRes.json()) as { success: boolean; data: { id: string } };
  assert.equal(followUpData.success, true);
  const createdFollowUpId = followUpData.data.id;

  console.log("  → [Slice 4] POST /api/v1/follow-ups/:id/complete (Quick Complete)...");
  const completeFollowUpRes = await fetch(`${BASE_URL}/api/v1/follow-ups/${createdFollowUpId}/complete`, {
    method: "POST",
    headers: { Cookie: cookieValue },
  });
  assert.equal(completeFollowUpRes.status, 200);
  const completeData = (await completeFollowUpRes.json()) as { success: boolean; data: { status: string } };
  assert.equal(completeData.data.status, "COMPLETED");

  console.log("  → [Slice 4] GET /app/follow-ups (Render Follow-ups UI)...");
  const followUpsPageRes = await fetch(`${BASE_URL}/app/follow-ups`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(followUpsPageRes.status, 200);
  const followUpsHtml = await followUpsPageRes.text();
  assert.ok(followUpsHtml.includes("Follow-up Workspace"), "UI must render Follow-up Workspace");

  // ==========================================
  // SLICE 5: CUSTOM FIELDS & IMPORT / EXPORT
  // ==========================================
  console.log("  → [Slice 5] POST /api/v1/custom-fields (Create Custom Field)...");
  const cfKey = `e2e_cf_${Date.now()}`;
  const createCfRes = await fetch(`${BASE_URL}/api/v1/custom-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieValue },
    body: JSON.stringify({
      entityType: "LEAD",
      label: "Deal Probability",
      key: cfKey,
      fieldType: "NUMBER",
    }),
  });
  assert.equal(createCfRes.status, 201);
  const createdCfData = (await createCfRes.json()) as { success: boolean; data: { id: string; key: string } };
  const customFieldId = createdCfData.data.id;
  assert.equal(createdCfData.data.key, cfKey);

  console.log("  → [Slice 5] GET /api/v1/custom-fields (List Custom Fields)...");
  const listCfRes = await fetch(`${BASE_URL}/api/v1/custom-fields?entityType=LEAD`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(listCfRes.status, 200);
  const listCfData = (await listCfRes.json()) as { success: boolean; data: Array<{ id: string }> };
  assert.ok(listCfData.data.some((f) => f.id === customFieldId), "New custom field should be listed");

  console.log("  → [Slice 5] PATCH /api/v1/leads/:id/custom-fields (Set Value)...");
  const patchCfValueRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}/custom-fields`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookieValue },
    body: JSON.stringify({
      values: {
        [customFieldId]: 75,
      },
    }),
  });
  assert.equal(patchCfValueRes.status, 200);

  console.log("  → [Slice 5] GET /api/v1/leads/:id/custom-fields (Retrieve Value)...");
  const getCfValueRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}/custom-fields`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(getCfValueRes.status, 200);
  const cfValueData = (await getCfValueRes.json()) as { success: boolean; data: Array<{ field: { id: string }; value: number | null }> };
  const matchedVal = cfValueData.data.find((f) => f.field?.id === customFieldId);
  assert.equal(matchedVal?.value, 75);

  console.log("  → [Slice 5] GET /api/v1/leads/export (Export CSV)...");
  const exportRes = await fetch(`${BASE_URL}/api/v1/leads/export`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(exportRes.status, 200);
  const contentType = exportRes.headers.get("content-type") || "";
  assert.ok(contentType.includes("text/csv"), "Export response must be text/csv");
  const exportedCsvText = await exportRes.text();
  assert.ok(exportedCsvText.includes("Lead Name"), "Export CSV must have Lead Name header");
  assert.ok(exportedCsvText.includes("Deal Probability"), "Export CSV must include custom field header");

  console.log("  → [Slice 5] POST /api/v1/leads/import/preview (CSV Preview)...");
  const testImportCsv = `name,email,company\nE2E Import Lead,e2e-import-${Date.now()}@acme.com,Acme Client`;
  const previewRes = await fetch(`${BASE_URL}/api/v1/leads/import/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieValue },
    body: JSON.stringify({
      csvContent: testImportCsv,
      filename: "e2e_test.csv",
    }),
  });
  assert.equal(previewRes.status, 200);
  const previewData = (await previewRes.json()) as {
    success: boolean;
    data: { detectedHeaders: string[]; totalRows: number; suggestedMappings: Record<string, string> };
  };
  assert.equal(previewData.data.totalRows, 1);
  assert.equal(previewData.data.suggestedMappings.name, "name");
  assert.equal(previewData.data.suggestedMappings.email, "email");

  console.log("  → [Slice 5] POST /api/v1/leads/import (Execute CSV Import)...");
  const executeRes = await fetch(`${BASE_URL}/api/v1/leads/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieValue },
    body: JSON.stringify({
      csvContent: testImportCsv,
      filename: "e2e_test.csv",
      columnMappings: previewData.data.suggestedMappings,
      duplicateStrategy: "CREATE",
    }),
  });
  assert.equal(executeRes.status, 200);
  const executeData = (await executeRes.json()) as {
    success: boolean;
    data: { id: string; successfulRows: number; failedRows: number };
  };
  assert.equal(executeData.data.successfulRows, 1);
  assert.equal(executeData.data.failedRows, 0);

  console.log("  → [Slice 5] GET /api/v1/leads/imports (List Import History)...");
  const listImportsRes = await fetch(`${BASE_URL}/api/v1/leads/imports`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(listImportsRes.status, 200);
  const listImportsData = (await listImportsRes.json()) as { success: boolean; data: Array<{ id: string }> };
  assert.ok(listImportsData.data.some((imp) => imp.id === executeData.data.id));

  console.log("  → [Slice 5] GET /app/settings/custom-fields (Render Custom Field Workspace)...");
  const cfPageRes = await fetch(`${BASE_URL}/app/settings/custom-fields`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(cfPageRes.status, 200);
  const cfPageHtml = await cfPageRes.text();
  assert.ok(cfPageHtml.includes("Lead Custom Fields"), "UI must render Lead Custom Fields");

  console.log("  → [Slice 5] GET /app/leads/import (Render Import Wizard UI)...");
  const importPageRes = await fetch(`${BASE_URL}/app/leads/import`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(importPageRes.status, 200);
  const importPageHtml = await importPageRes.text();
  assert.ok(importPageHtml.includes("Import Leads from CSV"), "UI must render Import Leads from CSV");

  console.log("  → [Slice 3] DELETE /api/v1/leads/:id (Soft Delete)...");
  const deleteLeadRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}`, {
    method: "DELETE",
    headers: { Cookie: cookieValue },
  });
  assert.equal(deleteLeadRes.status, 200);

  console.log("  → [Slice 3] GET /api/v1/leads/:id after soft-delete (expect 404)...");
  const getDeletedRes = await fetch(`${BASE_URL}/api/v1/leads/${createdLeadId}`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(getDeletedRes.status, 404);

  // ---------------------------------------------------------------------------
  // [Slice 6] Reports & Analytics Dashboard Verification
  // ---------------------------------------------------------------------------
  console.log("  → [Slice 6] GET /api/v1/analytics/overview (Admin session)...");
  const analyticsOverviewRes = await fetch(`${BASE_URL}/api/v1/analytics/overview`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(analyticsOverviewRes.status, 200, "Analytics overview endpoint must return 200");
  const analyticsJson = (await analyticsOverviewRes.json()) as AnalyticsOverviewHttpPayload;
  assert.equal(analyticsJson.success, true, "Analytics overview must return success: true");
  assert(analyticsJson.data.kpis, "Analytics overview must include kpis object");
  assert(Array.isArray(analyticsJson.data.trends), "Analytics overview must include trends array");
  assert(Array.isArray(analyticsJson.data.statuses), "Analytics overview must include statuses array");
  assert(Array.isArray(analyticsJson.data.sources), "Analytics overview must include sources array");
  assert(Array.isArray(analyticsJson.data.team), "Analytics overview must include team array");
  assert(analyticsJson.data.pipeline, "Analytics overview must include pipeline object");
  console.log(`    ✓ Admin overview returned ${analyticsJson.data.kpis.totalLeads} leads, ${analyticsJson.data.team.length} agents in leaderboard`);

  console.log("  → [Slice 6] GET /api/v1/analytics/overview?preset=LAST_7_DAYS...");
  const preset7Res = await fetch(`${BASE_URL}/api/v1/analytics/overview?preset=LAST_7_DAYS`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(preset7Res.status, 200);
  const preset7Json = (await preset7Res.json()) as AnalyticsOverviewHttpPayload;
  assert.equal(preset7Json.meta?.preset, "LAST_7_DAYS");

  console.log("  → [Slice 6] GET /api/v1/analytics/export?report=team (CSV export)...");
  const exportCsvRes = await fetch(`${BASE_URL}/api/v1/analytics/export?report=team`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(exportCsvRes.status, 200, "CSV export must return 200");
  assert(exportCsvRes.headers.get("content-type")?.includes("text/csv"), "Must return text/csv content type");
  const csvBody = await exportCsvRes.text();
  assert(csvBody.includes("Agent Name"), "CSV must include Agent Name header");

  console.log("  → [Slice 6] GET /app (Dashboard HTML view)...");
  const appRes = await fetch(`${BASE_URL}/app`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(appRes.status, 200, "/app must return 200 for authenticated user");
  const dashboardAppHtml = await appRes.text();
  assert(dashboardAppHtml.includes("Reports &amp; Analytics Dashboard") || dashboardAppHtml.includes("Reports & Analytics Dashboard"), "Must contain dashboard heading");

  console.log("  → [Slice 6] GET /app/dashboard (Redirect alias to /app)...");
  const dashboardRedirectRes = await fetch(`${BASE_URL}/app/dashboard`, {
    headers: { Cookie: cookieValue },
    redirect: "manual",
  });
  assert(
    dashboardRedirectRes.status === 307 || dashboardRedirectRes.status === 308 || dashboardRedirectRes.status === 200,
    "/app/dashboard must redirect or serve dashboard"
  );

  console.log("  → [Slice 6] Sales Rep Scoped Analytics over HTTP...");
  const repLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "10.0.0.99",
    },
    body: JSON.stringify({
      email: "sarah@acmecorp.com",
      password: "SalesRep@Acme123!",
    }),
  });
  assert.equal(repLoginRes.status, 200);
  const repCookie = repLoginRes.headers.get("set-cookie")?.split(";")[0] || "";

  const repAnalyticsRes = await fetch(`${BASE_URL}/api/v1/analytics/overview`, {
    headers: { Cookie: repCookie },
  });
  assert.equal(repAnalyticsRes.status, 200);
  const repAnalyticsJson = (await repAnalyticsRes.json()) as AnalyticsOverviewHttpPayload;
  assert.equal(repAnalyticsJson.data.team.length, 1, "Sales Rep over HTTP must see only 1 agent in leaderboard");
  assert.equal(repAnalyticsJson.data.team[0].email, "sarah@acmecorp.com", "Sales Rep must see only themselves");
  console.log("    ✓ Sales Rep OWN scope verified over HTTP API");

  // =========================================================================
  // SLICE 7: USER & TEAM MANAGEMENT + SETTINGS HTTP VERIFICATION
  // =========================================================================
  console.log("  → [Slice 7] GET /api/v1/users (Admin)...");
  const usersRes = await fetch(`${BASE_URL}/api/v1/users?page=1&limit=10`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(usersRes.status, 200);
  const usersJson = (await usersRes.json()) as any;
  assert.ok(Array.isArray(usersJson.data));
  assert.ok(usersJson.data.length >= 1);
  assert.ok(usersJson.pagination);
  console.log(`    ✓ Admin fetched ${usersJson.data.length} users with pagination`);

  console.log("  → [Slice 7] GET /api/v1/users (Rep -> expect 403 Forbidden)...");
  const repUsersRes = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { Cookie: repCookie },
  });
  assert.equal(repUsersRes.status, 403);
  console.log("    ✓ Sales Rep correctly blocked from user management (403)");

  console.log("  → [Slice 7] GET /api/v1/teams...");
  const teamsRes = await fetch(`${BASE_URL}/api/v1/teams`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(teamsRes.status, 200);
  const teamsJson = (await teamsRes.json()) as any;
  assert.ok(Array.isArray(teamsJson.data));
  assert.ok(teamsJson.data.length >= 1);
  console.log(`    ✓ Admin fetched ${teamsJson.data.length} teams`);

  console.log("  → [Slice 7] GET /api/v1/roles...");
  const rolesRes = await fetch(`${BASE_URL}/api/v1/roles`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(rolesRes.status, 200);
  const rolesJson = (await rolesRes.json()) as any;
  assert.ok(Array.isArray(rolesJson.data));
  assert.ok(rolesJson.data.length >= 5);
  console.log(`    ✓ Admin fetched ${rolesJson.data.length} system and custom roles`);

  console.log("  → [Slice 7] GET /api/v1/company/settings...");
  const companyRes = await fetch(`${BASE_URL}/api/v1/company/settings`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(companyRes.status, 200);
  const companyJson = (await companyRes.json()) as any;
  assert.equal(companyJson.data.slug, "acme-corp");
  console.log("    ✓ Company settings retrieved");

  console.log("  → [Slice 7] GET /api/v1/security/sessions...");
  const sessionsRes = await fetch(`${BASE_URL}/api/v1/security/sessions`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(sessionsRes.status, 200);
  const sessionsJson = (await sessionsRes.json()) as any;
  assert.ok(Array.isArray(sessionsJson.data));
  assert.ok(sessionsJson.data.length >= 1);
  console.log(`    ✓ Admin retrieved ${sessionsJson.data.length} active sessions`);

  console.log("  → [Slice 7] GET /api/v1/audit-logs...");
  const auditRes = await fetch(`${BASE_URL}/api/v1/audit-logs?page=1&pageSize=10`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(auditRes.status, 200);
  const auditJson = (await auditRes.json()) as any;
  assert.ok(Array.isArray(auditJson.data));
  assert.ok(auditJson.data.length >= 1);
  console.log(`    ✓ Admin retrieved ${auditJson.data.length} tamper-proof audit records`);

  console.log("  → [Slice 7] GET /api/v1/audit-logs (Rep -> expect 403 Forbidden)...");
  const repAuditRes = await fetch(`${BASE_URL}/api/v1/audit-logs`, {
    headers: { Cookie: repCookie },
  });
  assert.equal(repAuditRes.status, 403);
  console.log("    ✓ Sales Rep correctly blocked from audit logs (403)");

  // --- SLICE 7.5: IN-APP HELP CENTER VERIFICATION ---
  console.log("  → [Slice 7.5] GET /app/help (Authenticated -> expect 200)...");
  const helpRes = await fetch(`${BASE_URL}/app/help`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(helpRes.status, 200);
  const helpHtml = await helpRes.text();
  assert.ok(helpHtml.includes("Help &amp; Documentation Center") || helpHtml.includes("Help & Documentation Center"));
  console.log("    ✓ Authenticated user rendered /app/help successfully");

  console.log("  → [Slice 7.5] GET /app/help?article=leads (Contextual Lead Help -> expect 200)...");
  const contextualHelpRes = await fetch(`${BASE_URL}/app/help?article=leads`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(contextualHelpRes.status, 200);
  console.log("    ✓ Contextual help article rendered successfully");

  console.log("  → [Slice 7.5] GET /app/help (Unauthenticated -> expect redirect to /login)...");
  const unauthHelpRes = await fetch(`${BASE_URL}/app/help`, {
    redirect: "manual",
  });
  assert.ok(unauthHelpRes.status === 307 || unauthHelpRes.status === 308 || unauthHelpRes.status === 302);
  assert.ok(unauthHelpRes.headers.get("location")?.includes("/login"));
  console.log("    ✓ Unauthenticated access to /app/help safely redirected to /login");

  // 9. Forgot password API -> 200 (generic response)
  console.log("  → POST /api/v1/auth/forgot-password...");
  const forgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@acmecorp.com" }),
  });
  assert.equal(forgotRes.status, 200);
  const forgotData = (await forgotRes.json()) as GenericResponse;
  assert.equal(forgotData.success, true);

  // 10. Logout API -> 200 + cleared cookie
  console.log("  → POST /api/v1/auth/logout...");
  const logoutRes = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookieValue },
  });
  assert.equal(logoutRes.status, 200);
  const logoutSetCookie = logoutRes.headers.get("set-cookie");
  assert.ok(
    logoutSetCookie?.includes("universal_crm_session=;") ||
      logoutSetCookie?.includes("Max-Age=0") ||
      logoutSetCookie?.includes("Expires="),
    "Logout must clear session cookie"
  );

  // 11. Verify session is revoked: /me with old cookie -> 401
  console.log("  → GET /api/v1/auth/me (with revoked cookie -> expect 401)...");
  const meRevoked = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(meRevoked.status, 401);

  // ===========================================================================
  // SLICE 8: SUPER ADMIN PLATFORM CONSOLE & BOUNDARY SEPARATION E2E
  // ===========================================================================
  console.log("\n====================================================================");
  console.log("👑 RUNNING SLICE 8: SUPER ADMIN PLATFORM CONSOLE LIVE HTTP TESTS");
  console.log("====================================================================");

  // 12. Unauthenticated Super Admin Boundary Protection
  console.log("  → [Slice 8] GET /admin (Unauthenticated -> expect redirect to /admin/login)...");
  const unauthAdminRes = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
  assert.ok(unauthAdminRes.status === 307 || unauthAdminRes.status === 308 || unauthAdminRes.status === 302);
  assert.ok(unauthAdminRes.headers.get("location")?.includes("/admin/login"));
  console.log("    ✓ /admin safely redirected unauthenticated visitor to /admin/login");

  console.log("  → [Slice 8] GET /api/v1/admin/auth/me (No cookie -> expect 401)...");
  const unauthAdminApiRes = await fetch(`${BASE_URL}/api/v1/admin/auth/me`);
  assert.equal(unauthAdminApiRes.status, 401);
  console.log("    ✓ Super Admin API rejected request with no credentials (401)");

  // Tenant cookie boundary test (tenant cookie MUST NOT authenticate as Super Admin)
  console.log("  → [Slice 8 Boundary] GET /api/v1/admin/auth/me (With tenant cookie -> expect 401)...");
  const tenantToAdminApiRes = await fetch(`${BASE_URL}/api/v1/admin/auth/me`, {
    headers: { Cookie: cookieValue },
  });
  assert.equal(tenantToAdminApiRes.status, 401);
  console.log("    ✓ Tenant session cookie strictly rejected by Super Admin API");

  // 13. Super Admin Login API
  console.log("  → [Slice 8 Auth] POST /api/v1/admin/auth/login...");
  const adminLoginRes = await fetch(`${BASE_URL}/api/v1/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "superadmin@universalcrm.com",
      password: "ChangeMe@SuperAdmin123!",
    }),
  });
  assert.equal(adminLoginRes.status, 200);
  const adminLoginData = (await adminLoginRes.json()) as any;
  assert.equal(adminLoginData.success, true);
  assert.equal(adminLoginData.data.superAdmin.email, "superadmin@universalcrm.com");
  assert.equal(adminLoginData.data.superAdmin.role, "SUPER_ADMIN");

  const adminSetCookie = adminLoginRes.headers.get("set-cookie");
  assert.ok(adminSetCookie, "Super Admin login must issue Set-Cookie header");
  assert.ok(
    adminSetCookie.includes("universal_crm_superadmin_session="),
    "Must set dedicated universal_crm_superadmin_session cookie"
  );
  assert.ok(
    !adminSetCookie.includes("universal_crm_session="),
    "Must NOT set normal tenant universal_crm_session cookie"
  );

  const adminCookieMatch = adminSetCookie.match(/universal_crm_superadmin_session=([^;]+)/);
  assert.ok(adminCookieMatch && adminCookieMatch[1]);
  const adminCookieValue = `universal_crm_superadmin_session=${adminCookieMatch[1]}`;
  console.log("    ✓ Super Admin authenticated and received dedicated platform cookie");

  // 14. Super Admin Boundary Isolation (Super Admin token cannot access tenant routes/APIs)
  console.log("  → [Slice 8 Boundary] GET /app/dashboard (With super admin cookie -> expect redirect to /login)...");
  const adminToTenantAppRes = await fetch(`${BASE_URL}/app/dashboard`, {
    headers: { Cookie: adminCookieValue },
    redirect: "manual",
  });
  assert.ok(adminToTenantAppRes.status === 307 || adminToTenantAppRes.status === 308 || adminToTenantAppRes.status === 302);
  assert.ok(adminToTenantAppRes.headers.get("location")?.includes("/login"));
  console.log("    ✓ Super admin cookie blocked from tenant /app routes");

  console.log("  → [Slice 8 Boundary] GET /api/v1/users (With super admin cookie -> expect 401)...");
  const adminToTenantApiRes = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminToTenantApiRes.status, 401);
  console.log("    ✓ Super admin cookie strictly rejected by tenant APIs");

  // 15. Super Admin Authenticated APIs
  console.log("  → [Slice 8 API] GET /api/v1/admin/auth/me...");
  const adminMeRes = await fetch(`${BASE_URL}/api/v1/admin/auth/me`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminMeRes.status, 200);
  const adminMeData = (await adminMeRes.json()) as any;
  assert.equal(adminMeData.data.superAdmin.email, "superadmin@universalcrm.com");
  assert.equal(adminMeData.data.superAdmin.role, "SUPER_ADMIN");

  console.log("  → [Slice 8 API] GET /api/v1/admin/dashboard...");
  const adminDashRes = await fetch(`${BASE_URL}/api/v1/admin/dashboard`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminDashRes.status, 200);
  const adminDashData = (await adminDashRes.json()) as any;
  assert.equal(adminDashData.success, true);
  assert.ok(adminDashData.data.metrics.companies.total >= 1);

  console.log("  → [Slice 8 API] GET /api/v1/admin/companies...");
  const adminCompaniesRes = await fetch(`${BASE_URL}/api/v1/admin/companies`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminCompaniesRes.status, 200);
  const adminCompaniesData = (await adminCompaniesRes.json()) as any;
  assert.ok(Array.isArray(adminCompaniesData.data));
  assert.ok(adminCompaniesData.pagination);

  console.log("  → [Slice 8 API] GET /api/v1/admin/plans...");
  const adminPlansRes = await fetch(`${BASE_URL}/api/v1/admin/plans`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminPlansRes.status, 200);
  const adminPlansData = (await adminPlansRes.json()) as any;
  assert.equal(adminPlansData.success, true);
  assert.equal(adminPlansData.data.length, 4, "Must return 4 subscription plans");

  console.log("  → [Slice 8 API] GET /api/v1/admin/audit-logs...");
  const adminAuditRes = await fetch(`${BASE_URL}/api/v1/admin/audit-logs`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminAuditRes.status, 200);
  const adminAuditData = (await adminAuditRes.json()) as any;
  assert.ok(Array.isArray(adminAuditData.data));
  assert.ok(adminAuditData.pagination);

  // 16. Super Admin Frontend HTML Workspace Verification
  console.log("  → [Slice 8 UI] GET /admin (Dashboard UI -> expect 200)...");
  const adminUiRes = await fetch(`${BASE_URL}/admin`, { headers: { Cookie: adminCookieValue } });
  assert.equal(adminUiRes.status, 200);

  console.log("  → [Slice 8 UI] GET /admin/companies (Companies UI -> expect 200)...");
  const companiesUiRes = await fetch(`${BASE_URL}/admin/companies`, { headers: { Cookie: adminCookieValue } });
  assert.equal(companiesUiRes.status, 200);

  console.log("  → [Slice 8 UI] GET /admin/plans (Plans UI -> expect 200)...");
  const plansUiRes = await fetch(`${BASE_URL}/admin/plans`, { headers: { Cookie: adminCookieValue } });
  assert.equal(plansUiRes.status, 200);

  console.log("  → [Slice 8 UI] GET /admin/audit-logs (Audit Logs UI -> expect 200)...");
  const auditUiRes = await fetch(`${BASE_URL}/admin/audit-logs`, { headers: { Cookie: adminCookieValue } });
  assert.equal(auditUiRes.status, 200);

  console.log("  → [Slice 8 UI] GET /admin/security (Security UI -> expect 200)...");
  const securityUiRes = await fetch(`${BASE_URL}/admin/security`, { headers: { Cookie: adminCookieValue } });
  assert.equal(securityUiRes.status, 200);

  // 17. Super Admin Logout
  console.log("  → [Slice 8 Auth] POST /api/v1/admin/auth/logout...");
  const adminLogoutRes = await fetch(`${BASE_URL}/api/v1/admin/auth/logout`, {
    method: "POST",
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminLogoutRes.status, 200);
  const adminLogoutSetCookie = adminLogoutRes.headers.get("set-cookie");
  assert.ok(
    adminLogoutSetCookie?.includes("universal_crm_superadmin_session=;") ||
      adminLogoutSetCookie?.includes("Max-Age=0") ||
      adminLogoutSetCookie?.includes("Expires="),
    "Logout must clear super admin session cookie"
  );

  console.log("  → [Slice 8 Auth] GET /api/v1/admin/auth/me (with revoked cookie -> expect 401)...");
  const adminMeRevoked = await fetch(`${BASE_URL}/api/v1/admin/auth/me`, {
    headers: { Cookie: adminCookieValue },
  });
  assert.equal(adminMeRevoked.status, 401);
  console.log("    ✓ Revoked Super Admin session correctly rejected (401)");

  console.log("\n====================================================================");
  console.log("🎉 ALL LIVE HTTP E2E RUNTIME VERIFICATIONS (SLICES 1 - 8) PASSED!");
  console.log("====================================================================\n");
}

runHttpVerification().catch((err) => {
  console.error("❌ Live HTTP verification failed:", err);
  process.exit(1);
});
