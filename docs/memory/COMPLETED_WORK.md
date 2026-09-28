[STATE]

# Completed Work

## Slice 1 — Foundation (Completed & Verified 2026-09-16)
- Next.js 16.3.5 App Router Setup, TypeScript strict mode, Tailwind CSS v4, shadcn/ui components.
- PostgreSQL 16 & Prisma 5.22 ORM: schema with 18 entities, initial migration applied, database seeded with Super Admin, 2 companies (Acme Corp, Zenith Solutions), and 100 leads.
- Core library: `db` singleton, `errors` hierarchy, structured `logger`, service abstractions (`email`, `storage`, `rate-limit`), utilities (`pagination`, `timezone`, `tokens`).
- Health (`/health`) and Readiness (`/ready`) endpoints verified.

## Slice 2 — Authentication & Multi-Tenancy Engine (Completed & Verified 2026-09-16)
### Deliverables
1. **Authentication API Endpoints (`/api/v1/auth/*`)**:
   - `POST /api/v1/auth/login`: IP and account rate limiting, password verification with bcrypt, account status verification (`DISABLED` / `INVITED` blocked), company status verification (`SUSPENDED` blocked), session creation, audit logging.
   - `POST /api/v1/auth/logout`: Database session deletion, session cookie clearing, audit logging.
   - `GET /api/v1/auth/me`: Authenticated user profile, company details, role, and granular permissions.
   - `POST /api/v1/auth/forgot-password`: Rate-limited, generic response (anti-enumeration), 1-hour single-use token, mock email delivery.
   - `POST /api/v1/auth/reset-password`: Single-use token enforcement, password strength validation, atomic password update + token invalidation, instant bulk session revocation.
2. **Session & Tenant Context Engine (`lib/auth/`)**:
   - `lib/auth/password.ts`: bcrypt hashing (12 rounds), password verification, strength rules.
   - `lib/auth/cookies.ts`: Secure, HttpOnly, SameSite=Lax cookie options and getters/setters.
   - `lib/auth/session.ts`: `createDbSession`, `validateSessionToken`, `revokeSessionByToken`, `revokeAllUserSessions`, `getAuthContext`, `requireAuth`, `requirePermission`.
   - `lib/auth/validation.ts`: Zod validation schemas for all inputs with normalization.
3. **Edge Middleware (`middleware.ts`)**:
   - Route protection for `/app/*` and `/admin/*`.
   - Redirects unauthenticated page requests to `/login?redirect=...`.
   - Returns 401 for unauthenticated API requests.
   - Injects standard security headers on all responses.
4. **Authentication Frontend UI (`app/(auth)/`)**:
   - `/login`: Form with email/password, loading state, error display, test account quick-fill badges.
   - `/forgot-password`: Request form with success notification.
   - `/reset-password`: Password update form with complexity validation.
   - `/app`: Minimal protected workspace verifying user identity, tenant context, and role permissions with a working Logout button.
5. **Testing & Spectator Verification**:
   - Unit tests (`tests/unit.test.ts`): Password hashing/verification, strength rules, token generation/hashing, Zod schemas.
   - Integration tests (`tests/integration.test.ts`): Seed credentials, active session creation/validation, session revocation, expired session rejection, disabled user lockout, suspended company lockout, reset token lifecycle, bulk session revocation.
   - Tenant security tests (`tests/tenant-security.test.ts`): Company A vs Company B isolation, server-side context authority, cross-tenant lead isolation, IDOR simulation prevention.
   - Spectator adversarial tests (`tests/spectator-adversarial.test.ts`): 9 independent attack scenarios disproving auth bypasses, session replays, and privilege escalations.
   - HTTP live runtime tests (`tests/http-e2e.test.ts`): 11 live HTTP assertions verifying status codes, cookie flags, redirects, and session revocation.

## Slice 3 — Lead Management Core (Completed & Verified 2026-09-16)
### Deliverables
1. **Lead Service & Backend Core (`lib/services/lead.service.ts`, `lib/auth/scope.ts`)**:
   - `listLeads`: Offset pagination (`paginatedResponse`), search across name/email/phone/company, filtering by status, source, priority, assignee, team, composite index sorting (`[companyId, createdAt(Desc)]`), soft-delete exclusion (`deletedAt: null`).
   - `getLeadById`: Strict tenant isolation, complete hydration of status, source, assignee, team, status histories, assignment histories, and activities. Returns 404 for foreign or soft-deleted leads.
   - `createLead`: Enforces `leads.create` permission, validates foreign keys belong to tenant, defaults status, atomic transaction creating lead, initial `LeadStatusHistory`, initial `LeadAssignmentHistory` (if assigned), `LEAD_CREATED` activity, and `lead.create` audit log.
   - `updateLead`: Enforces `leads.update` and `leads.assign`, detects status changes and creates `LeadStatusHistory` & `STATUS_CHANGED` activity, detects reassignments and creates `LeadAssignmentHistory` & `REASSIGNED` activity, updates `updatedAt`, logs `lead.update` audit entry.
   - `deleteLead`: Enforces `leads.delete`, soft-deletes (`deletedAt: new Date()`), logs `LEAD_DELETED` activity and `lead.delete` audit log.
   - `getLeadConfig`: Returns company-scoped statuses, sources, users, and teams.
   - `getLeadDataScopeWhere`: Centralized query generator enforcing `OWN` (`assignedUserId`), `TEAM` (`team_members`), `COMPANY`, and `PLATFORM` data scopes.
2. **Lead API Endpoints (`app/api/v1/leads/`)**:
   - `GET /api/v1/leads`: List leads with search, filters, pagination, and data scopes.
   - `POST /api/v1/leads`: Create new lead with tenant context binding.
   - `GET /api/v1/leads/[id]`: Detail route with history and timeline relations.
   - `PATCH /api/v1/leads/[id]`: Update route with change detection and history capture.
   - `DELETE /api/v1/leads/[id]`: Soft delete route.
   - `GET /api/v1/leads/config`: Dropdown options route.
