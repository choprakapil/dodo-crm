# Universal CRM — REST API Reference Guide

A complete technical catalog of all active, versioned HTTP REST endpoints implemented in Universal CRM.

---

## 1. Global Conventions

- **Base Path**: `/api/v1`
- **Response Format**: `application/json; charset=utf-8`
- **Standard Success Response**:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { ... }
  }
  ```
- **Standard Error Response**:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Human-readable description",
      "details": [ ... ]
    }
  }
  ```
- **Authentication**: Session cookie `crm_session_token` (HTTP-only, Secure, SameSite=Lax).
- **Tenant Scope**: Derived automatically from server session (`companyId: ctx.company.id`).

---

## 2. Authentication Endpoints (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Auth Required**: No (Rate limited: 5 attempts/min/IP).
- **Body**: `{ "email": "user@example.com", "password": "SecurePassword123!" }`
- **Response (200)**: `{ "success": true, "data": { "user": { ... }, "company": { ... } } }`
  - Sets HTTP-only `crm_session_token` cookie.
- **Errors**: `401 Unauthorized` (invalid password, disabled account, suspended company).

### `POST /api/v1/auth/logout`
- **Auth Required**: Yes.
- **Response (200)**: `{ "success": true, "message": "Logged out successfully" }`
  - Clears cookie and deletes session record from PostgreSQL.

### `GET /api/v1/auth/me`
- **Auth Required**: Yes.
- **Response (200)**: Complete hydrated `AuthContext` (User, Company, Role, Permissions).

### `POST /api/v1/auth/forgot-password`
- **Auth Required**: No.
- **Body**: `{ "email": "user@example.com" }`
- **Response (200)**: `{ "success": true, "message": "If the account exists, a reset link was dispatched." }`
  - Dispatches SHA-256 single-use reset token via `EmailService`.

### `POST /api/v1/auth/reset-password`
- **Auth Required**: No.
- **Body**: `{ "token": "32-byte-hex-token", "password": "NewSecurePassword123!" }`
- **Response (200)**: Updates password, revokes all active sessions for that user.

---

## 3. Lead Management Endpoints (`/api/v1/leads`)

### `GET /api/v1/leads`
- **Auth Required**: Yes.
- **Permission**: `leads:view`
- **Data Scope**: Enforces `OWN` (rep), `TEAM` (manager), `COMPANY` (admin).
- **Query Params**:
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
  - `search` (string: matches name, email, phone, company)
  - `statusId` (UUID)
  - `sourceId` (UUID)
  - `priority` (`LOW` | `MEDIUM` | `HIGH` | `URGENT`)
- **Response (200)**: Paginated lead objects including status, source, assignee, and team relations.

### `POST /api/v1/leads`
- **Auth Required**: Yes.
- **Permission**: `leads:create`
- **Body**:
  ```json
  {
    "name": "Acme Corp Opportunity",
    "company": "Acme Industries",
    "email": "contact@acme.com",
    "phone": "+1234567890",
    "amount": 50000,
    "priority": "HIGH",
    "statusId": "status-cuid",
    "sourceId": "source-cuid",
    "assignedUserId": "user-cuid",
    "customFields": { "budget_approved": true }
  }
  ```
- **Response (201)**: Created lead record. Atomically logs `LEAD_CREATED` activity and audit entry.

### `GET /api/v1/leads/[id]`
- **Auth Required**: Yes.
- **Permission**: `leads:view`
- **Response (200)**: Detailed lead object with activity history, status transitions, and custom field values.
- **Errors**: `404 Not Found` if lead does not exist or belongs to another tenant.

### `PATCH /api/v1/leads/[id]`
- **Auth Required**: Yes.
- **Permission**: `leads:update` (and `leads:assign` if changing assignee).
- **Body**: Partial lead attributes.
- **Response (200)**: Updated lead object. Creates `STATUS_CHANGED` and `REASSIGNED` events if applicable.

### `DELETE /api/v1/leads/[id]`
- **Auth Required**: Yes.
- **Permission**: `leads:delete`
- **Response (200)**: `{ "success": true, "message": "Lead soft-deleted successfully" }`.

---

## 4. Activities & Follow-ups (`/api/v1/activities`, `/api/v1/follow-ups`)

