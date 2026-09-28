# Evidence Standards

[RULE]

This file defines what counts as valid evidence anywhere this pack requires it
(completion gates, self-check, final verification, session close, task records).

**Rule: a claim without evidence is not a completed claim.** If evidence cannot
be produced, the correct status is `BLOCKED` or `IN PROGRESS`, never `COMPLETE`.
Do not write "verified", "tested", "works", or "done" unless the matching
evidence below is actually attached in the same record.

---

## Quick Examples (Before & After)

### ❌ WRONG: "Tests pass"
> Tests were run and everything is passing.

### ✅ CORRECT: "Tests pass (with evidence)"
> ```
> $ npm test -- api/users.test.js
> PASS  api/users.test.js
>   User auth
>     ✓ POST /api/users/login returns 200 with valid creds (45ms)
>     ✓ POST /api/users/login returns 401 with invalid creds (12ms)
>     ✓ POST /api/users/logout clears session (8ms)
> Test Suites: 1 passed, 1 total
> Tests:       3 passed, 3 total
> ```

### ❌ WRONG: "Browser verification complete"
> The component was reviewed and the flow looks correct. It should work in browsers.

### ✅ CORRECT: "Browser verification complete (with evidence)"
> Tested in Chrome 120, Firefox 121, Safari 17.1:
> 1. Loaded https://staging.example.com/login
> 2. Entered email test@example.com, password correct
> 3. Clicked "Sign In"
> 4. Observed: redirect to /dashboard, user name appears in top-right corner
> 5. Tested invalid password: got "Invalid credentials" error message

### ❌ WRONG: "Route audit passed"
> Checked the navigation and all routes look good.

### ✅ CORRECT: "Route audit passed (with evidence)"
> Checked routes in ROUTE_LINK_REGISTRY.md:
> - `/login` → loads form, form submits to `/api/auth/login`, redirects to `/dashboard` ✓
> - `/dashboard` → protected route, redirects to `/login` if not authenticated ✓
> - `/settings` → 404 if not in spec (currently dead link, marked BLOCKED) ⚠️

### ❌ WRONG: "Security gate passed"
> Authentication and authorization are implemented correctly.

### ✅ CORRECT: "Security gate passed (with evidence)"
> Tested as unauthorized user (no auth token):
> - GET /api/admin/users → 403 Forbidden ✓
> - POST /api/admin/config → 403 Forbidden ✓
> 
> Tested as user (non-admin role):
> - GET /api/users/me → 200 OK (returns own data) ✓
> - GET /api/admin/users → 403 Forbidden ✓
> 
> Tested RBAC: admin user can POST to /api/admin/config, regular user cannot ✓

### ❌ WRONG: "Database migration complete"
> The migration file was created and looks correct.

### ✅ CORRECT: "Database migration complete (with evidence)"
> ```
> $ npm run migrate
> Migration: 20260908_add_user_roles.js
> ✓ Column 'role' added to users table
> ✓ Backfilled existing users with 'user' role
> ✓ Added constraint: role IN ('admin', 'user', 'moderator')
> Migration completed successfully
> ```

### ❌ WRONG: "Code reuse verified"
> No duplicates were found.

### ✅ CORRECT: "Code reuse verified (with evidence)"
> Searched for "validateEmail" across codebase:
> - `lib/validation.js:45` - main implementation ✓
> - `api/auth/routes.js:12` - calls lib/validation ✓
> - `api/users/routes.js:8` - calls lib/validation ✓
> - Total: 1 implementation, 2 call sites. No duplication.

---



## What counts as evidence, by category

| Claim type | Required evidence | Not sufficient |
|---|---|---|
| Tests pass | The actual command run and its actual output (pass/fail counts, or the failing test names) | "Tests should pass"; "logic looks correct" |
| Browser/E2E verification | The concrete steps taken (pages visited, buttons clicked, forms submitted) and what was actually observed, or a screenshot/recording reference | Reading the component source and inferring it will work |
| Route/link audit | The list of routes/links checked and the destination/status actually observed for each | "Routes look fine" |
| API integration | The real request/response example exchanged with a real consumer (frontend call, curl, test client) | "The contract matches the code" without an executed call |
| Security check | The specific unauthorized/invalid case tested and its observed result (e.g. "requested as non-admin, got 403") | "Auth is handled" |
| Code reuse / dead code | The search performed (what was searched, where) and its result | "I checked and there's no duplicate" without the search shown |
| Dependency readiness | Confirmation the dependency actually resolves/installs/runs in the target environment | "Should be available in production" |
| Migration/schema change | The migration actually run against a real/test database and its result | "The migration file looks correct" |

## How to record evidence

Attach evidence directly in the relevant record — the task's entry in
`docs/TASK_REGISTRY.md` / `docs/TASK_TEMPLATE.md`, or the matching
`docs/memory/*.md` file (e.g. `TEST_STATE.md`, `SECURITY_STATE.md`,
`CODE_HEALTH.md`). A one-line pointer ("see commit abc123") is acceptable only
if the referenced artifact actually exists and is inspectable.

## If evidence cannot be produced

This is expected sometimes — a required tool may be unavailable, a service may
not be reachable in the current environment, or a dependency may be missing.
In that case:

1. Do not claim completion.
2. Mark the task `BLOCKED` in `docs/TASK_REGISTRY.md`.
3. State the specific blocker and what would resolve it.
4. Continue other unblocked work rather than silently skipping verification.

## Why this file exists

Every other document in this pack (`AI_SELF_CHECK.md`, `COMPLETION_GATES.md`,
`FINAL_VERIFICATION.md`, agent files, skills) tells the AI to "verify" or
provide "evidence" without defining what that word means in practice. Without
a concrete standard, an AI agent can satisfy every checklist item with a
confident sentence instead of an actual check — this is the single most
common way this kind of governance pack fails silently. This file closes that
gap: evidence means an actual observed result, not a plausible-sounding claim.