3. **Frontend UI Components (`components/leads/`, `app/app/leads/`)**:
   - `lead-nav.tsx`: Persistent top navigation between Dashboard and Leads with tenant badge and user profile.
   - `lead-table.tsx`: High-density lead table with status badges, sources, assignees, priorities, deal values, and action menus.
   - `lead-filters.tsx`: Search input, status, source, and priority filter dropdowns with instant URL query synchronization.
   - `create-lead-dialog.tsx`: Modal form fetching tenant config and creating leads with validation feedback.
   - `edit-lead-dialog.tsx`: Modal form for updating lead details.
   - `delete-lead-dialog.tsx`: Confirmation modal for safe soft deletion.
   - `status-selector.tsx`: Inline status transition dropdown with immediate backend sync.
   - `assign-selector.tsx`: Inline reassignment dropdown with immediate backend sync.
   - `lead-history-timeline.tsx`: Interactive tabbed timeline rendering status history transitions, assignment transitions, and activity log entries.
   - `lead-pagination.tsx`: Server-side pagination controls with item counts.
   - `/app/leads`: Complete SSR Lead list view.
   - `/app/leads/[id]`: Complete SSR Lead detail view with overview cards and history timeline.
4. **Testing & Spectator Verification**:
   - Unit tests (`tests/lead-unit.test.ts`): 8 test cases validating input schemas, normalizations, and data scope where clauses.
   - Integration tests (`tests/lead-integration.test.ts`): CRUD lifecycle, auto-status assignment, initial history generation, status transition history, assignment history, timeline activity generation, search, filtering, and soft delete verification.
   - Tenant security & IDOR tests (`tests/lead-tenant-security.test.ts`): Cross-tenant read/update/delete IDOR rejected with 404; cross-tenant status/source/user/team injection rejected with ValidationError; mass assignment attacks defeated.
   - Spectator adversarial tests (`tests/lead-spectator.test.ts`): Sarah (Sales Rep) restricted to `OWN` scope; Manager restricted to `TEAM` scope; Admin seeing `COMPANY` scope; protected fields (`id`, `companyId`, `deletedAt`, `createdAt`) tamper resistance verified.
   - Live HTTP E2E runtime verification (`tests/http-e2e.test.ts`): Unauthenticated access rejected (401), config retrieval (200), lead creation (201), search & listing (200), detail fetch (200), update (200), SSR page render (200), soft delete (200), and deleted lookup (404).

## Slice 4 — Activities & Follow-ups (Completed & Verified 2026-09-16)
### Deliverables
1. **Database Schema Enhancements (`prisma/schema.prisma`)**:
   - `ActivityType` enum expanded: `CALL`, `WHATSAPP`, `EMAIL`, `NOTE`, `MEETING`, `TASK_CREATED`, `TASK_COMPLETED`, `TASK_CANCELLED`, `TASK_UPDATED`, `TASK_DELETED`.
   - `Task` model enriched with `createdById`, `completedById`, `teamId`, and explicit foreign key relations to `User` and `Team`.
   - Optimized composite indexes: `[companyId, leadId, createdAt(sort: Desc)]` on `Activity` and `[companyId, assignedUserId, dueAt]` on `Task`.
   - Applied via `npx prisma db push` and `npx prisma generate`.
2. **Activity & Follow-up Services (`lib/services/activity.service.ts`, `lib/services/follow-up.service.ts`, `lib/auth/scope.ts`)**:
   - `activity.service.ts`: `listActivitiesForLead`, `getActivityById`, `createActivity`, `updateActivity`, `deleteActivity` with lead data scope enforcement, strict tenant isolation, and audit logging (`ACTIVITY_CREATED`, `ACTIVITY_UPDATED`, `ACTIVITY_DELETED`).
   - `follow-up.service.ts`: `listFollowUps`, `getFollowUpById`, `createFollowUp`, `updateFollowUp`, `completeFollowUp`, `deleteFollowUp` with composite filtering (`dueFilter`, `priority`, `status`, `assignedUserId`), automated lead timeline activity generation (`TASK_CREATED`, `TASK_COMPLETED`, `TASK_CANCELLED`, `TASK_DELETED`), and audit logging.
   - `getTaskDataScopeWhere`: Dedicated helper in `lib/auth/scope.ts` enforcing `OWN` (`assignedUserId`), `TEAM` (`team_members`), and `COMPANY` task visibility.
3. **API Endpoints (`app/api/v1/`)**:
   - `GET /api/v1/leads/[id]/activities`: Paginated activity timeline for lead.
   - `POST /api/v1/leads/[id]/activities`: Log interaction on lead (Call, WhatsApp, Email, Note, Meeting).
   - `GET /api/v1/activities/[id]`: Detail view of specific activity.
   - `PATCH /api/v1/activities/[id]`: Update activity details.
   - `DELETE /api/v1/activities/[id]`: Delete activity.
   - `GET /api/v1/follow-ups`: Paginated workspace query with tab filters (`today`, `overdue`, `upcoming`, `completed`, `cancelled`).
   - `POST /api/v1/follow-ups`: Schedule follow-up with priority, assignee, due date/time, and optional lead association.
   - `GET /api/v1/follow-ups/[id]`: Detail view of follow-up task.
   - `PATCH /api/v1/follow-ups/[id]`: Update task details, priority, due date, or assignment.
   - `DELETE /api/v1/follow-ups/[id]`: Delete task with lead timeline notice.
   - `POST /api/v1/follow-ups/[id]/complete`: Quick-complete action recording actor attribution (`completedById`, `completedAt`).
