[STATE]

# Project State

CURRENT VERSION: Universal CRM V1.1 (Customer Identity, Offerings, Dispositions & Follow-Up Lifecycle)
STATUS: Slices 1–8 LOCKED | Phases 1–7 COMPLETE | Phases B.0–B.7 COMPLETE | Phase B.7.5 COMPLETE | Phase B.7.6 COMPLETE / VERIFIED
CURRENT ACTIVITY: Phase B.7.6 Remediation & Hardening Complete
SUPER ADMIN REVIEW: COMPLETE
V1.1 PHASES 1–7: COMPLETE & VERIFIED
PHASES B.0–B.7: COMPLETE, HARDENED & VERIFIED (Data Safety, Production Readiness, Observability, Provider Fail-Closed)
PHASE B.7.5: COMPLETE & VERIFIED (Comprehensive Read-Only Master Architecture & Product Guide)
PHASE B.7.6: COMPLETE / VERIFIED (Company.currency & Offering.currency @default("USD") dropped via proper migrations, package.json db:reset hardened against production & remote targets, phase-lock wired into npm test/build/deploy:prepare, REOPENED lifecycle documented & tested, exactly 4 system templates verified)
B.8: NEXT AUTHORIZED PHASE, pending explicit user authorization
PHASE 8: BLOCKED / UNTOUCHED (Requires explicit user authorization)
SOURCE OF TRUTH: docs/CRM_MASTER_SYSTEM_GUIDE.md
PRD Version: 2.0 FINAL
Date: 2026-09-29

---

## 1. Executive Summary

Universal CRM V1.0 is fully implemented as a multi-tenant modular monolith SaaS using Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL 16, and Prisma ORM.

Slices 1 through 8 are **COMPLETE, VERIFIED, TESTED AND LOCKED**.

Phases 1 through 7 of the Customer Identity & Business Customization Architecture are **COMPLETE, VERIFIED, TESTED, AND VALIDATED**:
- **Phase 1**: Customer Identity Schema (`Customer`, `CustomerPhone`, `CustomerEmail`, `Lead.customerId`) via proper Prisma migration.
- **Phase 2**: Universal Phone Normalization (`Company.defaultCountryCode` support) + Authoritative Customer Resolution Service.
- **Phase 3**: Lead / Enquiry Compatibility Layer (`ONE CUSTOMER != ONE ENQUIRY`, RBAC `customers.manage`/`customers.link` protected customer reassignment with activity & audit logging).
- **Phase 4A**: Historical Customer Backfill Dry Run (`scripts/customer-backfill.ts`) with bounded batching (500 records), strictly read-only execution, zero database mutations, deterministic duplicate/conflict detection, and anti-hallucination guarantees.
- **Phase 4B**: Historical Customer Backfill Execution with conflict safety (divergent names sharing phone `+15559876543` were NOT auto-merged and left unresolved; 13 missing phone leads left unlinked with `customerId = null`; 100 eligible enquiries linked to 100 newly created customers; all foreign key, tenant, and unique constraints verified).
- **Phase 5**: Full Customer CRUD + Contact Management (`CustomerService`, customer list with pagination/search, primary/secondary phone & email management, soft delete preservation of enquiries, RBAC + Data Scope isolation).
- **Phase 6**: Primary "Create Enquiry" Workflow (`Offering` generic PRODUCT/SERVICE catalog, server-side price override engine with zero client trust, Admin customer directory visibility, Data-Scope-filtered customer history preview, atomic transaction rollback on failure, conflict rejection).
- **Phase 7**: Disposition Management + Follow-Up Lifecycle Engine (Arbitrary-depth hierarchical `Disposition` tree with materialized paths, generic rules `isTerminal`, `requiresFollowUp`, `followUpMandatory`, `allowsClose`, `allowsConvert`, `cancelActiveFollowUp`, contradictory rule prevention, `TaskType` `FOLLOW_UP` vs `GENERAL` separation, strict invariant `ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK` enforced via PostgreSQL partial unique index, immutable `TaskRescheduleHistory` lifecycle events with current task status remaining `PENDING`, atomic PostgreSQL `UPDATE ... RETURNING` overdue synchronization strictly scoped to `FOLLOW_UP`, atomic call outcome workflow, Dispositions workspace, and Call Outcome modal).