### `POST /api/v1/leads/[id]/activities`
- **Auth Required**: Yes.
- **Permission**: `activities:create`
- **Body**: `{ "type": "CALL", "subject": "Intro call", "description": "Discussed scope" }`
- **Response (201)**: Created activity object.

### `GET /api/v1/follow-ups`
- **Auth Required**: Yes.
- **Permission**: `tasks:view`
- **Query Params**: `dueFilter` (`today`, `overdue`, `upcoming`, `completed`, `cancelled`), `search`, `page`, `limit`.
- **Response (200)**: Filtered, paginated follow-up tasks.

### `POST /api/v1/follow-ups/[id]/complete`
- **Auth Required**: Yes.
- **Permission**: `tasks:update`
- **Response (200)**: Marks task `COMPLETED`, records `completedById` and `completedAt`, and writes timeline activity.

---

## 5. Custom Fields (`/api/v1/custom-fields`)

### `GET /api/v1/custom-fields`
- **Auth Required**: Yes.
- **Permission**: `settings:view` or `leads:view`
- **Response (200)**: Active custom field definitions for the company ordered by `sortOrder`.

### `POST /api/v1/custom-fields`
- **Auth Required**: Yes.
- **Permission**: `settings:manage`
- **Body**: `{ "label": "Region", "key": "sales_region", "fieldType": "SELECT", "options": ["North", "South"] }`
- **Response (201)**: Created custom field definition.

### `POST /api/v1/custom-fields/reorder`
- **Auth Required**: Yes.
- **Permission**: `settings:manage`
- **Body**: `{ "fieldIds": ["id-1", "id-2", "id-3"] }`
- **Response (200)**: Reorders fields in an atomic database transaction.

---

## 6. Lead Import & Export

### `POST /api/v1/leads/import/preview`
- **Auth Required**: Yes.
- **Permission**: `leads:create`
- **Body**: `{ "csvContent": "name,email,amount\nJohn Doe,john@test.com,1000" }`
- **Response (200)**: Headers detected, sample preview rows, suggested column mappings.

### `POST /api/v1/leads/import/execute`
- **Auth Required**: Yes.
- **Permission**: `leads:create`
- **Body**:
  ```json
  {
    "csvContent": "...",
    "mappings": { "name": "name", "email": "email" },
    "duplicateStrategy": "SKIP"
  }
  ```
- **Response (200)**: Total rows processed, created, updated, skipped, failed, with optional `errorSummary`.

### `GET /api/v1/leads/export`
- **Auth Required**: Yes.
- **Permission**: `leads:view`
- **Response (200)**: `Content-Type: text/csv; charset=utf-8`. Enforces user data scope and neutralizes spreadsheet formula prefixes.

---

## 7. Reports & Analytics (`/api/v1/analytics`)