4. **UI Components & Workspace (`components/leads/`, `components/follow-ups/`, `app/app/follow-ups/`)**:
   - `lead-history-timeline.tsx`: Extended timeline with custom iconography, color badges, and filter tabs (`All`, `Interactions`, `Status History`, `Assignment History`).
   - `log-activity-dialog.tsx`: Fast modal for logging Calls, WhatsApp messages, Emails, Notes, and Meetings.
   - `schedule-follow-up-dialog.tsx`: Modal for scheduling follow-up tasks with date/time pickers and priority flags.
   - `follow-up-workspace.tsx`: Production operational table with tabbed status filtering, live search, server-side pagination, priority indicators, and quick-complete controls.
   - `/app/follow-ups`: SSR page hosting the Follow-up Workspace.
   - Navigation links updated in `lead-nav.tsx` and `/app/page.tsx` for fast access to Follow-ups.
5. **Testing & Spectator Verification**:
   - Activity unit tests (`tests/activity-unit.test.ts`): Input validation, enum matching, pagination boundaries.
   - Activity integration tests (`tests/activity-integration.test.ts`): End-to-end activity logging across types, timeline ordering, metadata preservation.
   - Activity tenant security tests (`tests/activity-tenant-security.test.ts`): Cross-tenant activity query, injection, and update attempts safely rejected with 404.
   - Activity spectator tests (`tests/activity-spectator.test.ts`): Role-based data scopes verified (`OWN`, `TEAM`, `COMPANY`); Sales Rep restricted to assigned leads.
   - Follow-up unit tests (`tests/follow-up-unit.test.ts`): Date validation, priority enums, pagination boundaries.
   - Follow-up integration tests (`tests/follow-up-integration.test.ts`): Task scheduling, quick completion, cancellation, timeline sync.
   - Follow-up tenant security tests (`tests/follow-up-tenant-security.test.ts`): Cross-tenant task access, foreign lead/assignee injection blocked.
   - Follow-up spectator tests (`tests/follow-up-spectator.test.ts`): RBAC data scopes verified for follow-ups; tamper resistance on completedAt/companyId verified.
   - Live HTTP E2E tests (`tests/http-e2e.test.ts`): Full live server verification of activity logging, listing, follow-up scheduling, completion, and workspace rendering.

## Slice 5 — Lead Import / Export + Custom Fields (Completed & Verified 2026-09-16)
### Deliverables
1. **Database Schema Enhancements (`prisma/schema.prisma`)**:
   - `CustomFieldType` enum: `TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `URL`, `EMAIL`, `PHONE`.
   - `LeadImportStatus` enum: `PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`.
   - `CustomField` model: Tenant-isolated field definitions with composite unique constraint `[companyId, entityType, key]` and index `[companyId, sortOrder]`.
   - `CustomFieldValue` model: Normalized polymorphic storage with composite unique constraint `[companyId, customFieldId, entityId]` and index `[companyId, entityId]`.
   - `LeadImport` model: Tracks batch history, status, row counts (total, successful, skipped, updated, failed), and row-level error summaries.
   - Seeded permissions for `custom_fields` (`manage` for Admin, `view` for Manager & Rep) and `leads:export` for all roles.
2. **RFC 4180 CSV Engine & Utilities (`lib/utils/csv.ts`)**:
   - Pure TypeScript, zero-dependency streaming CSV parser handling quoted fields, commas, escaped quotes (`""`), and multiline cell values.
   - CSV serializer with formula injection sanitization (neutralizing `=`, `+`, `-`, `@`, `\t`, `\r` prefixes).
   - Column auto-mapping heuristics matching normalized CSV headers to core CRM fields and custom field keys/labels.
3. **Services (`lib/services/`)**:
   - `custom-field.service.ts`: `listCustomFields`, `getCustomFieldById`, `createCustomField`, `updateCustomField`, `deleteCustomField` (soft-delete), `reorderCustomFields`, `getLeadCustomFields`, and `saveLeadCustomFields` (supports transactions, checks required fields, and validates types/options).
   - `lead-import.service.ts`: `previewImport` (header detection, auto-mapping, sample rows), `executeImport` (chunked batching in 100-row transactions, preloaded caches to eliminate N+1 queries, duplicate strategies `SKIP`, `UPDATE`, `CREATE`, row-level error capture, audit logging), `listImports`, and `getImportById`.
   - `lead-export.service.ts`: `exportLeadsCsv` with strict data-scope enforcement (`OWN`, `TEAM`, `COMPANY`), soft-deleted exclusion, dynamic custom fields inclusion, formula injection escaping, and audit logging.
   - `lead.service.ts`: Extended with custom field hydration and persistence in `createLead`, `updateLead`, and `getLeadById`.
4. **API Endpoints (`app/api/v1/`)**:
   - `GET, POST /api/v1/custom-fields`
   - `GET, PATCH, DELETE /api/v1/custom-fields/[id]`
   - `POST /api/v1/custom-fields/reorder`
   - `GET, PATCH /api/v1/leads/[id]/custom-fields`
   - `POST /api/v1/leads/import/preview`
   - `POST /api/v1/leads/import`
   - `GET /api/v1/leads/imports`
   - `GET /api/v1/leads/imports/[id]`
   - `GET /api/v1/leads/export`
5. **UI Components & Workspaces**:
   - `custom-field-workspace.tsx` (`/app/settings/custom-fields`): Manage definitions, edit labels/types/options/required flags, soft-delete, and reorder.
   - `lead-custom-fields-input.tsx`: Dynamic form inputs embedded into `CreateLeadDialog` and `EditLeadDialog`.
   - `lead-custom-fields-card.tsx`: Formatted card on `/app/leads/[id]` displaying typed custom field values.
   - `lead-import-wizard.tsx` (`/app/leads/import`): 4-step wizard (Upload CSV, Map Columns, Choose Settings/Strategy, Result with Error CSV Download).
   - `lead-export-button.tsx`: Filter-preserving CSV download button embedded in `/app/leads`.
6. **Testing & Spectator Verification**:
   - Unit tests: `tests/custom-field-unit.test.ts`, `tests/lead-import-unit.test.ts` (100% pass).
   - Integration tests: `tests/custom-field-integration.test.ts`, `tests/lead-import-integration.test.ts` (100% pass).
   - Tenant security & IDOR tests: `tests/custom-field-tenant-security.test.ts`, `tests/lead-import-security.test.ts`, `tests/lead-export-security.test.ts` (100% pass).
   - Adversarial spectator tests: `tests/custom-field-spectator.test.ts`, `tests/lead-import-spectator.test.ts` (100% pass).
   - Master test runner (`tests/run-all.ts`): All 21 test suites passing in 5.11s.
   - Live HTTP E2E (`tests/http-e2e.test.ts`): Full live server verification of custom fields CRUD, lead attachment, export CSV, preview, import, history, and UI rendering.
   - Production Build: `npm run build` compiled 100% clean with 0 errors.

## Slice 6 — Reports & Analytics Dashboard (Completed & Verified 2026-09-16)
### Deliverables
1. **Analytics Engine Architecture (`lib/services/analytics/`)**:
   - `lib/services/analytics/types.ts`: TypeScript DTO definitions for date filters, KPIs, delta metrics, time-series trend points, dynamic status/source breakdowns, pipeline funnels, activity outreach, follow-up health, and team leaderboards.
   - `lib/services/analytics/date-range.ts`: UTC-safe date boundary generator supporting 9 preset ranges (`TODAY`, `YESTERDAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `LAST_MONTH`, `THIS_QUARTER`, `THIS_YEAR`, `CUSTOM`) and calculating the exact previous comparison period, along with zero-safe percentage delta math (`calculateChangePercent`).
   - `lib/services/analytics/leads.analytics.ts`: Leads overview metrics (Total, New, Converted, Conversion Rate with zero-safe math, Velocity) and continuous time-series trend bucketing (`day`, `week`, `month`) ensuring missing dates render as 0.
   - `lib/services/analytics/pipeline.analytics.ts`: Active, Won, Lost deals, win rate, total pipeline value, won revenue, lost deal value, and average deal size.
   - `lib/services/analytics/statuses.analytics.ts`: Tenant status distribution with counts, percentage share, and total pipeline value per status.
   - `lib/services/analytics/sources.analytics.ts`: Lead acquisition source distribution with counts, percentage share, and associated pipeline value.
   - `lib/services/analytics/activities.analytics.ts`: Multichannel engagement totals across Call, WhatsApp, Email, Meeting, and Note types.
   - `lib/services/analytics/followups.analytics.ts`: Follow-up task completion rate, created tasks, completed tasks, pending tasks, and overdue tasks.
   - `lib/services/analytics/team.analytics.ts`: Scoped team/agent performance metrics (Assigned Leads, Won Deals, Pipeline Value, Activities Logged, Follow-ups Completed, Conversion Rate) computed via batched Prisma `groupBy` queries with zero N+1 database hits.
   - `lib/services/analytics.service.ts`: Master service facade executing domain queries concurrently with `Promise.all` and generating formula-safe CSV report exports with audit logging.
   - `lib/auth/scope.ts`: Extended with `getReportsDataScope` and `getActivityDataScopeWhere` to enforce strict RBAC boundaries.