All 40 master test suites pass with 0 errors across all platform modules in ~17 seconds. Type-check (tsc) and lint (eslint) pass with 0 errors. Production build (`next build`) compiles all 74 routes successfully.

Next Phase: **Phase 8 — Conversion Engine & Won/Lost Lead Pipeline Architecture**.

---

## 2. Current Locked Platform (Slices 1–8)

- **Slice 1 (Foundation)**: Next.js 16, Tailwind CSS v4, shadcn/ui, PostgreSQL 16, Prisma schema with 18 entities, tenant isolation, foundational libraries, and `/health` + `/ready` endpoints.
- **Slice 2 (Authentication & Multi-Tenancy Engine)**: Database-backed sessions with SHA-256 token hashing, session revocation, state gates (`DISABLED` users and `SUSPENDED` companies blocked), server-side `AuthContext` (User -> Tenant -> Role -> Permissions -> DataScope), edge middleware protecting `/app/*` and `/admin/*`.
- **Slice 3 (Lead Management Core)**: Lead CRUD APIs with strict row-level tenant isolation (`companyId: ctx.company.id`), data scope enforcement (`OWN`, `TEAM`, `COMPANY`), status/assignment history, soft delete (`deletedAt`), and responsive UI.
- **Slice 4 (Activities & Follow-ups)**: Multichannel activities (`CALL`, `WHATSAPP`, `EMAIL`, `NOTE`, `MEETING`), follow-ups API and operational workspace (`/app/follow-ups`) with quick completion.
- **Slice 5 (Lead Import / Export + Custom Fields)**: 11 dynamic custom field types with per-tenant validation, RFC 4180 streaming CSV importer with batching and duplicate strategies, formula-safe CSV export.
- **Slice 6 (Reports & Analytics Dashboard)**: Executive KPI cards, interactive SVG trend charts, conversion funnel, team leaderboard, and formula-safe CSV export with zero N+1 queries.
- **Slice 7 (User & Team Management + Settings)**: User workspace (`/app/settings/users`), 7-day secure single-use invitation tokens, team roster workspace (`/app/settings/teams`), custom role builder with data scopes, company settings, self-service security sessions, and immutable audit trail (`/app/settings/audit-logs`).
- **Slice 7.5 (Documentation System & In-App Help Center)**: Searchable help center (`/app/help`) with 14 guides, contextual deep links across 11 views, master engineering documentation.
- **Slice 8 (Super Admin Platform Console / Tenant Operations / Subscriptions)**: Decoupled platform models (`SuperAdmin`, `SuperAdminSession`, `Plan`, `PlatformAuditLog`), dedicated cookie `universal_crm_superadmin_session`, zero `companyId` context in super admin, transactional company provisioning, instant company suspension with session purge, plan quota manager, immutable platform audit log.

---

## 3. Super Admin Current State vs. Future Architecture

### Current Super Admin Navigation (V1.0 Locked)
- Dashboard (`/admin`)
- Companies (`/admin/companies`)
- Plans & Quotas (`/admin/plans`)
- Platform Audit (`/admin/audit-logs`)
- Security (`/admin/security`)

### Planned Future Super Admin Navigation (V1.1 Blueprint)
- Dashboard (`/admin`) — Clickable KPI drill-downs
- Companies (`/admin/companies`) — Fleet management & Company Detail workspace
- Users (`/admin/users`) [NEW] — Cross-tenant user directory & User Detail inspector
- Plans & Quotas (`/admin/plans`) — Subscription capacity boundaries & quota editor
- Platform Audit (`/admin/audit-logs`) — Cross-tenant immutable audit trail
- Security (`/admin/security`) — Super Admin profile, sessions, & fleet health

