# Universal CRM — Changelog & Vertical Slice History

All notable technical achievements, architectural deliverables, security mechanisms, and verification milestones in Universal CRM are documented in this file.

---

## [V1.1 Phase 6] — Primary Create Enquiry Workflow, Offerings & Pricing Engine (2026-09-18)

### Added
- **Offerings Catalog (Products & Services)**:
  - Database schema: `Offering` model (`PRODUCT` / `SERVICE`) with `name`, `code`, `description`, `defaultPrice` (Prisma Decimal), `currency`, `isActive`, `allowSalesPriceOverride`, composite unique constraint `[companyId, code]`, and soft delete.
  - Migration `20260918120000_phase6_offerings_and_enquiry_pricing` applied and permissions backfilled across system roles.
  - `OfferingService` (`lib/services/offering.service.ts`): tenant-isolated catalog management with audit logging.
  - REST endpoints: `GET/POST /api/v1/offerings` and `GET/PATCH/DELETE /api/v1/offerings/[id]`.
  - Admin UI: Products & Services catalog workspace (`/app/settings/offerings`) with modal creation/editing and settings navigation integration.
- **Server-Side Price Override Engine (Zero Client Trust)**:
  - Extended `Company`: `allowSalesPriceOverride`, `customerDirectoryVisibility`, `createEnquiryHistoryEnabled`, `historyPreviewFields`.
  - Extended `Lead`: `offeringId`, `defaultPriceAtCreation`, `quotedPrice`, `priceOverridden`, `priceOverrideReason`, `priceUpdatedById`, `priceUpdatedAt`.
  - Server-side authorization in `LeadService.createLead` and `LeadService.updateLead`:
    - Validates offering belongs to tenant and is active.
    - If quoted price deviates from default price, verifies both tenant and offering allow overrides.
    - Non-admin agents cannot bypass price locks via client payload tampering (throws `ForbiddenError`).
    - Dedicated audit entry generated (`lead.price_overridden`) recording original price, final quoted price, and reason.
- **Admin Customer Visibility & Customer History Preview Governance**:
  - `customerDirectoryVisibility`: `"COMPANY"` vs `"DATA_SCOPE"`. Enforced in `CustomerService.listCustomers` so agents with `OWN` scope only see customers linked to their assigned leads.
  - `CustomerService.getCustomerHistoryPreview` & API `GET /api/v1/customers/[id]/history-preview`:
    - Checks tenant toggle `createEnquiryHistoryEnabled`.
    - Server-side Data Scope filter (`getLeadDataScopeWhere(ctx, "view")`): agents only receive prior enquiries assigned to them.
    - Strips internal notes, private remarks, and unconfigured preview fields server-side.
- **Primary "Create Enquiry" Guided Workflow UI**:
  - `CreateEnquiryForm` (`components/leads/create-enquiry-form.tsx`) and dedicated page (`/app/leads/new`).
  - Fast, guided flow: Phone input → Live customer resolution → Customer recognized card → Sanitized expandable history preview → Offering selector → Locked vs Permitted Quoted Price input with reason → Dynamic custom fields → User & team assignment.
  - Quick access "Create Enquiry" button added to `/app/leads`.
- **Atomic Transactions & Golden Invariants**:
  - Single `prisma.$transaction` creates Customer + CustomerPhone + CustomerEmail + Lead when customer is new. 0 orphan records on failure.
  - Supplying `customerId = A` with phone belonging to `Customer B` is strictly rejected with `ConflictError` (HTTP 409).
  - Invariant `ONE CUSTOMER ≠ ONE ENQUIRY` strictly upheld: repeat enquiries never overwrite prior enquiries.
- **Automated Verification Suite (`tests/phase6-create-enquiry-offering.test.ts`)**:
  - 12 comprehensive security, pricing, customer resolution, transaction rollback, and history preview tests.
  - Master test runner (`tests/run-all.ts`): All 39 master test suites pass in 25.23s.
  - TypeScript (0 errors) and ESLint (0 errors) verified.

---

## [V1.1 Phase 5] — Customer CRUD, Permissions, Contact Management & Data Scope (2026-09-18)