2. **API Endpoints (`app/api/v1/analytics/`)**:
   - `GET /api/v1/analytics/overview`: High-performance dashboard endpoint accepting `preset`, `startDate`, `endDate`, `teamId`, `userId`, validating permissions (`reports:view`), disabling caching (`Cache-Control: no-store`), and returning comprehensive JSON data.
   - `GET /api/v1/analytics/export`: Generates formula-sanitized CSV file downloads for `team_performance` or `pipeline_summary` with audit logging.
3. **Frontend UI Components & Dashboard (`components/analytics/`, `app/app/page.tsx`)**:
   - `components/analytics/kpi-card.tsx`: Metric card with colored delta pill, trend direction icon, and loading skeleton.
   - `components/analytics/date-range-picker.tsx`: Preset buttons, custom date range pickers, and live refresh trigger.
   - `components/analytics/lead-trend-chart.tsx`: Lightweight, dependency-free interactive SVG area/line chart with hover tooltips and dynamic date labels.
   - `components/analytics/status-breakdown-card.tsx`: Status distribution with colored bars, counts, and deal values.
   - `components/analytics/source-breakdown-card.tsx`: Lead sources ranked with share percentages and revenue.
   - `components/analytics/pipeline-overview-card.tsx`: Revenue summary, won/lost values, win rate, and funnel stage progress.
   - `components/analytics/team-performance-table.tsx`: Agent performance table with in-table search, conversion rates, and CSV export action.
   - `components/analytics/activity-breakdown-card.tsx`: Multichannel touchpoint breakdown cards.
   - `components/analytics/follow-up-health-card.tsx`: Task completion progress meter and overdue alert banner.
   - `components/analytics/analytics-dashboard.tsx`: Responsive client dashboard container with React 19 / Next.js lifecycle hooks, error retry, and unified `LeadNav`.
   - `app/app/page.tsx`: Replaced initial proof card with executive Reports & Analytics Dashboard workspace, retaining a collapsible Slice 2 session verification card for diagnostic transparency.
   - `app/app/dashboard/page.tsx`: Dedicated route alias redirecting to `/app`.
4. **Testing & Spectator Verification**:
   - Unit tests (`tests/analytics-unit.test.ts`): Date preset calculations, UTC boundaries, custom date validation (enforcing 730-day max), delta math with zero-division safety, Zod schema validation.
   - Integration tests (`tests/analytics-integration.test.ts`): Overview service, KPI metrics, status aggregations, source distributions, pipeline values, team leaderboard calculations, CSV exports.
   - Tenant security & IDOR tests (`tests/analytics-tenant-security.test.ts`): Acme Corp vs Zenith Solutions data isolation; foreign team and user filter IDOR attempts safely ignored or rejected.
   - Spectator adversarial tests (`tests/analytics-spectator.test.ts`): Sales Rep (`OWN`) vs Manager (`TEAM`) vs Admin (`COMPANY`) data scoping verified; soft-deleted leads excluded; spreadsheet formula injection sanitized; audit logs recorded.
   - Master test runner (`tests/run-all.ts`): All 25 test suites passing in 5.96s.
   - Live runtime E2E tests (`tests/http-e2e.test.ts`): Live API tests for overview, date filtering, data-scoped role views, CSV export, and SSR dashboard rendering.
   - Production Build: `npm run build` compiled 100% clean with 0 errors across 31 routes.

