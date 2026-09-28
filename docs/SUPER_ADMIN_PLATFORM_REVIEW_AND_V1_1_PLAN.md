# Universal CRM — Super Admin Platform Console
## Complete Platform Review, Gap Analysis, UX Architecture & V1.1 Blueprint

**Status:** ARCHITECTURAL REVIEW & IMPLEMENTATION BLUEPRINT (NO IMPLEMENTATION PERFORMED)  
**Target Version:** V1.1 Planning  
**Baseline Verified State:** Slice 8 Complete & Locked (32 Test Suites, 56 Routes Compiled)  
**Date:** 2026-09-17  
**Author:** Antigravity Architect & Engineering Team  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Current Super Admin Architecture](#2-current-super-admin-architecture)
3. [Current Navigation & Layout Analysis](#3-current-navigation--layout-analysis)
4. [Current Features (What Actually Exists Today)](#4-current-features-what-actually-exists-today)
5. [Missing Capabilities & Critical Gaps](#5-missing-capabilities--critical-gaps)
6. [Company Fleet Management Review](#6-company-fleet-management-review)
7. [Company User Management Review (The Core Missing Dimension)](#7-company-user-management-review-the-core-missing-dimension)
8. [User Detail Architecture (`/admin/users/[id]`)](#8-user-detail-architecture-adminusersid)
9. [Company Profile & Administrative Edit Controls](#9-company-profile--administrative-edit-controls)
10. [Super Admin Profile & Personal Security Settings](#10-super-admin-profile--personal-security-settings)
11. [Dashboard Review & Telemetry Metrics](#11-dashboard-review--telemetry-metrics)
12. [Clickable Cards & Metric Drill-Down Map](#12-clickable-cards--metric-drill-down-map)
13. [Company Detail Information Architecture (`/admin/companies/[id]`)](#13-company-detail-information-architecture-admincompaniesid)
14. [Global Platform Users Information Architecture (`/admin/users`)](#14-global-platform-users-information-architecture-adminusers)
15. [Plans, Quotas & Subscription Tier Review](#15-plans-quotas--subscription-tier-review)
16. [Platform Audit Trail & Security Event Review](#16-platform-audit-trail--security-event-review)
17. [Platform Security & Fleet Health View](#17-platform-security--fleet-health-view)
18. [UX/UI & Visual Architecture Review](#18-uxui--visual-architecture-review)
19. [Data Gaps (Database Schema Discrepancies)](#19-data-gaps-database-schema-discrepancies)
20. [API Gaps (Required Endpoints)](#20-api-gaps-required-endpoints)
21. [Database Gaps & Schema Recommendations](#21-database-gaps--schema-recommendations)
22. [Permission, RBAC & Isolation Boundaries](#22-permission-rbac--isolation-boundaries)
23. [Performance, Caching & Scalability Analysis](#23-performance-caching--scalability-analysis)
24. [Recommended Navigation Structure](#24-recommended-navigation-structure)
25. [Complete Feature Matrix](#25-complete-feature-matrix)
26. [Impersonation Policy & Security Threat Model](#26-impersonation-policy--security-threat-model)
27. [Product Boundary: Platform Console vs. Tenant CRM](#27-product-boundary-platform-console-vs-tenant-crm)
28. [Future V1.1 Phased Implementation Plan](#28-future-v11-phased-implementation-plan)
29. [Future V1.2+ Considerations](#29-future-v12-considerations)
30. [What Must NOT Be Changed](#30-what-must-not-be-changed)
31. [Memory & Agent Updates Recommended](#31-memory--agent-updates-recommended)
32. [Definition of Done for V1.1 Super Admin](#32-definition-of-done-for-v11-super-admin)

---

## 1. Executive Summary

Universal CRM reached full V1.0 operational completion with the delivery and locking of Slice 8. The existing platform implements a clean architectural decoupling between tenant workspaces (`/app/*`) and the Super Admin platform console (`/admin/*`).

However, while Slice 8 successfully introduced multi-tenant fleet isolation, transactional company provisioning, quota gates, and platform audit logging, the **Super Admin Console remains predominantly company-centric and scalar**. It functions as a tenant provisioning and suspension console rather than a comprehensive platform operations command center.

### Primary Architectural Findings:
1. **The Company User Blindspot**: While Company Admins can manage employees inside `/app/settings/users`, the Super Admin Console has **zero visibility into individual users**. There is no way for a platform operator to inspect who belongs to a company, search for a user by email across tenants, inspect session health, or troubleshoot account lockouts.
2. **Monolithic, Flat Company Details**: `/admin/companies/[id]` displays basic configuration and entity counters on a single page with no sub-views, no user roster, no lead inspection, and no inline editing.
3. **Static, Non-Clickable Dashboard**: The Super Admin dashboard exposes high-level metrics (Total Companies, Total Users, Global Leads, Total Teams), but **none of the cards or plan distributions are clickable drill-downs**.
4. **Data Gaps in Business Concepts**: Revenue metrics (MRR/ARR) and storage consumption are conceptualized in requirements, but **do not exist in the Prisma database schema**. Plans are configuration-only with seat and lead limits; they contain no pricing columns, and there is no file storage tracking table.
5. **Strict Boundary Preservation Required**: The Super Admin Console must **never** become an ad-hoc CRM for tenant leads. Platform operations must strictly govern:
   $$\text{Platform} \longrightarrow \text{Companies} \longrightarrow \text{Users} \longrightarrow \text{Plans} \longrightarrow \text{Quotas} \longrightarrow \text{Security} \longrightarrow \text{Audit}$$

This document provides an exhaustive, code-grounded review of the existing repository, identifies every data, API, and UX gap, and establishes the definitive phased blueprint for the upcoming V1.1 Super Admin evolution.

---

## 2. Current Super Admin Architecture

### 2.1 Decoupled Identity & Authentication Model
The platform enforces absolute isolation between platform operators and tenant users:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HTTP REQUEST                                    │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
            Cookie: universal_crm_session   Cookie: universal_crm_superadmin_session
                       │                               │
                       ▼                               ▼
       ┌──────────────────────────────┐ ┌──────────────────────────────┐
       │     TENANT APPLICATION       │ │   SUPER ADMIN PLATFORM       │
       │   Routes: /app/*, /api/v1/*  │ │ Routes: /admin/*, /api/v1/admin/* │
       ├──────────────────────────────┤ ├──────────────────────────────┤
       │ User (companyId mandatory)   │ │ SuperAdmin (NO companyId)    │
       │ Session (DB-backed)          │ │ SuperAdminSession (DB-backed)│
       │ Role -> Permission Matrix    │ │ Hardcoded System SuperAdmin  │
       │ Data Scope: OWN | TEAM | CO  │ │ Platform Authorization Scope │
       └──────────────────────────────┘ └──────────────────────────────┘
```

### 2.2 Security Invariants in Code
1. **Model Separation**: `SuperAdmin` lives in `super_admins` table; tenant `User` lives in `users`.
2. **Session Separation**: `SuperAdminSession` (`super_admin_sessions`) uses SHA-256 hashed tokens stored in cookie `universal_crm_superadmin_session`.
3. **Middleware Isolation**: `middleware.ts` rejects tenant sessions on `/admin/*` and blocks Super Admin sessions from `/app/*`.
4. **Context Integrity**: Server-side resolver `requireSuperAdmin()` returns `SuperAdminContext` with zero `companyId` context.

---

## 3. Current Navigation & Layout Analysis

### 3.1 Existing Top-Bar Navigation (`components/admin/admin-nav.tsx`)
The current console uses a fixed dark header (`bg-slate-900 text-white`) with 5 navigation links:
- **Dashboard** (`/admin`)
- **Companies** (`/admin/companies`)
- **Plans & Quotas** (`/admin/plans`)
- **Platform Audit** (`/admin/audit-logs`)
- **Security** (`/admin/security`)

Right actions contain the administrator's email (`superadmin@universalcrm.com`), a `SUPER ADMIN` badge, and a `Sign Out` button.

### 3.2 Navigation Sufficiency Assessment
- **Is 5 items sufficient?** No. The complete absence of **Users** forces the operator to be blind to tenant membership.
- **Should every feature be a top-level link?** Absolutely not. Bloating the sidebar/header with "Leads", "Teams", "Storage", "MRR", or "Backups" breaks operational hierarchy.
- **Recommended Evolution**: A clean **6-item top navigation**:
  1. **Dashboard** (Executive Telemetry + Clickable KPI entry points)
  2. **Companies** (Tenant Fleet, Provisioning, Company Detail Workspace)
  3. **Users** (Global Cross-Tenant User Search, Status Inspector, User Detail)
  4. **Plans & Quotas** (Tiers, Entitlements, Capacity Rules, Over-quota Monitors)
  5. **Platform Audit** (Cross-tenant administrative action trail)
  6. **Security** (Platform Security Health, Active Sessions, Super Admin Profile)

Company-specific leads, company-specific users, and company-specific settings belong **inside the Company Detail workspace**, not in the primary navigation.

---

## 4. Current Features (What Actually Exists Today)

Based on direct inspection of the codebase (`universal-crm/app/admin/*`, `lib/services/platform-*.ts`, and Prisma schema):

| Capability | File / Route | Current Implementation Details |
|---|---|---|
| **Platform Telemetry** | `/admin`<br>`/api/v1/admin/dashboard` | Aggregates Total/Active/Suspended Companies, Total/Active Users, Total Leads, Total Teams, Plan subscriber counts, and 8 recent audit events via parallel queries. |
| **Fleet List & Filtering** | `/admin/companies`<br>`/api/v1/admin/companies` | Server-paginated table with search (name, slug, email), status filter (`ACTIVE`, `SUSPENDED`), and plan filter (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`). |
| **Company Provisioning** | `/admin/companies/new`<br>`POST /api/v1/admin/companies` | Transactional creation of Company, 5 system roles (`Admin`, `Manager`, `Sales Rep`, `Viewer`, `Support`), 6 default lead statuses, 5 lead sources, initial Admin user (`INVITED`), and 7-day secure invite token with email dispatch. |
| **Tenant Suspension** | `/admin/companies/[id]`<br>`POST /api/v1/admin/companies/[id]/suspend` | Sets `Company.status = SUSPENDED` and atomically deletes all active tenant sessions from `sessions` table. Logs platform audit event. |
| **Tenant Reactivation** | `/admin/companies/[id]`<br>`POST /api/v1/admin/companies/[id]/reactivate` | Sets `Company.status = ACTIVE`. Preserves all tenant data. Logs platform audit event. |
| **Plan Reassignment** | `/admin/companies/[id]`<br>`PATCH /api/v1/admin/companies/[id]/plan` | Updates `Company.planId`. Re-evaluates quota limits immediately. |
| **Plan Quota Configuration** | `/admin/plans`<br>`PATCH /api/v1/admin/plans/[id]` | Updates `maxUsers`, `maxLeads`, and feature flags (`customFields`, `export`, `analytics`, `auditLogs`) per plan tier. |
| **Platform Audit Logs** | `/admin/audit-logs`<br>`/api/v1/admin/audit-logs` | Server-paginated append-only log with action search, action filter, operator details, and JSON metadata / before-after state inspector dialog. |
| **Platform Security** | `/admin/security`<br>`/api/v1/admin/security/*` | Self-service Super Admin password update (bcrypt), active session viewer (`super_admin_sessions`), single session revocation, and bulk session revocation. |

---

## 5. Missing Capabilities & Critical Gaps

Direct inspection reveals 10 major architectural and UX gaps in the current implementation:

1. **Zero Visibility into Company Users**: Super Admin cannot see the user roster of any company.
2. **No Global User Search**: An operator cannot search by email (`user@client.com`) to find out which tenant account an individual belongs to.
3. **No User Detail Page**: There is no `/admin/users/[id]` route or platform API to inspect user status, role, assigned team, last login, or active sessions.
4. **No Company Profile Editing**: Super Admin cannot update company name, support email, phone, website, timezone, currency, or date format.
5. **Static, Dead KPI Cards**: Dashboard metrics (`Total Companies`, `Total Users`, `Global Leads`, `Total Teams`) cannot be clicked to filter or drill down.
6. **Flat Company Detail Page**: No tabs, no deep operational hierarchy. Everything is crammed onto one page.
7. **No Lead Roster or Distribution View**: Super Admin sees a total number of leads (e.g. 100), but cannot inspect lead status breakdown or pipeline health for a company.
8. **Missing Financial / Billing Data (DATA GAP)**: Requirements mention MRR and revenue breakdowns, but `Plan` and `Company` entities have no price, currency billing amount, or subscription lifecycle timestamps.
9. **Missing Storage Tracking (DATA GAP)**: Requirements mention storage quotas, but there is no file upload tracking table or byte counter in the database.
10. **Super Admin Profile Incomplete**: Profile card in `/admin/security` is hardcoded/read-only; name cannot be updated; no avatar support.

---

## 6. Company Fleet Management Review

### 6.1 Current List Experience (`/admin/companies`)
- **Columns**: Company (Name + Slug), Status (`ACTIVE`/`SUSPENDED`), Plan Tier, Users (`current / max`), Leads (`current / max`), Created Date, Actions (`Inspect`).
- **Filters**: Search query, Status dropdown, Plan Tier dropdown.
- **Evaluation**: The table is well-structured and clean, but suffers from two UX flaws:
  1. URL query parameters (`?status=ACTIVE` or `?planTier=PROFESSIONAL`) are **not synchronized** with React component state on initial mount (`useSearchParams` is omitted).
  2. The table lacks quick operational filters such as "Over Quota" or "Recently Provisioned".

### 6.2 Proposed Enhancements for Company Fleet Table
- Add direct URL search param hydration so dashboard clicks automatically filter the table.
- Display primary administrator email directly in the row or secondary line.
- Provide quick row actions dropdown: `Inspect`, `Change Plan`, `Suspend / Reactivate`, `View Users`.

---

## 7. Company User Management Review (The Core Missing Dimension)

### 7.1 The Architectural Problem
Tenant user management currently resides exclusively inside the tenant application (`/app/settings/users`). The service layer (`UserService`) requires `ctx: AuthContext` and strictly enforces `where: { companyId: ctx.company.id }`.

Because Super Admin has **no companyId context**, Super Admin cannot call `UserService`. Consequently, the platform has zero user query APIs for Super Admin.

### 7.2 The Solution: Dedicated Platform User Service
We must define a platform-level user management layer: `PlatformUserService`.

```text
SuperAdmin (Platform Context)
    │
    ├──> GET /api/v1/admin/users
    │       (Cross-company paginated search by name, email, company, role, status)
    │
    ├──> GET /api/v1/admin/companies/[id]/users
    │       (Company-scoped user roster for Company Detail tab)
    │
    └──> GET /api/v1/admin/users/[id]
            (Deep platform user inspector with sessions, activity, and security state)
```

### 7.3 Data Privacy & Credential Safety
Super Admin user management must enforce strict security boundaries:
- **Expose**: ID, Full Name, Email, Phone, Company (ID + Name), Role (ID + Name), Teams, Status (`INVITED`, `ACTIVE`, `DISABLED`), Last Login Timestamp, Created Date, Active Sessions (IP, User Agent, Created At, Expires At).
- **NEVER Expose**: `hashedPassword`, password reset tokens, invitation raw tokens, or session cookie hashes.

---

## 8. User Detail Architecture (`/admin/users/[id]`)

When an operator navigates to `/admin/users/[id]`, the screen must present a high-density, structured view:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Platform Users                                                   │
│                                                                             │
│  [JD]  John Doe                           Status: ACTIVE    Company: Acme   │
│        john.doe@acmecorp.com              Role: Sales Rep   Team: Outbound  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Identity & Profile]        [Account Lifecycle]        [Access & Scope]    │
│  • Full Name: John Doe       • Status: ACTIVE           • Role: Sales Rep   │
│  • Email: john@acme.com      • Created: 2026-08-10      • System Role: Yes  │
│  • Phone: +1 555-0199        • Invited: 2026-08-10      • Scope: OWN        │
│  • Company: Acme Corp        • Accepted: 2026-08-11     • Teams: Outbound   │
│  • User ID: usr_clx992...    • Last Login: 2 hours ago  • Permissions: 13   │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Active Sessions (3)]                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Chrome 128 on macOS • IP: 198.51.100.42 • Created: Today 09:15        │  │
│  │ Expires: In 6 days                                      [Revoke]     │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ Safari on iPhone • IP: 198.51.100.42 • Created: Yesterday 18:22       │  │
│  │ Expires: In 5 days                                      [Revoke]     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Actions: [Revoke All Sessions]  [Disable Account]  [Send Password Reset]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Recent Operational Activity]                                              │
│  • 2026-09-17 14:10 — Status changed to Proposal Sent on lead "Tech Corp"   │
│  • 2026-09-17 11:30 — Logged Call with Sarah Connor                         │
│  • 2026-09-16 16:45 — Created follow-up task "Review contract draft"       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Company Profile & Administrative Edit Controls

### 9.1 View vs. Edit vs. Platform Mutation Separation
The Super Admin Console must strictly categorize actions on a company:

```text
┌───────────────────────────┬───────────────────────────┬───────────────────────────┐
│        READ-ONLY          │     METADATA EDITING      │    PLATFORM OPERATIONAL   │
│         (Inspect)         │   (Company Settings)      │        (Privileged)       │
├───────────────────────────┼───────────────────────────┼───────────────────────────┤
│ • Entity statistics       │ • Company Display Name    │ • Suspend Tenant          │
│ • Quota meters            │ • Support Email           │ • Reactivate Tenant       │
│ • User roster             │ • Support Phone           │ • Reassign Plan Tier      │
│ • Lead breakdown          │ • Website URL             │ • Override Quotas         │
│ • Historical audit logs   │ • Logo URL                │ • Purge All Sessions      │
│ • Creation date           │ • Timezone, Currency      │ • Delete Tenant (Future)  │
└───────────────────────────┴───────────────────────────┴───────────────────────────┘
```

### 9.2 API Contract Required
- `PATCH /api/v1/admin/companies/[id]`
  - Body: `{ name?, email?, phone?, website?, logoUrl?, timezone?, currency?, dateFormat? }`
  - Validates formatting, updates `companies` table, and logs `COMPANY_PROFILE_UPDATED` in `platform_audit_logs`.

---

## 10. Super Admin Profile & Personal Security Settings

Currently, `/admin/security` combines password changing and platform sessions, but lacks personal profile management.

### Recommended Information Architecture:
- **Tab 1: Administrator Identity**
  - Name, Email, Role (`SUPER_ADMIN`), Account Created Date, Last Login Date.
  - Ability to update Name (`PATCH /api/v1/admin/auth/me`).
- **Tab 2: Password & Credentials**
  - Current Password verification + New Password (enforcing 8+ chars, upper/lower/number/symbol).
- **Tab 3: Active Platform Sessions**
  - View current session and other devices.
  - Single revocation & "Sign Out All Other Sessions".
- **Tab 4: Console Preferences**
  - Timezone display preference (Browser Local vs. UTC).
  - Date format preference for audit logs.

---

## 11. Dashboard Review & Telemetry Metrics

### 11.1 Current Query Implementation (`PlatformDashboardService.getTelemetry`)
The service executes 9 parallel queries via `Promise.all`:
1. `prisma.company.count()`
2. `prisma.company.count({ where: { status: 'ACTIVE' } })`
3. `prisma.company.count({ where: { status: 'SUSPENDED' } })`
4. `prisma.user.count({ where: { deletedAt: null } })`
5. `prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } })`
6. `prisma.lead.count({ where: { deletedAt: null } })`
7. `prisma.team.count({ where: { isActive: true } })`
8. `prisma.plan.findMany(...)` with `_count.companies`
9. `prisma.platformAuditLog.findMany(...)` (take: 8)

### 11.2 Deficiencies
- **Zero Clickability**: Every metric is rendered in a static `<div>`.
- **Missing Quota Pressure Telemetry**: No metric for "Companies Near Quota Limit (>80%)".
- **No User Activity Rate**: No metric for "Users Active in Last 24 Hours".

---

## 12. Clickable Cards & Metric Drill-Down Map

Every meaningful number on the Super Admin dashboard must be an interactive entry point:

| Card / Element | Underlying Query / Data | Current State | Target Destination Route | Applied Filters / Query Params | Empty State Handling |
|---|---|---|---|---|---|
| **Total Companies** | `prisma.company.count()` | Static text | `/admin/companies` | None (All companies) | "No companies provisioned yet" |
| **Active Companies** | `count(status: ACTIVE)` | Static subtext | `/admin/companies?status=ACTIVE` | `status=ACTIVE` | "0 active companies" |
| **Suspended Companies** | `count(status: SUSPENDED)` | Static subtext | `/admin/companies?status=SUSPENDED` | `status=SUSPENDED` | "No suspended companies (Healthy)" |
| **Total Users** | `prisma.user.count(deletedAt: null)` | Static text | `/admin/users` | None (All users) | "No registered users" |
| **Active Users** | `count(status: ACTIVE)` | Static subtext | `/admin/users?status=ACTIVE` | `status=ACTIVE` | "No active users" |
| **Global Leads** | `prisma.lead.count(deletedAt: null)` | Static text | `/admin/companies?sortBy=leads` | Sorted descending by lead count | "No CRM leads in fleet" |
| **Total Teams** | `prisma.team.count(isActive: true)` | Static text | `/admin/companies` | Fleet overview | "No active teams" |
| **Plan Card (Free)** | `subscriberCount` for FREE | Static item | `/admin/companies?planTier=FREE` | `planTier=FREE` | "0 companies on Free tier" |
| **Plan Card (Starter)** | `subscriberCount` for STARTER | Static item | `/admin/companies?planTier=STARTER` | `planTier=STARTER` | "0 companies on Starter tier" |
| **Plan Card (Professional)**| `subscriberCount` for PROFESSIONAL | Static item | `/admin/companies?planTier=PROFESSIONAL` | `planTier=PROFESSIONAL` | "0 companies on Pro tier" |
| **Plan Card (Enterprise)** | `subscriberCount` for ENTERPRISE | Static item | `/admin/companies?planTier=ENTERPRISE` | `planTier=ENTERPRISE` | "0 companies on Enterprise" |
| **Recent Action Row** | `PlatformAuditLog` item | Static row | `/admin/audit-logs` (or detail modal) | Opens log inspector modal | "No recent audit events" |

---

## 13. Company Detail Information Architecture (`/admin/companies/[id]`)

Transform the monolithic page into a tabbed operational command center:

```text
/admin/companies/[id]
│
├── Header: Logo, Name, Slug, ID, Status Badge, Plan Badge, Primary Admin
│   Actions: [Edit Profile] [Change Plan] [Suspend / Reactivate]
│
├── Tab 1: Overview
│   ├── KPI Summary (Users, Teams, Leads, Activities, Follow-ups)
│   ├── Quota Capacity Gauges (Seat Usage %, Lead Usage %)
│   ├── Primary Administrator Contact Card
│   └── Tenant Configuration Summary
│
├── Tab 2: Users (NEW)
│   ├── Search bar & Status filter (Active, Disabled, Invited)
│   ├── User Roster Table (Name, Email, Role, Teams, Status, Last Login, Sessions)
│   └── Actions: Inspect User (→ /admin/users/[id]), Disable, Password Reset
│
├── Tab 3: Leads & Pipeline (NEW)
│   ├── Lead Volume vs Plan Capacity
│   ├── Distribution by Status (New, Contacted, Converted, Lost)
│   ├── Distribution by Source (Website, Referral, Google Ads)
│   └── Soft-Deleted Leads Counter
│
├── Tab 4: Usage & Quotas
│   ├── User Seats (Allocated vs Plan Max)
│   ├── Leads Capacity (Created vs Plan Max)
│   ├── Storage Meter (Marked as Data Gap / Feature Gate)
│   └── Plan Feature Flags (Custom Fields, Export, Analytics, Audit Logs)
│
├── Tab 5: Activity & Tasks (NEW)
│   ├── Multi-channel interaction volume (Calls, WhatsApp, Emails, Meetings)
│   └── Follow-up health (Pending, Completed, Overdue tasks)
│
├── Tab 6: Security & Fleet Health (NEW)
│   ├── Active tenant user sessions list (Device, IP, Created, Expires)
│   ├── Action: Emergency Purge All Company Sessions
│   └── Suspension status & reason history
│
└── Tab 7: Platform Audit Trail
    └── Filtered PlatformAuditLog records where entityId = companyId
```

---

## 14. Global Platform Users Information Architecture (`/admin/users`)

Dedicated cross-tenant user intelligence workspace:

### 14.1 Workspace Layout
- **Header**: Title ("Platform Users"), description ("Search and inspect accounts across all tenant companies").
- **Metrics Bar**:
  - Total Registered Users
  - Active Users
  - Invited / Pending Users
  - Disabled Accounts
- **Filters & Search Toolbar**:
  - Search input: Name, Email, Phone, Company Slug.
  - Company filter dropdown (dynamic list of active tenants).
  - Status filter: `All Statuses`, `ACTIVE`, `INVITED`, `DISABLED`.
  - Role filter: `Admin`, `Manager`, `Sales Rep`, etc.
- **Table Columns**:
  1. User (Avatar/Initials, Name, Email, Phone)
  2. Company (Company Name + clickable link to `/admin/companies/[id]`)
  3. Role (Role Name + System/Custom badge)
  4. Teams (Assigned team badges)
  5. Account Status (`ACTIVE`, `INVITED`, `DISABLED`)
  6. Last Login (Relative timestamp, e.g. "2 hours ago" or "Never")
  7. Actions (`Inspect User` → `/admin/users/[id]`)

---

## 15. Plans, Quotas & Subscription Tier Review

### 15.1 Current Implementation (`/admin/plans`)
- 4 tiers: `FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`.
- Configurable quotas: `maxUsers`, `maxLeads`.
- Configurable feature flags in JSON: `customFields`, `export`, `analytics`, `auditLogs`, `advancedReports`.
- Enforcement is active server-side in `QuotaService.assertCanCreateUser` and `assertCanCreateLead`.

### 15.2 Deficiencies & Clickability
- The plan cards display company counts (e.g. `1 Company`), but clicking does not filter companies.
- Tiers lack monetary pricing columns.

### 15.3 Recommendations
- Make plan subscriber badges link directly to `/admin/companies?planTier=TIER`.
- Add over-quota warnings directly in the plan overview if any company exceeds limits.

---

## 16. Platform Audit Trail & Security Event Review

### 16.1 Current Implementation (`/admin/audit-logs`)
- Reads from `platform_audit_logs` table.
- Stores: `superAdminId`, `action`, `entityType`, `entityId`, `metadata`, `beforeState`, `afterState`, `ipAddress`, `userAgent`, `createdAt`.
- Filterable by `action` and `search`.

### 16.2 Recommended Improvements
- Add entity relationship deep linking: If `entityType == "COMPANY"`, clicking `entityId` navigates directly to `/admin/companies/[entityId]`.
- If `entityType == "USER"`, clicking navigates to `/admin/users/[entityId]`.
- Add date-range filtering (Today, Last 7 Days, Last 30 Days).

---

## 17. Platform Security & Fleet Health View

### 17.1 Current Scope (`/admin/security`)
Focuses only on Super Admin's own credentials and active sessions.

### 17.2 Future Dual-Scope Architecture
Split `/admin/security` into two clear tabs:
1. **Super Admin Security**: Current sessions, session revocation, change password.
2. **Platform Fleet Health**:
   - Total active sessions across the entire fleet.
   - List of suspended companies and reason logs.
   - List of disabled users across all tenants.
   - Rate limiting & failed login telemetry (if supported).

---

## 18. UX/UI & Visual Architecture Review

### 18.1 Spacing, Hierarchy & Typography
- **Header**: High contrast, clean, professional dark slate (`#0f172a`) navigation bar.
- **Card Containers**: Consistent white background, `border-slate-200`, `rounded-xl`, subtle shadow (`shadow-sm`).
- **Typography**: Clear hierarchy with `text-2xl font-bold` page titles, `text-xs text-slate-500` subtitles, and tabular monospace styling for IDs and slugs.

### 18.2 Areas for Improvement
- **Interactive Affordance**: KPI cards need hover states (`hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all`) to signal clickability.
- **Table Density**: Tables should offer compact padding (`py-2.5 px-3`) for dense operational viewing.
- **Breadcrumbs**: Company and User detail views need formal breadcrumb navigation (`Home > Companies > Acme Corp > Users`).

---

## 19. Data Gaps (Database Schema Discrepancies)

The following requirements from product discussions **do NOT exist in the current Prisma schema** and are classified as **DATA GAPS**:

| Requested Concept | Current Schema Reality | Classification | Recommendation for Future |
|---|---|---|---|
| **Monthly / Annual Recurring Revenue (MRR/ARR)** | `Plan` has no `priceMonthly`, `priceYearly`, or `billingCycle` columns. `Company` has no subscription billing table. | **DATA GAP** | Do not invent fake revenue calculations. Add `priceMonthly` / `priceYearly` Decimal fields to `Plan` in V1.2. |
| **Storage Consumption (MB/GB)** | `Company` has no `storageUsedBytes`. `Plan` has no `maxStorageBytes`. No `File` or `Attachment` model exists in DB. | **DATA GAP** | Do not display arbitrary disk usage. Add storage quota columns and metadata tracking when file uploads are built. |
| **User Status: `SUSPENDED` / `DELETED`** | `UserStatus` enum only contains `INVITED`, `ACTIVE`, `DISABLED`. Deleted users use `deletedAt: DateTime?`. Suspended is a `CompanyStatus`. | **DATA GAP / ENUM MISMATCH** | UI should compute status badge: if `deletedAt` -> show `DELETED`; if company suspended -> show `COMPANY_SUSPENDED`; otherwise show enum. |
| **User Session Last Activity** | `Session` model contains `createdAt` and `expiresAt`, but no `lastActivityAt`. | **DATA GAP** | Display `createdAt` and `expiresAt`; add touch/heartbeat column in V1.2 if needed. |
| **User Invitation Accepted Timestamp** | `User` has no `invitationAcceptedAt`. `Invitation` table has `usedAt: DateTime?`. | **RESOLVABLE VIA RELATION** | Query `Invitation.usedAt` joined by email and companyId. |
| **Super Admin Display Name / Avatar** | `SuperAdmin` has `name` and `email`, but no `avatarUrl` or `phone`. | **DATA GAP (Minor)** | Display initials avatar; add fields if personal profile is extended. |

---

## 20. API Gaps (Required Endpoints)

The following endpoints do not exist today and must be created in future versions:

### Global Users API:
1. `GET /api/v1/admin/users` — Paginated cross-tenant user query with search, status, role, and company filters.
2. `GET /api/v1/admin/users/[id]` — Deep user detail inspector (identity, account, access, active sessions, recent activity).
3. `PATCH /api/v1/admin/users/[id]/status` — Enable or disable a user account from platform level.
4. `DELETE /api/v1/admin/users/[id]/sessions` — Revoke specific or all active sessions for a user.

### Company-Specific Extensions:
5. `GET /api/v1/admin/companies/[id]/users` — Roster of users belonging to this specific company.
6. `PATCH /api/v1/admin/companies/[id]` — Edit company profile (name, email, phone, website, timezone, currency, dateFormat).
7. `GET /api/v1/admin/companies/[id]/leads` — Lead distribution and pipeline statistics.
8. `DELETE /api/v1/admin/companies/[id]/sessions` — Emergency bulk purge of all company user sessions.

### Super Admin Profile:
9. `PATCH /api/v1/admin/auth/me` — Update Super Admin name and contact details.

---

## 21. Database Gaps & Schema Recommendations

To support the complete Super Admin roadmap without breaking existing V1.0 guarantees, the following schema additions should be planned for a future migration:

```prisma
// Recommended additions for Prisma Schema (Future Migration — DO NOT APPLY NOW)

// 1. Extend Plan with pricing (if billing is required)
model Plan {
  // Existing fields...
  priceMonthly  Decimal?  @db.Decimal(10, 2)
  priceYearly   Decimal?  @db.Decimal(10, 2)
  maxStorageMb  Int       @default(1000)
}

// 2. Add lastActivityAt to tenant Session
model Session {
  // Existing fields...
  lastActivityAt DateTime?
}

// 3. Add personal details to SuperAdmin
model SuperAdmin {
  // Existing fields...
  phone     String?
  avatarUrl String?
}
```

---

## 22. Permission, RBAC & Isolation Boundaries

### Core Isolation Rules:
1. **Never pass tenant `AuthContext` to Super Admin**: Super Admin authorization uses `SuperAdminContext` with no `companyId`.
2. **Never query without companyId when serving `/app/*`**: Tenant isolation remains row-level `WHERE companyId = ctx.company.id`.
3. **Cross-Tenant Queries are Restricted to `/api/v1/admin/*`**: Any query that omits `companyId` must be strictly guarded by `requireSuperAdmin(req)`.
4. **No Direct Impersonation by Default**: Bypassing credentials to generate a tenant session creates massive compliance risks.

---

## 23. Performance, Caching & Scalability Analysis

1. **Dashboard Aggregations**: The current `PlatformDashboardService.getTelemetry` executes fast counts because PostgreSQL indexed scans are utilized. As tenant count exceeds thousands, `COUNT(*)` across millions of leads will slow down. Future optimization should cache telemetry in Redis or a 60-second in-memory stale-while-revalidate cache.
2. **Global User Search**: Querying `users` across all tenants by email or name requires indexing. `prisma.schema` currently has `@@index([companyId])` and `@@unique([companyId, email])`. A global composite index `@@index([email])` and `@@index([name])` should be added when `PlatformUserService` is implemented to ensure sub-10ms search times.
3. **Zero N+1 Queries**: All future platform endpoints must use Prisma `select`, `include`, or `_count` batches rather than looping through individual records.

---

## 24. Recommended Navigation Structure

```text
SUPER ADMIN CONSOLE
│
├── 1. Dashboard (/admin)
│   ├── Platform Health & Readiness Banner
│   ├── Clickable Fleet KPI Cards (Companies, Users, Leads, Teams)
│   ├── Clickable Plan Distribution Cards (Filtered Fleet Views)
│   └── Recent Administrative Actions Stream
│
├── 2. Companies (/admin/companies)
│   ├── Fleet Table with Search, Status, Plan, and Sort Filters
│   ├── Provision New Organization (/admin/companies/new)
│   └── Company Detail Workspace (/admin/companies/[id])
│       ├── Overview Tab
│       ├── Users Tab (Company User Roster)
│       ├── Leads & Pipeline Tab
│       ├── Usage & Quotas Tab
│       ├── Activity & Tasks Tab
│       ├── Security & Sessions Tab
│       └── Platform Audit Trail Tab
│
├── 3. Users (/admin/users) [NEW]
│   ├── Cross-Tenant User Search & Status Filters
│   ├── Global Users Table
│   └── User Detail Inspector (/admin/users/[id])
│       ├── Identity & Contact Profile
│       ├── Account Lifecycle & Invitation History
│       ├── Access & RBAC Scope
│       ├── Active Sessions & Device Inspector
│       └── Recent Activity Stream
│
├── 4. Plans & Quotas (/admin/plans)
│   ├── Subscription Tiers Grid
│   ├── Clickable Subscriber Counts (→ Filtered Companies)
│   └── Edit Limits, Quotas & Feature Flags Modal
│
├── 5. Platform Audit (/admin/audit-logs)
│   ├── Immutable Platform Audit Log Table
│   ├── Action & Target Search
│   ├── Entity Deep Links (→ Company Detail, User Detail)
│   └── Before / After JSON State Inspector Modal
│
└── 6. Security (/admin/security)
    ├── Super Admin Profile & Identity
    ├── Credential & Password Management
    ├── Active Platform Sessions & Revocation
    └── Platform Fleet Security Health (Suspensions & Lockouts)
```

---

## 25. Complete Feature Matrix

| Feature | Exists | Partial | Missing | Needs DB | Needs API | Needs UI | Priority |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Company Fleet Table** | ✅ | | | No | No | No | Locked |
| **Company Provisioning** | ✅ | | | No | No | No | Locked |
| **Company Suspension & Purge** | ✅ | | | No | No | No | Locked |
| **Plan Quota Management** | ✅ | | | No | No | No | Locked |
| **Platform Audit Logs** | ✅ | | | No | No | No | Locked |
| **Super Admin Sessions & Password**| ✅ | | | No | No | No | Locked |
| **Clickable Dashboard Cards** | | ✅ | | No | No | Yes | **P0 (Phase A)** |
| **Company Detail Tabs** | | ✅ | | No | No | Yes | **P0 (Phase B)** |
| **Company Users Tab** | | | ✅ | No | Yes | Yes | **P0 (Phase B)** |
| **Company Profile Edit API/UI** | | | ✅ | No | Yes | Yes | **P1 (Phase D)** |
| **Global Users List View** | | | ✅ | No | Yes | Yes | **P0 (Phase C)** |
| **User Detail View (`/admin/users/[id]`)**| | | ✅ | No | Yes | Yes | **P0 (Phase C)** |
| **Tenant Session Revocation by Admin**| | | ✅ | No | Yes | Yes | **P1 (Phase F)** |
| **Super Admin Profile Edit** | | ✅ | | No | Yes | Yes | **P2 (Phase D)** |
| **Revenue / MRR Breakdown** | | | ✅ | Yes | Yes | Yes | **P3 (Future V1.2)** |
| **Storage Usage Tracking** | | | ✅ | Yes | Yes | Yes | **P3 (Future V1.2)** |
| **Impersonation Support** | | | ✅ | Yes | Yes | Yes | **Excluded (Deferred)** |

---

## 26. Impersonation Policy & Security Threat Model

### 26.1 Policy: NO IMPERSONATION BY DEFAULT
We explicitly recommend **AGAINST** implementing automated tenant impersonation in V1.1.

### 26.2 Security Risks
1. **Audit Contamination**: An action performed under impersonation could be mistaken for an action performed by the legitimate tenant user.
2. **Privilege Leakage**: Super Admin could accidentally trigger tenant webhooks, send customer emails, or mutate sales deals.
3. **Session Hijacking Surface**: An endpoint that mints arbitrary tenant session cookies without password verification is a prime target for high-severity vulnerabilities.

### 26.3 If Impersonation Is Ever Required in the Future:
It must strictly adhere to:
- Time-bounded tokens (maximum 15 minutes).
- Read-only impersonation mode (mutations strictly forbidden).
- High-visibility amber banner fixed across the viewport: *"IMPERSONATING USER [EMAIL] — AUDIT ACTIVE"*.
- Mandatory reason prompt before starting, logged in `PlatformAuditLog`.
- Instant kill-switch exit button.

---

## 27. Product Boundary: Platform Console vs. Tenant CRM

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STRICT PRODUCT BOUNDARY                            │
├──────────────────────────────────────┬──────────────────────────────────────┤
│    SUPER ADMIN PLATFORM CONSOLE      │        TENANT CRM WORKSPACE          │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Tenant Fleet Management            │ • Lead Capture & Pipeline Stages     │
│ • Account Provisioning & Suspension  │ • Lead Assignment & Reassignment     │
│ • Quota & Plan Capacity Boundaries   │ • Sales Follow-ups & Due Dates       │
│ • Cross-tenant User Directory        │ • Multichannel Activities (Calls/WA) │
│ • Cross-tenant Security Health       │ • Notes & Interaction Timelines      │
│ • Cross-tenant Platform Audit Trail  │ • Custom Fields & Data Configuration │
│ • Infrastructure & Health Telemetry  │ • Team Leaderboards & Sales Reports  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```
**Rule**: Super Admin does NOT create leads, close sales deals, or manage daily CRM tasks. Super Admin monitors fleet health, governs capacity, and supports tenant administrators.

---

## 28. Future V1.1 Phased Implementation Plan

### Phase A: Navigation & Dashboard Drill-Downs (UI & Linkage)
- Update `components/admin/admin-nav.tsx` to include `Users` (`/admin/users`).
- Make all Dashboard KPI cards clickable entry points with query parameters.
- Make Plan distribution badges link to filtered company lists (`/admin/companies?planTier=TIER`).
- Update `/admin/companies` to read URL query params (`status`, `planTier`, `search`) on initial mount.

### Phase B: Company Detail Workspace & Company Users (Backend + Frontend)
- Refactor `/admin/companies/[id]` into a tabbed workspace (Overview, Users, Leads, Usage, Activity, Security, Audit).
- Implement `GET /api/v1/admin/companies/[id]/users` in `PlatformCompanyService`.
- Build the Company Users table with search, role badges, and status indicators.

### Phase C: Global Platform Users & User Detail View (Backend + Frontend)
- Create `PlatformUserService` for cross-tenant user lookups.
- Implement `GET /api/v1/admin/users` and `/admin/users/page.tsx`.
- Implement `GET /api/v1/admin/users/[id]` and `/admin/users/[id]/page.tsx`.
- Display account lifecycle, active sessions, and recent CRM activity.

### Phase D: Company Profile Editing & Super Admin Settings (Backend + Frontend)
- Implement `PATCH /api/v1/admin/companies/[id]` for company configuration.
- Implement `PATCH /api/v1/admin/auth/me` for Super Admin name updates.
- Provide edit dialog on Company Detail overview.

### Phase E: Lead Breakdown & Deep Usage Telemetry (Backend + Frontend)
- Add status and source aggregations to Company Detail Leads tab.
- Add over-quota warnings and capacity metrics across plans.

### Phase F: Platform Security Enhancements & Session Controls (Backend + Frontend)
- Implement `DELETE /api/v1/admin/users/[id]/sessions` for targeted user session revocation.
- Implement emergency `DELETE /api/v1/admin/companies/[id]/sessions` for tenant-wide revocation.
- Add platform-wide security health tab in `/admin/security`.

### Phase G: Quality Gates, E2E Testing & Documentation
- Automated unit and integration tests for all new platform endpoints.
- Spectator adversarial test suite verifying isolation invariants.
- Update memory and guides (`SUPER_ADMIN_GUIDE.md`, `API_GUIDE.md`).

---

## 29. Future V1.2+ Considerations

1. **Financial & Billing Integration**: Add Stripe or invoicing provider synchronization with `Plan` pricing and MRR metrics.
2. **File Storage & Attachment Governance**: Track uploaded file sizes per tenant against storage quotas.
3. **Advanced Platform RBAC**: Introduce sub-roles for Super Admin (e.g. `SUPPORT_SPECIALIST`, `BILLING_ADMIN`, `SECURITY_AUDITOR`).
4. **Data Retention & Purge Automation**: Automated deletion policies for soft-deleted leads and expired audit logs.

---

## 30. What Must NOT Be Changed

To protect existing locked slices and avoid breaking architectural invariants:
1. **DO NOT touch `AuthContext`**: Do not add optional `companyId` or allow Super Admin to reuse tenant auth context.
2. **DO NOT change cookie names**: Keep `universal_crm_session` and `universal_crm_superadmin_session` completely separate.
3. **DO NOT modify tenant routes**: `/app/*` and `/api/v1/*` (non-admin) must remain untouched.
4. **DO NOT bypass soft-delete logic**: Leads and users must continue using `deletedAt: null` filtering.
5. **DO NOT alter quota enforcement logic**: `QuotaService` rules must remain strictly enforced on lead and user creation.

---

## 31. Memory & Agent Updates Recommended

### In `docs/memory/PROJECT_STATE.md`:
- Note the completion of this Platform Review & Gap Analysis for Super Admin V1.1.
- List the blueprint document `docs/SUPER_ADMIN_PLATFORM_REVIEW_AND_V1_1_PLAN.md` as the specification for V1.1.

### In `docs/memory/NEXT_TASK.md`:
- Propose starting Phase A of V1.1 upon user authorization.

### In `docs/memory/ADMIN_STATE.md`:
- Document the 6-item primary navigation architecture and workspace tab patterns.

---

## 32. Definition of Done for V1.1 Super Admin

When V1.1 development is authorized, it will be complete only when:
1. All 6 primary navigation routes are accessible and visually consistent.
2. All dashboard KPI cards navigate to filtered, populated views with zero broken links.
3. Super Admin can search for any user across the platform and view complete user details without sensitive credential exposure.
4. Company Detail functions as a complete 7-tab command center.
5. Company profile information can be edited and verified via audit logs.
6. Target user and company session revocation works reliably.
7. 100% of new platform endpoints have automated unit, integration, and security tests.
8. Clean production build with 0 TypeScript and ESLint errors.
