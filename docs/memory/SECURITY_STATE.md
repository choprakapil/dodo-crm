[STATE]

# Security State

Last Updated: 2026-09-16 (Slice 6 Completion)
Security Auditor Status: VERIFIED & AUDITED

## Threat Modeling & Mitigations Implemented

| Threat | Mitigation Architecture | Verification Evidence |
|---|---|---|
| **Brute-Force Login** | In-memory sliding window rate limiter (5 attempts / 60s per IP and per account). | `RateLimitError` (HTTP 429) tested in `tests/unit.test.ts` & `login/route.ts`. |
| **Credential Stuffing** | Dual-key rate limiting (IP + normalized email). Passwords hashed with bcrypt (12 salt rounds). | `verifyPassword()` unit tests and bcrypt comparison verified. |
| **Session Fixation / Hijacking** | High-entropy 32-byte cryptographically secure random token generated per session. SHA-256 hash stored in DB; raw token in HTTP-only cookie. | `createDbSession()` and `validateSessionToken()` tests pass. |
| **Session Replay After Logout** | Immediate deletion of session record in DB upon logout or password reset. | `tests/spectator-adversarial.test.ts` [TEST 2] passes. |
| **Account Deactivation Bypass** | Session validation verifies `user.status === ACTIVE` on EVERY request. | `tests/spectator-adversarial.test.ts` [TEST 3] passes. |
| **Company Suspension Bypass** | Session validation verifies `company.status === ACTIVE` on EVERY request. | `tests/spectator-adversarial.test.ts` [TEST 4] passes. |
| **Account Enumeration via Reset** | Password reset always returns identical generic HTTP 200 message regardless of email existence. | `tests/http-e2e.test.ts` and `forgot-password/route.ts` pass. |
| **Password Reset Token Reuse** | Tokens are single-use (`usedAt` timestamp recorded atomically) and expire in 1 hour. All active user sessions are revoked on reset. | `tests/spectator-adversarial.test.ts` [TEST 9] passes. |
| **Cross-Tenant IDOR / Data Leak** | Server-side identity context extracts `companyId` strictly from authenticated session. Queries enforce `where: { companyId: ctx.company.id }`. | `tests/tenant-security.test.ts` & `tests/spectator-adversarial.test.ts` [TEST 7] pass (returns 404). |
| **Privilege Escalation** | Permissions are evaluated against database `RolePermission` records on the authenticated user context. | `tests/spectator-adversarial.test.ts` [TEST 8] passes (`ForbiddenError`). |
| **Cookie Manipulation** | HTTP-only, SameSite=Lax, Secure in production flags set on session cookies. | `tests/http-e2e.test.ts` verifies cookie headers. |
| **Cross-Tenant Lead IDOR (Read/Update/Delete)** | Queries enforce `companyId: ctx.company.id`. Cross-tenant resource queries return 404 (`NotFoundError`) without leaking resource existence. | `tests/lead-tenant-security.test.ts` [TESTS 1, 2, 3] pass. |
| **Foreign Configuration Injection** | Status, Source, User, and Team IDs are validated to belong to `ctx.company.id` before assignment. | `tests/lead-tenant-security.test.ts` [TEST 4] passes (`ValidationError`). |
| **Mass Assignment of Tenant State** | Strict Zod input schema ignores client-supplied `companyId`, `id`, `createdAt`, `deletedAt`. | `tests/lead-tenant-security.test.ts` [TEST 5] & `tests/lead-spectator.test.ts` [TEST 5] pass. |
| **Cross-Tenant Search / Filter Leak** | All search and filter expressions are combined with `companyId` in Prisma `WHERE` clause. | `tests/lead-tenant-security.test.ts` [TEST 6] passes (0 foreign matches). |
| **Data Scope Bypass (`OWN`, `TEAM`, `COMPANY`)** | Dynamic SQL filter generated per user permission: Sales Rep only sees assigned leads (`assignedUserId`), Manager sees team leads (`team_members`), Admin sees company leads. | `tests/lead-spectator.test.ts` [TESTS 1, 3, 4] pass. |
| **Soft Delete Access Bypass** | Normal queries enforce `deletedAt: null`. Direct lookup of soft-deleted lead returns 404. | `tests/lead-integration.test.ts` [TEST 7] & `tests/http-e2e.test.ts` pass. |
| **Cross-Tenant Activity IDOR** | Activity queries and modifications verify associated lead belongs to `ctx.company.id`. Returns 404. | `tests/activity-tenant-security.test.ts` [TESTS 1, 2] pass. |
| **Foreign Activity Lead Injection** | Activity creation on foreign company lead rejected with 404. | `tests/activity-tenant-security.test.ts` [TEST 3] passes. |
| **Activity Scope Bypass** | Sales Rep cannot read or log activities on leads outside their `OWN` scope. | `tests/activity-spectator.test.ts` [TESTS 1, 2] pass. |
| **Cross-Tenant Follow-up IDOR** | Task queries and modifications enforce `companyId: ctx.company.id`. Cross-tenant lookup returns 404. | `tests/follow-up-tenant-security.test.ts` [TESTS 1, 2] pass. |
| **Foreign Follow-up Entity Injection** | Scheduling follow-up against foreign company's lead or assigning to foreign user is blocked with ValidationError. | `tests/follow-up-tenant-security.test.ts` [TESTS 3, 4] pass. |
| **Follow-up State Tampering** | Client-supplied `completedAt`, `completedById`, or `companyId` in create/update payloads are stripped and ignored; completion is only through authenticated action. | `tests/follow-up-spectator.test.ts` [TESTS 3, 4] pass. |
| **Cross-Tenant Custom Field IDOR** | Custom field schema queries and modifications strictly enforce `companyId: ctx.company.id`. Foreign lookups return 404. | `tests/custom-field-tenant-security.test.ts` [TESTS 1, 2, 3] pass. |
| **Foreign Custom Field Value Injection** | Setting a custom field value on a lead only persists fields belonging to the authenticated tenant. Foreign fields are discarded. | `tests/custom-field-tenant-security.test.ts` [TEST 4] passes. |
| **Custom Field Type Tampering** | Runtime validation tests values against declared type (NUMBER, SELECT options, DATE, etc.). Malformed values throw ValidationError (400). | `tests/custom-field-spectator.test.ts` [TEST 4] passes. |
| **CSV Import Tenant ID Spoofing** | CSV files containing a `companyId` or tenant column cannot override server identity; all rows inserted with `ctx.company.id`. | `tests/lead-import-security.test.ts` [TEST 2] passes. |
| **CSV Import Foreign Reference Injection** | Referencing foreign tenant users or status names falls back safely to null/default within the authenticated tenant. | `tests/lead-import-security.test.ts` [TEST 1] passes. |
| **CSV Import Protected Fields Tampering** | In `UPDATE` mode, immutable fields (`id`, `createdAt`, `companyId`) cannot be modified by CSV data. | `tests/lead-import-security.test.ts` [TEST 3] passes. |
| **Cross-Tenant Import History Enumeration** | Import runs and error summaries enforce `companyId: ctx.company.id`. Foreign access returns 404. | `tests/lead-import-spectator.test.ts` [TEST 2] passes. |
| **CSV Spreadsheet Formula Injection** | Cells beginning with `=`, `+`, `-`, `@`, `\t`, `\r` are prepended with `'` to neutralize DDE formula execution in Excel/Sheets. | `tests/lead-export-security.test.ts` [TEST 3] passes. |
| **Lead Export Data Scope Leak** | Lead export strictly enforces `getLeadDataScopeWhere(ctx, "view")`. Reps only export their own leads; foreign/soft-deleted leads excluded. | `tests/lead-export-security.test.ts` [TESTS 1, 2, 4] pass. |
| **Cross-Tenant Analytics Leak** | Overview and export services explicitly query by `companyId: ctx.company.id`. Cross-tenant data is never aggregated or leaked. | `tests/analytics-tenant-security.test.ts` [TEST 1] passes. |
| **Analytics Filter IDOR (Foreign Team/User)** | Passing foreign `teamId` or `userId` in dashboard query returns 0 matching records or safe fallback without leaking foreign entities. | `tests/analytics-tenant-security.test.ts` [TESTS 2, 3] pass. |
| **Analytics RBAC Scope Bypass** | Sales Rep queries enforce `assignedUserId: ctx.user.id`; Manager queries enforce `teamId: ctx.teamId`. Reps never see other reps' metrics or leaderboard entries. | `tests/analytics-spectator.test.ts` [TESTS 1, 2] pass. |
| **Analytics Soft-Delete Inclusion** | Aggregations strictly filter `deletedAt: null` to prevent soft-deleted leads from skewing conversion, pipeline, or count metrics. | `tests/analytics-spectator.test.ts` [TEST 3] passes. |
| **Analytics CSV Formula Injection** | Report export CSV cells beginning with `=`, `+`, `-`, `@`, `\t`, `\r` are prepended with `'` to neutralize spreadsheet formulas. | `tests/analytics-spectator.test.ts` [TEST 4] passes. |
| **Analytics Denial of Service (Huge Date Range)** | Zod validation rejects custom date ranges exceeding 730 days (`max(730)`), preventing expensive unindexed queries. | `tests/analytics-unit.test.ts` [TEST 5] passes. |
| **Cross-Tenant User IDOR** | Reading, updating, deactivating, or resetting password of foreign user returns 404 (`NotFoundError`). | `tests/user-team-tenant-security.test.ts` [TEST 1] passes. |
| **Cross-Tenant Team IDOR & Member Injection** | Foreign team access returns 404; assigning foreign user to team or as manager fails with 404/ValidationError. | `tests/user-team-tenant-security.test.ts` [TEST 2] passes. |
| **Cross-Tenant Custom Role Hijacking** | Custom roles are bounded by `companyId`. Mutating foreign custom role returns 404. | `tests/user-team-tenant-security.test.ts` [TEST 3] passes. |
| **Cross-Tenant Audit Trail Disclosure** | Audit log queries strictly filter by `companyId: ctx.company.id`. Foreign records are never disclosed. | `tests/user-team-tenant-security.test.ts` [TEST 4] passes. |
| **Role Privilege Escalation** | Custom role creator cannot grant permissions they do not hold (`RoleService.createRole`). Reps cannot manage users or roles. | `tests/user-team-spectator.test.ts` [TEST 1] passes. |
| **System Role Tamper / Deletion** | Modifying or deleting built-in system roles (`isSystem: true`) is blocked with `ValidationError`. | `tests/user-team-spectator.test.ts` [TEST 2] passes. |
| **Admin Self-Lockout (Last Admin Guard)** | Administrator cannot deactivate themselves or remove the last admin from tenant. | `tests/user-team-spectator.test.ts` [TEST 3] passes. |
| **Invitation Token Replay / Expiration / Tampering** | 32-byte crypto tokens stored as SHA-256 hash. Reusing, expiring, or corrupting tokens is rejected. | `tests/user-team-spectator.test.ts` [TEST 4] passes. |
| **Instant Deactivation Session Termination** | Deactivating a user immediately purges all active database sessions, locking out compromised accounts in real-time. | `tests/user-team-integration.test.ts` [TEST 3] passes. |
| **Super Admin Context Leak / Separation Bypass** | Super admin context strictly decoupled from tenant context. Zero `companyId` context in super admin session. Dedicated `universal_crm_superadmin_session` cookie. | `tests/super-admin-security.test.ts` [TEST 1, 2] passes. |
| **Tenant Session Infiltration of Admin API** | Middleware and `requireSuperAdmin` reject tenant session cookies on `/admin/*` and `/api/v1/admin/*` with HTTP 401. | `tests/super-admin-security.test.ts` [TEST 1] & `tests/http-e2e.test.ts` pass. |
| **Super Admin Session Infiltration of Tenant API** | Middleware and `requireAuth` reject super admin session cookies on `/app/*` and `/api/v1/*` with HTTP 401. | `tests/super-admin-security.test.ts` [TEST 2] & `tests/http-e2e.test.ts` pass. |
| **Tenant Session Survival on Suspension** | Suspending a company atomically purges all tenant sessions (`deleteMany({ where: { companyId } })`) and blocks new logins. | `tests/super-admin-security.test.ts` [TEST 3] passes. |
| **Quota Bypasses on User/Lead Creation** | Server-side quota evaluation (`assertCanCreateUser`, `assertCanCreateLead`) checks active counts against company's assigned `Plan`. Throws `QUOTA_EXCEEDED` (HTTP 402/400). | `tests/super-admin-security.test.ts` [TEST 4] passes. |
| **Platform Audit Log Tampering** | Platform audit logs are append-only (`PlatformAuditLog`). No update or delete endpoints exist. | `tests/super-admin-security.test.ts` [TEST 5] passes. |
| **Super Admin Session Token Theft / Replay** | Tokens are 32-byte cryptographic randoms stored as SHA-256 hashes in `SuperAdminSession`. Sessions expire in 24 hours. Bulk revocation available. | `tests/super-admin-unit.test.ts` & `tests/super-admin-integration.test.ts` pass. |