## Slice 7 — User & Team Management + Settings (Completed & Verified 2026-09-17)
### Deliverables
1. **Database Schema Enhancements**:
   - `Company`: Added `dateFormat` (default `"YYYY-MM-DD"`).
   - `Team`: Added `description`, `managerId`, foreign key relation to `manager User`, and index `[companyId, isActive]`.
   - `User`: Added relation `managedTeams Team[]`.
   - `Role`: Added `description`.
   - Applied cleanly via `npx prisma db push && npx prisma generate` and seeded.
2. **Validation Layer (`lib/validations/`)**:
   - `lib/validations/user.ts`: User query pagination/filters, profile updates, and admin password reset schemas.
   - `lib/validations/invitation.ts`: Secure invite and accept invitation schemas.
   - `lib/validations/team.ts`: Team create, update, member assignment, and query schemas.
   - `lib/validations/role.ts`: Custom role builder and module-action permission item schemas.
   - `lib/validations/company-settings.ts`: Organization profile and localization schemas.
   - `lib/validations/security.ts`: Current user password change schema.
3. **Backend Services Layer (`lib/services/`)**:
   - `lib/services/user.service.ts`: User list, get by ID, update, toggle status (`ACTIVE`/`DISABLED`), soft-delete, and admin password reset.
   - `lib/services/invitation.service.ts`: 32-byte crypto token generation, SHA-256 token hashing, single-use token lifecycle, public inspection, and acceptance flow with immediate active session creation.
   - `lib/services/team.service.ts`: Team list, detail, creation with automatic manager roster assignment, update, deletion with safe member unassignment, and member addition/removal.
   - `lib/services/role.service.ts`: System and custom role listing, role builder with permission matrix, role deletion with user-assignment guards, and privilege delegation security checks.
   - `lib/services/company-settings.service.ts`: Organization profile retrieval and update.
   - `lib/services/security.service.ts`: User session listing, individual session termination, bulk session revocation ("Sign Out All Other Devices"), and self password change.
   - `lib/services/audit-log.service.ts`: Immutable, tamper-proof audit trail listing with action, entity, user, date, and search filters.
4. **API Route Handlers (`app/api/v1/`)**:
   - Users: `/api/v1/users`, `/api/v1/users/invite`, `/api/v1/users/[id]`, `/api/v1/users/[id]/status`, `/api/v1/users/[id]/reset-password`.
   - Invitations: `/api/v1/invitations/[token]`, `/api/v1/invitations/accept`.
   - Teams: `/api/v1/teams`, `/api/v1/teams/[id]`, `/api/v1/teams/[id]/members`, `/api/v1/teams/[id]/members/[userId]`.
   - Roles: `/api/v1/roles`, `/api/v1/roles/[id]`, `/api/v1/permissions`.
   - Company: `/api/v1/company/settings`.
   - Security & Sessions: `/api/v1/security/sessions`, `/api/v1/security/sessions/[id]`, `/api/v1/security/sessions/revoke-all`, `/api/v1/security/change-password`.
   - Audit Logs: `/api/v1/audit-logs`.
5. **Frontend UI Workspaces & Pages**:
   - User Management: `/app/settings/users`, `/app/settings/users/[id]` with `UserWorkspace`, `InviteUserDialog`, `EditUserDialog`, `ResetUserPasswordDialog`, `UserStatusDialog`.
   - Team Management: `/app/settings/teams`, `/app/settings/teams/[id]` with `TeamWorkspace`, `TeamRoster`, `CreateTeamDialog`, `EditTeamDialog`, `AddTeamMemberDialog`.
   - Role Management: `/app/settings/roles` with `RoleWorkspace` and `RoleBuilderDialog`.
   - Company Settings: `/app/settings/company` with `CompanySettingsForm`.
   - Security & Sessions: `/app/settings/security` with `SecurityWorkspace`.
   - Audit Trail: `/app/settings/audit-logs` with `AuditLogWorkspace`.
   - Acceptance Flow: `/app/invite/[token]` and `/invite/[token]` with `AcceptInvitationView`.
   - Navigation: `SettingsNav` with active tabs across Users, Teams, Roles, Company, Custom Fields, Security, and Audit Logs.
6. **Testing & Quality Gates**:
   - `tests/user-team-unit.test.ts`: Zod schema validations, password strengths, SHA-256 token hashing.
   - `tests/user-team-integration.test.ts`: User CRUD, status transitions, invitation lifecycle, team roster management, custom roles, sessions, audit trail.
   - `tests/user-team-tenant-security.test.ts`: Cross-tenant IDOR attack prevention across users, teams, roles, audit logs, and entity injection attempts.
   - `tests/user-team-spectator.test.ts`: Sales Rep privilege escalation blocks, system role tamper resistance, self-deactivation guard, expired and corrupted invitation token defense.
   - Master test runner (`tests/run-all.ts`): All 29 suites passing in 9.02s.
   - Live HTTP E2E (`tests/http-e2e.test.ts`): Complete verification of live API endpoints and RBAC blocks.
   - TypeScript & ESLint: `tsc --noEmit` and `npx eslint --quiet` passing with 0 errors.
   - Production Build: `npm run build` compiled 100% clean across 48 routes.

## Slice 7.5 — Documentation System & In-App Help Center (Completed & Verified 2026-09-17)
### Deliverables
1. **In-App Help Center (`/app/help`)**:
   - High-performance knowledge base with category sidebar, real-time client-side search across guide titles/summaries/tags, and markdown viewer.
   - 14 complete in-app guides (`docs/help/*.md`): Getting Started, Lead Management, Activities & Interactions, Follow-ups, Reports & Analytics, Lead Import & Export, Custom Fields, User Management, Team Management, Roles & Permissions, Company Settings, Security & Active Sessions, Audit Logs, and FAQ & Troubleshooting.
   - Role-aware category security: Sensitive admin categories are filtered out for standard users.