### Planned Future Company Detail Workspace (`/admin/companies/[id]`)
- **Overview**: Fleet KPI counters, quota capacity gauges, primary admin contact, tenant configuration.
- **Users**: Searchable company user roster with roles, teams, status, last login, and inspector actions.
- **Leads & Pipeline**: Lead volume vs plan capacity, status breakdown, acquisition source breakdown.
- **Usage & Quotas**: Seat usage, lead capacity, feature flag entitlements.
- **Activity & Tasks**: Multi-channel activity volume, follow-up health.
- **Security & Sessions**: Active tenant sessions list, emergency bulk session purge, suspension reason history.
- **Platform Audit Trail**: Filtered `PlatformAuditLog` records for this specific tenant.

### Planned Future Global Users Workspace (`/admin/users` & `/admin/users/[id]`)
- Cross-tenant user search by name, email, phone, or company slug.
- User Detail inspector covering Identity, Account Lifecycle, Access & Scope, Active Sessions, and Recent Activity.
- Credential safety: Plaintext passwords, password hashes, and raw token secrets are **never** exposed.

### Planned Future Clickable Dashboard Drill-Downs
- `Total Companies` → `/admin/companies`
- `Active Companies` → `/admin/companies?status=ACTIVE`
- `Suspended Companies` → `/admin/companies?status=SUSPENDED`
- `Total Users` → `/admin/users`
- `Active Users` → `/admin/users?status=ACTIVE`
- `Global Leads` → `/admin/companies?sortBy=leads`
- `Plan Subscriber Counts` → `/admin/companies?planTier=TIER`
- `Recent Activity Rows` → Audit log detail inspector modal

---

## 4. Strict Product Boundary

The project enforces an immutable architectural boundary:

```text
SUPER ADMIN PLATFORM
        ↓
    COMPANIES
        ↓
      USERS
        ↓
PLANS / QUOTAS
        ↓
    SECURITY
        ↓
      AUDIT
```

**Super Admin is NOT a tenant CRM.** Super Admin does not create leads, close sales deals, or manage daily pipeline activities.

Tenant CRM remains completely isolated:
```text
Company
   ↓
 Teams
   ↓
 Users
   ↓
 Leads
   ↓
Activities
   ↓
Follow-ups
   ↓
Reports
```

---

## 5. Deferred Capabilities & Data Gaps

### Deferred to Future Milestones (V1.2+):
- Real MRR / ARR / Automated payment gateway (Stripe) billing.
- Storage consumption tracking (MB/GB) and file upload quotas.
- Advanced platform RBAC sub-roles (e.g. `SUPPORT_SPECIALIST`, `BILLING_ADMIN`).
- Automated data retention and soft-delete purge jobs.
- Impersonation (Explicitly excluded by default due to compliance, audit contamination, and session hijacking risks).

### Data Gaps in Current Database Schema:
- **MRR / ARR**: `Plan` has no price columns; `Company` has no billing subscription lifecycle table.
- **Storage Tracking**: No file attachment table or byte counter exists in the database.
- **User Status**: Database enum is `INVITED | ACTIVE | DISABLED`. `DELETED` is soft-delete (`deletedAt`), and `SUSPENDED` is `CompanyStatus`.
- **Session Last Activity**: `Session` tracks `createdAt` and `expiresAt`, but no `lastActivityAt`.
- **Super Admin Avatar/Phone**: `SuperAdmin` model stores `name` and `email` only.

Future agents must **NOT** fabricate these metrics or pretend they exist in code or database.

---

## 6. Implementation Rule & Future Roadmap

When V1.1 development is authorized by the user, agents must follow this strict sequence:
1. Read project memory (`docs/memory/*`).
2. Read the Super Admin blueprint (`docs/SUPER_ADMIN_PLATFORM_REVIEW_AND_V1_1_PLAN.md`).
3. Inspect the current code again to verify no assumptions have drifted.
4. Create an implementation plan before writing any code.
5. Execute according to the planned development order:
   - **Phase A**: Dashboard + Clickable Drill-downs
   - **Phase B**: Company Detail Workspace + Company Users
   - **Phase C**: Global Platform Users + User Detail
   - **Phase D**: Company Profile + Super Admin Profile
   - **Phase E**: Lead / Usage Telemetry
   - **Phase F**: Security + Session Controls
   - **Phase G**: Testing + Security Audit + Documentation

**Agent Rule**: Do not rebuild existing functionality. Slices 1–8 are complete and locked. Do not begin V1.1 until the user explicitly authorizes development.