### `GET /api/v1/analytics/overview`
- **Auth Required**: Yes.
- **Permission**: `analytics:view`
- **Query Params**: `preset` (`TODAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `THIS_QUARTER`, `THIS_YEAR`, `CUSTOM`), `startDate`, `endDate`.
- **Response (200)**: Aggregated JSON: KPIs with deltas, time-series points, status distribution, pipeline funnel, and scoped leaderboard.

### `GET /api/v1/analytics/export`
- **Auth Required**: Yes.
- **Permission**: `analytics:export`
- **Query Params**: `type` (`team_performance` | `pipeline_summary`), `preset`.
- **Response (200)**: Formula-safe CSV download.

---

## 8. Users & Invitations (`/api/v1/users`, `/api/v1/invitations`)

### `GET /api/v1/users`
- **Auth Required**: Yes.
- **Permission**: `users:view`
- **Query Params**: `search`, `status`, `roleId`, `teamId`, `page`, `limit`.
- **Response (200)**: Paginated user list with role and team details.

### `POST /api/v1/users/invite`
- **Auth Required**: Yes.
- **Permission**: `users:create`
- **Body**: `{ "name": "Jane Doe", "email": "jane@company.com", "roleId": "role-id", "teamId": "team-id" }`
- **Response (201)**: Creates user in `INVITED` status, generates SHA-256 token, sends email.

### `POST /api/v1/invitations/accept`
- **Auth Required**: No (Public).
- **Body**: `{ "token": "32-byte-token", "password": "SecurePassword123!" }`
- **Response (200)**: Activates user, establishes password, issues session cookie.

### `PATCH /api/v1/users/[id]/status`
- **Auth Required**: Yes.
- **Permission**: `users:update`
- **Body**: `{ "status": "DISABLED" }` (or `ACTIVE`)
- **Response (200)**: If disabled, immediately purges all active DB sessions for that user.

### `POST /api/v1/users/[id]/reset-password`
- **Auth Required**: Yes.
- **Permission**: `users:manage`
- **Body**: `{ "password": "NewAdminPassword123!" }`
- **Response (200)**: Updates password hash and revokes all active sessions for that user.

---

## 9. Teams (`/api/v1/teams`)

### `GET /api/v1/teams`
- **Auth Required**: Yes.
- **Permission**: `teams:view`
- **Response (200)**: Teams list with member counts and active manager.

### `POST /api/v1/teams`
- **Auth Required**: Yes.
- **Permission**: `teams:create`
- **Body**: `{ "name": "Enterprise Sales", "description": "Key accounts", "managerId": "user-id" }`
- **Response (201)**: Created team record. Manager is automatically upserted into `team_members`.

### `POST /api/v1/teams/[id]/members`
- **Auth Required**: Yes.
- **Permission**: `teams:manage`
- **Body**: `{ "userId": "user-id" }`
- **Response (200)**: Adds user to team roster.

### `DELETE /api/v1/teams/[id]/members/[userId]`
- **Auth Required**: Yes.
- **Permission**: `teams:manage`
- **Response (200)**: Detaches user from team roster.

---

## 10. Roles & Permissions (`/api/v1/roles`, `/api/v1/permissions`)

### `GET /api/v1/roles`
- **Auth Required**: Yes.
- **Permission**: `settings:view`
- **Response (200)**: System roles and custom company roles with granular permissions.

### `POST /api/v1/roles`
- **Auth Required**: Yes.
- **Permission**: `settings:manage`
- **Body**:
  ```json
  {
    "name": "SDR Team Lead",
    "description": "Qualifies leads and reviews team stats",
    "permissions": [
      { "module": "leads", "action": "view", "dataScope": "TEAM" },
      { "module": "leads", "action": "create", "dataScope": "TEAM" },
      { "module": "analytics", "action": "view", "dataScope": "TEAM" }
    ]
  }
  ```
- **Response (201)**: Created custom role.

---

## 11. Security & Sessions (`/api/v1/security`)

### `GET /api/v1/security/sessions`
- **Auth Required**: Yes.
- **Response (200)**: Active DB sessions for caller with IP, User-Agent, and current session flag.

### `DELETE /api/v1/security/sessions/[id]`
- **Auth Required**: Yes.
- **Response (200)**: Invalidates specific session ID in PostgreSQL.

### `POST /api/v1/security/sessions/revoke-all`
- **Auth Required**: Yes.
- **Response (200)**: Invalidates all sessions except caller's active session.

### `POST /api/v1/security/change-password`
- **Auth Required**: Yes.
- **Body**: `{ "currentPassword": "OldPassword123!", "newPassword": "NewPassword123!" }`
- **Response (200)**: Validates current password, updates to new password hash, and revokes all other sessions.

---

## 12. Audit Logs (`/api/v1/audit-logs`)

### `GET /api/v1/audit-logs`
- **Auth Required**: Yes.
- **Permission**: `audit_logs:view`
- **Query Params**: `action`, `entityType`, `userId`, `startDate`, `endDate`, `page`, `limit`.
- **Response (200)**: Read-only, append-only, tenant-isolated audit log records with parsed JSON metadata.

---

## 13. Super Admin Platform Endpoints (`/api/v1/admin/*`) (Slice 8)

All `/api/v1/admin/*` endpoints require the dedicated `universal_crm_superadmin_session` cookie and server-side verification via `requireSuperAdmin()`. Tenant sessions are strictly rejected with HTTP 401.

### Authentication (`/api/v1/admin/auth/*`)
- `POST /api/v1/admin/auth/login`: Rate-limited authentication for platform operators.
  - Body: `{ "email": "admin@platform.com", "password": "SecretPassword123!" }`
  - Sets `universal_crm_superadmin_session` cookie (HttpOnly, SameSite=Lax).
- `POST /api/v1/admin/auth/logout`: Revokes current Super Admin session and clears cookie.
- `GET /api/v1/admin/auth/me`: Returns current Super Admin identity (`id`, `email`, `name`, `role: "SUPER_ADMIN"`).

### Platform Telemetry (`/api/v1/admin/dashboard`)
- `GET /api/v1/admin/dashboard`: Global aggregates (total/active/suspended companies, total users, total leads, plan distributions, recent platform events, and DB latency).

### Tenant Fleet Management (`/api/v1/admin/companies/*`)
- `GET /api/v1/admin/companies`: Paginated list of tenants with filters (`search`, `status`, `planTier`, `sortBy`, `sortOrder`).
- `POST /api/v1/admin/companies`: Transactional provisioning of new tenant.
  - Body: `{ "name": "Company", "slug": "company", "initialAdminName": "Admin", "initialAdminEmail": "admin@test.com", "planTier": "STARTER" }`
  - Provisions company, default plan, initial admin user in `INVITED` state, 5 system roles, lead statuses/sources, and returns single-use invitation link.
- `GET /api/v1/admin/companies/[id]`: Deep company inspector (quota limits & usage, statistics, plan details, recent platform audit logs).
- `POST /api/v1/admin/companies/[id]/suspend`: Suspends company, atomically deletes all active tenant sessions from PostgreSQL, and records `COMPANY_SUSPENDED`.
- `POST /api/v1/admin/companies/[id]/reactivate`: Restores company to `ACTIVE` status without modifying historical data.
- `PATCH /api/v1/admin/companies/[id]/plan`: Reassigns subscription plan (`{ "planId": "..." }` or `{ "planTier": "..." }`).

### Subscription Plans (`/api/v1/admin/plans/*`)
- `GET /api/v1/admin/plans`: Lists all 4 plans (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`) with subscriber counts.
- `PATCH /api/v1/admin/plans/[id]`: Updates plan quota definitions (`maxUsers`, `maxLeads`, `features`).

### Platform Audit Logs (`/api/v1/admin/audit-logs`)
- `GET /api/v1/admin/audit-logs`: Searchable, filterable list of immutable platform audit records.

### Platform Security (`/api/v1/admin/security/*`)
- `GET /api/v1/admin/security/sessions`: Lists active Super Admin sessions.
- `DELETE /api/v1/admin/security/sessions`: Revokes single session (`?sessionId=...`) or all other sessions (`?allOthers=true`).
- `POST /api/v1/admin/security/change-password`: Updates Super Admin password and revokes other active platform sessions.

---

## 14. Customer Management Endpoints (`/api/v1/customers/*`) (Phase 5)

All customer endpoints enforce strict multi-tenant isolation, granular RBAC permissions, and Data Scope enforcement. Client-supplied `companyId` is ignored.

### Customer Directory (`GET /api/v1/customers`)
- **Permission**: `customers.view`
- **Query Params**: `page`, `limit`, `search`, `phone`, `email`, `sortBy`, `sortOrder`, `includeDeleted`.
- **Response (200)**: Paginated customer records with primary phones, emails, and active enquiry counts. Excludes soft-deleted records by default.

### Create Customer (`POST /api/v1/customers`)
- **Permission**: `customers.create`
- **Body**:
  ```json
  {
    "name": "Acme Representative",
    "displayName": "Acme Rep",
    "companyName": "Acme Industries",
    "notes": "Key VIP Account",
    "phone": "+1 (555) 019-2831",
    "phoneType": "MOBILE",
    "email": "contact@acme.com",
    "emailType": "WORK"
  }
  ```
- **Response (201)**: Transactionally creates Customer, normalized primary phone, and primary email with audit record.
- **Errors**: `409 Conflict` (if normalized phone or email already belongs to an existing customer in this tenant).

### Customer Detail & History (`GET /api/v1/customers/:id`)
- **Permission**: `customers.view`
- **Query Params**: `enquiryPage`, `enquiryLimit`, `includeDeleted`.
- **Response (200)**: Complete customer identity, all registered phones/emails, and **Data-Scope-filtered enquiry history**.
  - *Data Scope Rule*: Sales Reps with `OWN` scope only receive their assigned enquiries. Enquiries belonging to other agents are completely redacted.

### Update Customer Identity (`PATCH /api/v1/customers/:id`)
- **Permission**: `customers.update`
- **Body**: `{ "name": "...", "displayName": "...", "companyName": "...", "notes": "..." }`
- **Response (200)**: Updated customer profile with audit logging of previous vs new values.

### Soft Delete Customer (`DELETE /api/v1/customers/:id`)
- **Permission**: `customers.delete` or `customers.manage`
- **Response (200)**: `{ "success": true, "enquiriesPreserved": 2 }`
- **Invariant**: Sets `deletedAt = now()`. Does **NOT** delete, convert, or orphan linked enquiries or activities.

### Phone Management
- `POST /api/v1/customers/:id/phones`: Add phone (`{ "phone": "...", "type": "MOBILE", "isPrimary": false }`). Enforces E.164 normalization and tenant duplicate protection.
- `PATCH /api/v1/customers/:id/phones/:phoneId`: Update phone (`{ "type": "WORK", "isPrimary": true }`). Designating primary updates previous primary to false.
- `DELETE /api/v1/customers/:id/phones/:phoneId`: Remove phone. If primary phone is removed, auto-promotes oldest remaining phone to primary.

### Email Management
- `POST /api/v1/customers/:id/emails`: Add email (`{ "email": "...", "type": "WORK", "isPrimary": false }`). Enforces syntax and tenant duplicate protection.
- `PATCH /api/v1/customers/:id/emails/:emailId`: Update email (`{ "type": "PERSONAL", "isPrimary": true }`).
- `DELETE /api/v1/customers/:id/emails/:emailId`: Remove email. Auto-promotes remaining email if primary is removed.

### Customer Resolution (`GET /api/v1/customers/resolve`)
- **Permission**: `customers.view`
- **Query Params**: `?phone=+15551234567`
- **Response (200)**: Instant E.164 phone normalization and match check returning `{ "resolved": true, "customer": { ... } }` or `{ "resolved": false }`.

### Customer History Preview (`GET /api/v1/customers/:id/history-preview`)
- **Permission**: `leads.view` or `leads.create` or `customers.view`
- **Response (200)**: Sanitized customer prior enquiries preview for Create Enquiry workflow:
  ```json
  {
    "success": true,
    "data": {
      "allowed": true,
      "customer": { "id": "...", "name": "Rahul Sharma", "phone": "+919876543210" },
      "enquiries": [
        {
          "id": "...",
          "createdAt": "2026-09-18T...",
          "quotedPrice": 48000,
          "status": { "id": "...", "name": "Converted", "color": "#10b981" },
          "offering": { "id": "...", "name": "Television", "type": "PRODUCT" },
          "assignedUser": { "id": "...", "name": "Sales Rep" }
        }
      ],
      "totalAuthorizedEnquiries": 1
    }
  }
  ```
- **Security & Data Scope**:
  - Automatically filtered by caller Data Scope (`OWN` vs `TEAM` vs `COMPANY`).
  - Sensitive internal notes, private remarks, and admin fields are completely excluded server-side.

---

## 12. Offerings (Products & Services) Endpoints (`/api/v1/offerings`)

### List Offerings (`GET /api/v1/offerings`)
- **Permission**: `offerings.view`
- **Query Params**: `page`, `limit`, `search`, `type` (`PRODUCT` | `SERVICE`), `isActive`.
- **Response (200)**: Paginated catalog of offerings for the tenant.

### Create Offering (`POST /api/v1/offerings`)
- **Permission**: `offerings.create` or `offerings.manage`
- **Body**:
  ```json
  {
    "name": "Television 55-inch",
    "type": "PRODUCT",
    "code": "TV-55",
    "description": "4K Ultra HD Smart TV",
    "defaultPrice": 50000,
    "currency": "INR",
    "isActive": true,
    "allowSalesPriceOverride": true
  }
  ```
- **Response (201)**: Created offering object with audit log.

### Get Offering (`GET /api/v1/offerings/:id`)
- **Permission**: `offerings.view`
- **Response (200)**: Offering detail.

### Update Offering (`PATCH /api/v1/offerings/:id`)
- **Permission**: `offerings.update` or `offerings.manage`
- **Body**: Partial offering fields (`name`, `defaultPrice`, `allowSalesPriceOverride`, `isActive`, etc.).
- **Response (200)**: Updated offering object with audit log.

### Delete Offering (`DELETE /api/v1/offerings/:id`)
- **Permission**: `offerings.delete` or `offerings.manage`
- **Response (200)**: Soft-deletes offering (`deletedAt = now()`). Historical enquiries referencing this offering remain intact.