2. **Contextual Help Deep Links**:
   - Integrated help button (`?`) across 11 key operational views: User Management, Teams, Roles, Company Settings, Security, Audit Logs, Custom Fields, CSV Import, Leads List, Follow-up Workspace, Dashboard.
3. **Master Technical Documentation Suite (`docs/`)**:
   - `INDEX.md`, `USER_GUIDE.md`, `ADMIN_GUIDE.md`, `SUPER_ADMIN_GUIDE.md`, `SYSTEM_ARCHITECTURE.md`, `SECURITY_OPERATIONS.md`, `TROUBLESHOOTING.md`, `DEPLOYMENT_GUIDE.md`, `API_GUIDE.md`, `DATABASE_GUIDE.md`, `CHANGELOG.md`, `DOCUMENTATION_STATE.md`, `DOCUMENTATION_COMPLETION_REPORT.md`.
4. **Verification & Quality Gates**:
   - Master test runner: 29 suites passing.
   - Live HTTP runtime E2E test verifying `/app/help` markdown retrieval and access control.
   - Production Build: 49 routes compiled clean.

## Slice 8 — Super Admin Platform Console / Tenant Operations / Subscriptions (Completed & Verified 2026-09-17)
### Deliverables
1. **Database Schema Enhancements**:
   - `SuperAdmin`: Added `isActive`, `lastLoginAt`, `deletedAt`, relations to `sessions` and `platformAuditLogs`.
   - `SuperAdminSession`: Token hash (SHA-256), expiration, IP, user agent.
   - `PlanTier` Enum (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`).
   - `Plan`: Relational model with `maxUsers`, `maxLeads`, `maxStorageMb`, `features` (Json).
   - `Company`: Foreign key `planId` referencing `Plan`, indexed.
   - `PlatformAuditLog`: Append-only, decoupled cross-tenant audit log table.
   - Pushed via `npx prisma db push` and seeded with 4 idempotent plans.
2. **Authentication & Session Boundary**:
   - Dedicated cookie: `universal_crm_superadmin_session`.
   - Session engine: `lib/auth/super-admin-session.ts` with crypto token hashing, session creation, validation, individual revocation, and bulk revocation.
   - Edge Middleware (`middleware.ts`): Strict boundary enforcement separating `/admin/*` and `/api/v1/admin/*` from tenant `/app/*` and `/api/v1/*`. Public routes `/admin/login` and `/api/v1/admin/auth/login` allow unauthenticated login.
3. **Validation & Business Services**:
   - `lib/validations/platform.ts`: Zod schemas for login, company provisioning, suspension, plan management, quota checks, and audit queries.
   - `lib/services/super-admin-auth.service.ts`: Platform login, logout, active sessions, session termination, password changes.
   - `lib/services/quota.service.ts`: Quota calculation, user/lead count evaluation, `assertCanCreateUser`, `assertCanCreateLead` with `QUOTA_EXCEEDED` errors.
   - `lib/services/platform-plan.service.ts`: Plan retrieval, plan editing, and company plan assignment.
   - `lib/services/platform-company.service.ts`: Tenant directory listing, company details with quota telemetry, company provisioning (transactional setup of company, roles, statuses, sources, initial admin invite), company suspension (atomic status change + tenant session purge), reactivation.
   - `lib/services/platform-dashboard.service.ts`: Aggregated platform telemetry across companies, users, leads, activities, plans, and storage with zero N+1 database queries.
   - `lib/services/platform-audit-log.service.ts`: Append-only platform audit logging and filterable query service.
4. **API Route Handlers (`app/api/v1/admin/`)**:
   - 14 dedicated endpoints covering authentication, dashboard telemetry, companies, plans, and audit logs.
5. **Frontend UI Console (`app/admin/`)**:
   - `/admin/login`: Super admin sign-in portal.
   - `/admin`: Platform overview dashboard with telemetry cards, plan breakdown, and audit feed.
   - `/admin/companies`: Tenant directory and status management.
   - `/admin/companies/new`: Full company provisioning wizard.
   - `/admin/companies/[id]`: Tenant deep detail, quota progress bars, plan switcher, and audit trail.
   - `/admin/plans`: Subscription plan catalog and quota editor.
   - `/admin/audit-logs`: Cross-tenant platform audit log explorer.
   - `/admin/security`: Super admin active sessions and password manager.
   - `components/admin/admin-nav.tsx`: High-contrast, distinct platform navigation header.
6. **Testing & Quality Gates**:
   - Unit tests (`tests/super-admin-unit.test.ts`): 100% pass.
   - Integration tests (`tests/super-admin-integration.test.ts`): 100% pass.
   - Security & Boundary tests (`tests/super-admin-security.test.ts`): 100% pass.
   - Master test runner (`tests/run-all.ts` across Slices 1–8): 32 suites passing in 14.33s.
   - Live HTTP E2E tests (`tests/http-e2e.test.ts`): 100% pass.
   - TypeScript (`npm run type-check`): 0 errors.
   - ESLint (`npx eslint --quiet`): 0 errors / 0 warnings.
   - Production Build (`npm run build`): Compiled 100% clean with code 0 across 56 routes.
   - Health (`/health`) & Readiness (`/ready`): Both HTTP 200 OK.

## V1.1 Phase 1 — Customer Identity Schema (Completed & Verified 2026-09-18)
- Implemented relational entities: `Customer`, `CustomerPhone`, `CustomerEmail` in `prisma/schema.prisma`.
- Added `Lead.customerId` relation (`enquiries: Lead[]` on `Customer`).
- Deployed clean Prisma migration: `prisma/migrations/20260918053000_customer_identity_and_country_code/migration.sql`.
- Unique tenant-scoped phone constraint: `@@unique([companyId, normalizedPhone])`.
- Automated tests: `tests/customer-identity-unit.test.ts` (100% pass).

## V1.1 Phase 2 — Universal Phone Normalization & Customer Resolution (Completed & Verified 2026-09-18)
- Universal `PhoneNormalizer` (`lib/utils/phone.ts`): E.164 canonical normalization with dynamic `Company.defaultCountryCode` support (IN, US, GB, AU, DE, etc.).
- Authoritative `CustomerResolutionService` (`lib/services/customer-resolution.service.ts`): Resolves customers via explicit ID, canonical E.164 phone matching within tenant, or creates Customer + CustomerPhone.
- Automated tests: `tests/phone-normalization-unit.test.ts`, `tests/customer-resolution-integration.test.ts` (100% pass).

## V1.1 Phase 3 — Lead / Enquiry Compatibility Layer (Completed & Verified 2026-09-18)
- Updated `lib/services/lead.service.ts`:
  - `createLead`: Automatically resolves customer on phone or explicit customerId.
  - `listLeads`: Allows filtering by `customerId` and returns nested `customer`.
  - `getLeadById`: Hydrates full `customer` with nested `phones` and `emails`.
  - `updateLead`: Enforces RBAC permissions (`customers.manage` or `customers.link`) for manual reassignment of `lead.customerId`, recording both `Activity` and `AuditLog`.
- Automated tests: `tests/enquiry-lead-model-integration.test.ts` (100% pass).

## V1.1 Phase 4A — Historical Customer Backfill Dry Run (Completed & Verified 2026-09-18)
- Implemented `scripts/customer-backfill.ts`:
  - Strict read-only simulation by default (`--dry-run`).
  - Exactly 0 database mutations during dry run.
  - Bounded batch processing (500 records/batch).
  - Excludes soft-deleted leads (`deletedAt IS NOT NULL`).
  - Normalizes phones using each tenant's `Company.defaultCountryCode`.
  - Anti-hallucination guarantee: leaves missing and invalid phones as UNRESOLVED (`customerId: null`). Never creates fake customer identities.
  - Detects duplicate phone groups across enquiries and conflicting identities.
  - Phase 4B execution safeguard: throws error if execution attempted without explicit confirmation flag.
- Automated tests: `tests/customer-backfill-dry-run.test.ts` (100% pass).
- Full regression suite: all 37 test suites pass in 16.40s. Type-check (0 errors) and lint (0 errors) verified.

## V1.1 Phase 4B — Historical Customer Backfill Execution (Completed & Verified 2026-09-18)
- Executed `scripts/customer-backfill.ts` with `--execute --confirm-phase-4b-execution` in bounded transactions (500 records/batch).
- Conflict Safety:
  - Phone `+15559876543` was associated with 3 divergent names (`HTTP E2E Lead 1789551150872`, `HTTP E2E Lead 1789551275810`, `HTTP E2E Lead 1789551314273`).
  - Strict conflict safety applied: enquiries were NOT auto-merged into a Customer. All 3 enquiries preserved with `customerId = null` and reported.
- Anti-Hallucination:
  - 13 leads with missing/unusable phone identity preserved with `customerId = null`. Zero fake customer identities fabricated.
- Backfill Outcome:
  - 100 eligible enquiries linked to 100 newly created Customer records and 100 CustomerPhone records.
  - 46 soft-deleted leads excluded.
  - 0 cross-tenant links; 100% tenant-boundary isolation.
  - Exactly 0 modifications to historical lead identity fields (`name`, `phone`, `email`, `company`), activities (482), notes (26), or tasks (70).
- Automated regression suite: All 37 test suites pass in 17.17s. Type-check (0 errors) and lint (0 errors) verified.

## V1.1 Phase 5 — Customer CRUD, Permissions, Contact Management & Data Scope (Completed & Verified 2026-09-18)
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
  - Additive database migration `20260918113000_customer_permissions` deployed.
- **Customer Workspace UI**:
  - Navigation: Added "Customers" to persistent header (`components/leads/lead-nav.tsx`).
  - Directory (`/app/customers`): High-density directory component (`CustomerList`) with search, pagination, primary contact pills, and enquiry badges.
  - Detail Profile (`/app/customers/[id]`): Workspace component (`CustomerDetail`) with identity cards, multi-phone and multi-email management drawers, and authorized enquiry history table.
- **Automated Verification Suite (`tests/customer-crud-security.test.ts`)**:
  - 10 comprehensive security, CRUD, RBAC, IDOR, Data Scope, and soft-delete tests.
  - Master test runner (`tests/run-all.ts`): 38/38 test suites pass (100% pass across Slices 1–8 and Phases 1–5).
  - TypeScript (0 errors) and ESLint (0 errors) verified.

## V1.1 Phase 6 — Primary Create Enquiry Workflow, Offerings & Pricing Engine (Completed & Verified 2026-09-18)
- **Generic Offerings Catalog (Products & Services)**:
  - Database schema: `Offering` model (`PRODUCT` / `SERVICE`) with `name`, `code`, `description`, `defaultPrice` (Prisma Decimal), `currency`, `isActive`, `allowSalesPriceOverride`, tenant-scoped unique index `[companyId, code]`, and soft delete.
  - Migration `20260918120000_phase6_offerings_and_enquiry_pricing` applied.
  - Permissions: registered `offerings` module with `offerings.view`, `offerings.create`, `offerings.update`, `offerings.delete`, `offerings.manage` across system roles.
  - `OfferingService` (`lib/services/offering.service.ts`): list, get, create, update, softDelete with tenant isolation and audit logging.
  - REST endpoints: `GET/POST /api/v1/offerings` and `GET/PATCH/DELETE /api/v1/offerings/[id]`.
  - Admin UI: Products & Services catalog workspace (`/app/settings/offerings`) with modal create/edit dialog and settings navigation.
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
## V1.1 Phase 7 — Disposition Management + Follow-Up Lifecycle Engine (Completed & Verified 2026-09-18)
- **Database Schema & Migrations**:
  - `prisma/migrations/20260918170000_phase7_enums`:
    - Enums: `TaskType` (`FOLLOW_UP`, `GENERAL`), `TaskLifecycleEventType` (`CREATED`, `RESCHEDULED`, `COMPLETED`, `CANCELLED`, `MARKED_OVERDUE`), extended `TaskStatus` with `OVERDUE`, extended `ActivityType` with `DISPOSITION_CHANGED`, `TASK_RESCHEDULED`.
  - `prisma/migrations/20260918170001_phase7_disposition_and_followup_lifecycle`:
    - `Disposition` model: arbitrary-depth hierarchy (`parentId`, `depth`, `path`), generic operational rules (`isTerminal`, `requiresFollowUp`, `followUpMandatory`, `allowsClose`, `allowsConvert`, `cancelActiveFollowUp`), tenant-scoped uniqueness `[companyId, code]`, soft delete (`deletedAt`).
    - `LeadDispositionHistory` model: immutable audit trail of lead disposition changes with relations to previous and next dispositions.
    - `TaskRescheduleHistory` model: immutable lifecycle log (`taskId`, `companyId`, `leadId`, `performedById`, `eventType`, `previousDueAt`, `newDueAt`, `reason`, `dispositionId`).
    - Extended `Lead`: `dispositionId`, `dispositionUpdatedAt`, `dispositionUpdatedById`.
    - Partial Unique Index: `tasks_single_active_followup_per_lead_idx` on `("companyId", "leadId") WHERE "leadId" IS NOT NULL AND "type" = 'FOLLOW_UP' AND "status" IN ('PENDING', 'OVERDUE')`.
    - Backfilled existing 70 tasks to `type = FOLLOW_UP`.
- **Arbitrary-Depth Disposition Engine (`lib/services/disposition.service.ts`)**:
  - Full CRUD with materialized path maintenance (`/id1/id2/id3`).
  - Cycle detection & self-parenting prevention.
  - Generic rules validation: server-side rejection of contradictory rules (`cancelActiveFollowUp = true` AND `followUpMandatory = true`).
  - Tenant isolation and soft-deletion protection against deleting parent with active children.
  - REST Endpoints: `GET /api/v1/dispositions` (flat or tree), `POST /api/v1/dispositions`, `GET/PATCH/DELETE /api/v1/dispositions/[id]`.
  - Admin UI: `/app/settings/dispositions` with tree view, rule badges, and modal create/edit dialog.
- **Follow-Up Lifecycle Service & Invariant Enforcement (`lib/services/follow-up.service.ts`)**:
  - Reuses existing `model Task` strictly scoped to `TaskType.FOLLOW_UP`.
  - Strict Invariant: `ONE ENQUIRY = AT MOST ONE ACTIVE FOLLOW-UP TASK`.
  - Rescheduling updates `dueAt`, resets status to `TaskStatus.PENDING`, and writes immutable `TaskRescheduleHistory` (`TaskLifecycleEventType.RESCHEDULED`). Task status never becomes `RESCHEDULED`.
  - General tasks (`type = GENERAL`) are completely independent and untouched.
  - Atomic Overdue Synchronization (`FollowUpService.syncOverdueFollowUps`):
    - Atomic PostgreSQL query: `UPDATE tasks SET status = 'OVERDUE'::"TaskStatus" WHERE "type" = 'FOLLOW_UP'::"TaskType" AND "status" = 'PENDING'::"TaskStatus" AND "dueAt" < NOW() RETURNING id, "companyId", "leadId", "dueAt"`.
    - Creates `TaskLifecycleEventType.MARKED_OVERDUE` history ONLY for returned rows.
    - Concurrent executions produce 0 duplicate transitions and 0 duplicate history records.
  - REST Endpoints: `POST /api/v1/follow-ups/[id]/reschedule`, `POST /api/v1/follow-ups/[id]/complete`, `GET /api/v1/follow-ups/[id]/history`, `POST /api/v1/follow-ups/sync-overdue`.
  - UI Enhancements: Reschedule modal, Overdue badge, History dialog, and Overdue Sync trigger in `/app/follow-ups`.
- **Atomic Call Outcome Logging & Lead Status Gates (`lib/services/lead.service.ts`)**:
  - `LeadService.recordCallOutcome`:
    - Executes within a single `prisma.$transaction`.
    - Validates disposition rules (`followUpMandatory` requires `dueAt`).
    - If `cancelActiveFollowUp` is true, cancels any existing active follow-up with `TaskLifecycleEventType.CANCELLED`.
    - If `dueAt` provided: reschedules active follow-up if present, or creates a new follow-up if none exists (upholding the invariant).
    - Logs `CALL` activity and `DISPOSITION_CHANGED` activity on lead timeline.
    - Updates Lead `dispositionId`, `dispositionUpdatedAt`, `dispositionUpdatedById`, and appends `LeadDispositionHistory`.
    - Entire operation rolls back cleanly on any failure.
  - Lead Closure Gate:
    - Attempting to update a lead to a closed status when assigned disposition has `allowsClose: false` is rejected with `ValidationError`.
  - REST Endpoints: `POST /api/v1/leads/[id]/call-outcome`, `GET /api/v1/leads/[id]/disposition-history`.
  - UI: `CallOutcomeDialog` on `/app/leads/[id]` with dynamic follow-up scheduling, notes, and duration inputs.
- **Verification Gates**:
  - Dedicated Phase 7 test suite (`tests/phase7-disposition-followup.test.ts`): 14/14 automated scenarios passing.
  - Master test runner (`tests/run-all.ts`): 40/40 test suites passing across Slices 1–8 and Phases 1–7.
  - TypeScript: 0 errors (`npm run type-check`).
  - ESLint: 0 errors (`npm run lint`).
  - Production Build: 74/74 routes compiled successfully (`npm run build`).