### Added
- **Dedicated CustomerService (`lib/services/customer.service.ts`)**:
  - `listCustomers`: High-performance indexed pagination, search by customer name, companyName, normalized phone, and email address. Soft-delete exclusion by default.
  - `getCustomerById`: Deep customer profile hydration including multiple phone and email channels, and **Data-Scope-enforced enquiry summary**. Sales Reps with `OWN` scope only receive their assigned enquiries. Foreign enquiries are completely redacted.
  - `createCustomer`: Transactional creation of Customer, primary phone (normalized E.164), and primary email. Strict duplicate phone rejection via `ConflictError`. Audit log emission.
  - `updateCustomer`: Validation and mutation of `name`, `displayName`, `companyName`, `notes` with audit trail diffs.
  - `softDeleteCustomer`: Non-destructive soft deletion (`deletedAt = now()`). Enforces the golden invariant: `ONE CUSTOMER ≠ ONE ENQUIRY`. All linked historical enquiries, activities, tasks, and custom field values are preserved intact.
  - Contact Management: `addPhone`, `updatePhone`, `removePhone`, `addEmail`, `updateEmail`, `removeEmail`. Automatic primary promotion ensures contact records never enter an invalid primary state.
- **REST API Suite (`app/api/v1/customers/*`)**:
  - `GET /api/v1/customers`: Paginated customer directory with search and filtering.
  - `POST /api/v1/customers`: Transactional customer creation.
  - `GET /api/v1/customers/[id]`: Customer detail with data-scope-filtered enquiry history.
  - `PATCH /api/v1/customers/[id]`: Identity field updates.
  - `DELETE /api/v1/customers/[id]`: Customer soft-deletion with history preservation.
  - `POST /api/v1/customers/[id]/phones`: Add phone with E.164 normalization & tenant duplicate protection.
  - `PATCH /api/v1/customers/[id]/phones/[phoneId]`: Make primary, change phone type.
  - `DELETE /api/v1/customers/[id]/phones/[phoneId]`: Remove phone with auto-primary promotion.
  - `POST /api/v1/customers/[id]/emails`: Add email with duplicate protection.
  - `PATCH /api/v1/customers/[id]/emails/[emailId]`: Make primary, change email type.
  - `DELETE /api/v1/customers/[id]/emails/[emailId]`: Remove email with auto-primary promotion.
  - `GET /api/v1/customers/resolve`: Real-time phone normalization and identity matching.
- **RBAC Role & Permission Integration**:
  - Registered `customers` module in `SYSTEM_MODULES` (`lib/services/role.service.ts`).
  - Added permissions: `customers.view`, `customers.create`, `customers.update`, `customers.delete`, `customers.manage`.
  - Additive database migration `20260918113000_customer_permissions` successfully deployed and backfilled to all existing roles.
- **Customer Workspace UI**:
  - Navigation: Added "Customers" to persistent header (`components/leads/lead-nav.tsx`).
  - Directory (`/app/customers`): High-density directory component (`CustomerList`) with search, pagination, primary contact pills, and enquiry badges.
  - Detail Profile (`/app/customers/[id]`): Workspace component (`CustomerDetail`) with identity cards, multi-phone and multi-email management drawers, and authorized enquiry history table.
- **Automated Verification Suite (`tests/customer-crud-security.test.ts`)**:
  - 10 comprehensive security, CRUD, RBAC, IDOR, Data Scope, and soft-delete tests.
  - Integrated into master test runner (`tests/run-all.ts`).
  - Master test suite passing 38/38 suites (100% pass across Slices 1–8 and Phases 1–5).

---

## [Slice 8] — Super Admin Platform Console / Tenant Operations / Subscriptions (2026-09-17)

### Added
- **Architectural Boundary Separation**: Complete isolation between Super Admin and Tenant layers:
  - Super Admin models (`SuperAdmin`, `SuperAdminSession`, `Plan`, `PlatformAuditLog`) completely decoupled from `companyId`.
  - Dedicated cookie name: `universal_crm_superadmin_session` with HttpOnly, SameSite=Lax, and Secure flags.
  - Dedicated authentication & context resolver (`lib/auth/super-admin-session.ts`).
  - Middleware route defense in `middleware.ts`: `/admin/*` and `/api/v1/admin/*` require super admin session; `/admin/login` and `/api/v1/admin/auth/login` are public. Tenant sessions cannot access admin routes; super admin sessions cannot access tenant `/app/*`.
- **Tenant Lifecycle Operations**:
  - Provisioning: Transactional provisioning of new tenants with company profile, default lead statuses, sources, initial system roles, plan assignment, and initial administrator invite.
  - Immediate Session Purge on Suspension: Atomic transaction setting `Company.status = SUSPENDED`, purging all active tenant sessions (`prisma.session.deleteMany({ where: { companyId } })`), and logging platform audit entry.
  - Reactivation: Restoring company status to `ACTIVE` with audit logging.
- **Subscription & Quota Management**:
  - Plans: 4 standard tiers (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`) with configurable user limits, lead limits, and feature flags.
  - Plan assignment: Immediate quota adjustment across tenants.
  - Quota Service: Runtime quota enforcement (`QuotaService.assertCanCreateUser`, `assertCanCreateLead`) rejecting over-limit operations with HTTP 402/400 `QUOTA_EXCEEDED`.
- **Platform Telemetry & Audit Logs**:
  - Overview Telemetry: Zero N+1 aggregation computing total tenants, active/suspended tenants, total platform users, leads, activities, plan distribution, and storage utilization.
  - Append-Only Platform Audit Logs: Dedicated cross-tenant logging system (`PlatformAuditLog`) capturing all platform operations with super admin actor, action, target entity, metadata, IP address, and user agent.
- **Super Admin Frontend Console (`/admin`)**:
  - `/admin/login`: High-contrast, security-hardened authentication portal with rate-limiting and quick-fill test credentials.
  - `/admin`: Platform overview dashboard with telemetry cards, plan distribution breakdown, quick provisioning links, and recent platform audit feed.
  - `/admin/companies`: Tenant directory with live search, status filter, plan filter, pagination, and direct actions (view details, suspend, reactivate).
  - `/admin/companies/new`: Provisioning workspace with step-by-step company profile, plan selection, and initial admin details.
  - `/admin/companies/[id]`: Deep tenant detail workspace displaying company stats, user count vs plan limit progress bars, lead counts, status toggles, plan switcher, and tenant audit timeline.
  - `/admin/plans`: Subscription plan catalog with tier indicators, user/lead quotas, and plan configuration editor.
  - `/admin/audit-logs`: Platform audit log explorer with action/entity/date filters and JSON metadata drawer.
  - `/admin/security`: Super admin self-service security workspace with active session viewer, individual session termination, bulk session revocation, and password change form.
- **API Suite (`/api/v1/admin/*`)**:
  - Auth: `POST /login`, `POST /logout`, `GET /me`, `POST /change-password`, `GET /sessions`, `DELETE /sessions/:id`, `POST /sessions/revoke-all`.
  - Dashboard: `GET /dashboard/overview`.
  - Companies: `GET /companies`, `POST /companies`, `GET /companies/:id`, `POST /companies/:id/suspend`, `POST /companies/:id/reactivate`, `PATCH /companies/:id/plan`.
  - Plans: `GET /plans`, `GET /plans/:id`, `PATCH /plans/:id`.
  - Audit Logs: `GET /audit-logs`.

### Security & Verification
- Unit test suite (`tests/super-admin-unit.test.ts`): 100% pass.
- Integration test suite (`tests/super-admin-integration.test.ts`): 100% pass.
- Security & Boundary test suite (`tests/super-admin-security.test.ts`): 100% pass.
- Full Master Test Runner (`tests/run-all.ts` across Slices 1–8): 100% pass (32 suites).
- Live HTTP E2E Test Suite (`tests/http-e2e.test.ts`): 100% pass across all live endpoints.
- Quality Gates: TypeScript (0 errors), ESLint (0 errors/warnings), Production Build (code 0, 56 routes compiled), Health & Readiness (200 OK).

---

## [Slice 7.5] — Documentation System & In-App Help Center (2026-09-17)

### Added
- **In-App Help Center (`/app/help`)**: Lightweight, fast knowledge base featuring real-time keyword search, category sidebar, responsive reader, and tag indexing.
- **Role-Aware Visibility**: Administrative help categories (Users & Teams, Roles & Permissions, Company Settings, Audit Logs) are strictly hidden from non-admin users.
- **Contextual Help Links**: Added unobtrusive `?` help links across User Management, Teams, Roles, Company Settings, Security, Audit Logs, Custom Fields, Lead Import, Leads List, Follow-ups, and Dashboard.
- **14 In-App Markdown Guides (`docs/help/`)**: Complete guides for getting started, leads, activities, follow-ups, analytics, import/export, custom fields, users, teams, roles, company settings, security, audit logs, and FAQ.
- **Master Engineering Documentation Library (`docs/`)**:
  - `docs/INDEX.md`: Master documentation hub.
  - `docs/USER_GUIDE.md`: Comprehensive manual for CRM users.
  - `docs/ADMIN_GUIDE.md`: Comprehensive manual for company administrators and managers.
  - `docs/SUPER_ADMIN_GUIDE.md`: Platform console operations (*clearly designated PLANNED / NOT YET IMPLEMENTED for Slice 8*).
  - `docs/SYSTEM_ARCHITECTURE.md`: Architecture blueprint and security invariants.
  - `docs/SECURITY_OPERATIONS.md`: Cryptographic and multi-tenant security manual.
  - `docs/TROUBLESHOOTING.md`: Operational diagnostics and step-by-step resolution playbooks.
  - `docs/DEPLOYMENT_GUIDE.md`: Production deployment guide for Linux, Next.js, PostgreSQL, and Nginx.
  - `docs/API_GUIDE.md`: REST API reference across all active endpoints.
  - `docs/DATABASE_GUIDE.md`: Prisma relational schema and indexing strategy.
  - `docs/memory/DOCUMENTATION_STATE.md`: Documentation state and coverage tracking.
  - `docs/DOCUMENTATION_COMPLETION_REPORT.md`: Audit report for Slice 7.5.

---

## [Slice 7] — User & Team Management + Settings (2026-09-17)

### Added
- **User Management Workspace (`/app/settings/users`)**: Search, role/status/team filters, pagination, user profile views, allowlisted updates, status activation/deactivation, and admin password reset.
- **User Invitations**: 7-day single-use 32-byte secure crypto tokens, hashed with SHA-256 in DB, email dispatch via `EmailService`, public acceptance route at `/app/invite/[token]` and `/invite/[token]` (password creation, user activation, team joining, auto-login with session cookie).
- **Team Management Workspace (`/app/settings/teams`)**: Team creation, editing, archiving, manager assignment, and direct member roster management (`team_members` junction).
- **Role & Permission Matrix (`/app/settings/roles`)**: 5 immutable system roles + custom role builder with module-action permission grid, data scopes (`OWN`, `TEAM`, `COMPANY`), privilege escalation guards, and tamper protection.
- **Company Settings (`/app/settings/company`)**: Organization branding, logo, support contact, timezone, currency, and date format.
- **Security & Session Workspace (`/app/settings/security`)**: Self-service password updates, active DB session viewer, individual session termination, and "Sign Out All Other Devices" bulk revocation.
- **Audit Log Explorer (`/app/settings/audit-logs`)**: Append-only, tenant-isolated audit log viewer with action/entity/user/date filters and JSON metadata inspector.

### Security & Verification
- Admin self-lockout guard (administrators cannot deactivate their own account or remove their own admin role).
- Immediate session purge on user deactivation or password reset.
- Verification: 29 master test suites passing in 9.02s, live HTTP E2E passing, Next.js build clean with 0 errors (48/48 routes).

---

## [Slice 6] — Reports & Analytics Dashboard (2026-09-16)

### Added
- **Executive Dashboard (`/app`)**: 6 KPI summary cards with zero-safe period-over-period percentage comparisons.
- **Interactive SVG Trend Chart**: Responsive area/line chart with dynamic time bucketing (`day`, `week`, `month`) and zero-baseline rendering without heavy external chart libraries.
- **Distribution & Funnel Cards**: Dynamic pipeline status distribution, acquisition source channels, pipeline funnel overview (Active, Won, Lost, win rate, average deal size), multichannel activity tracking, and follow-up health metrics.
- **Team Leaderboard**: Agent performance table computed via batched Prisma `groupBy` queries with zero N+1 database calls.
- **Formula-Safe CSV Export**: Report CSV export with formula injection defense (`GET /api/v1/analytics/export`).

### Security & Verification
- Strict data scoping enforced on analytics queries (`OWN` for Reps, `TEAM` for Managers, `COMPANY` for Admins).
- Soft-deleted leads strictly excluded from counts, trendlines, and funnels.
- 25 master test suites passing, live HTTP tests passing, Next.js build clean.

---

## [Slice 5] — Lead Import / Export + Custom Fields (2026-09-15)

### Added
- **Dynamic Custom Fields**: 11 normalized field types (`TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `URL`, `EMAIL`, `PHONE`), runtime value validation, atomic reordering, soft deletion, and settings workspace (`/app/settings/custom-fields`).
- **RFC 4180 CSV Engine**: Pure TypeScript streaming parser with zero external dependencies.
- **Lead CSV Import**: Auto-mapping heuristics, preview endpoint, 100-row batch transactions, in-memory reference preloading, duplicate policies (`SKIP`, `UPDATE`, `CREATE`), error CSV download.
- **Lead CSV Export**: Data-scope-aware lead export with spreadsheet formula injection protection.

### Security & Verification
- Client-supplied `companyId` in CSV files strictly ignored.
- 21 master test suites passing, live HTTP E2E tests passing, Next.js build clean.

---

## [Slice 4] — Activities & Follow-ups (2026-09-14)

### Added
- **Multi-channel Activities**: Logging Calls, WhatsApp, Emails, Notes, and Meetings with duration, outcome, and metadata.
- **Interactive Lead Timeline**: Filterable chronological feed on lead detail view.
- **Follow-up Tasks Workspace (`/app/follow-ups`)**: High-density task queue with status tabs (`Today`, `Overdue`, `Upcoming`, `Completed`), priority badges, and quick one-click completion.

### Security & Verification
- Cross-tenant activity IDOR blocked. Task completion mediated strictly via server-side session.
- 16 master test suites passing, live HTTP E2E passing.

---

## [Slice 3] — Lead Management Core (2026-09-13)

### Added
- **Lead CRUD APIs & Workspace (`/app/leads`)**: Creation, editing, status transitions, reassignments, search, and soft deletion (`deletedAt`).
- **Dynamic Data-Scope Engine**: `OWN` (Sales Rep), `TEAM` (Manager), `COMPANY` (Admin) without hardcoded role strings.
- **Immutable History**: Automated `LeadStatusHistory` and `LeadAssignmentHistory` recording on every transition.

### Security & Verification
- Strict tenant isolation (`companyId: ctx.company.id`). Cross-tenant read, update, and delete IDOR blocked with 404.
- 8 master test suites passing, live HTTP E2E passing.

---

## [Slice 2] — Authentication & Multi-Tenancy Engine + RBAC (2026-09-12)

### Added
- **Database-Backed Sessions**: 32-byte crypto tokens, SHA-256 database hashing, HTTP-only SameSite=Lax cookies, 24-hour expiration, instantaneous revocation.
- **Multi-Tenant Identity Context (`AuthContext`)**: User -> Company -> Role -> Permissions -> DataScope.
- **Edge Route Protection**: Middleware protecting `/app/*` and `/admin/*`.
- **Auth UI**: Modern responsive cards for `/login`, `/forgot-password`, `/reset-password`.

### Security & Verification
- Immediate lockout on `DISABLED` users or `SUSPENDED` companies.
- 4 master test suites passing, live HTTP E2E passing.

---

## [Slice 1] — Foundation & Core Infrastructure (2026-09-11)

### Added
- Next.js 16 App Router + Tailwind CSS v4 + PostgreSQL 16 + Prisma ORM.
- Complete V1 Prisma schema with 18 entities and tenant isolation.
- Standardized error hierarchy, logging, rate limiting, and email abstraction.
- `/health` and `/ready` probes.
