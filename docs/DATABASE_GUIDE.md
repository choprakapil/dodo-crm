# Universal CRM — Database Schema & Data Modeling Guide

A technical manual covering the relational data architecture, entity relationships, indexing strategies, and multi-tenant scoping of Universal CRM in PostgreSQL via Prisma ORM.

---

## 1. Relational Architecture Overview

Universal CRM models multi-tenancy using **row-level tenant scoping**.
- **Tenant Root**: Every organization is represented by a single record in the `companies` table.
- **Relational Invariant**: All business entities (`users`, `roles`, `teams`, `leads`, `activities`, `tasks`, `custom_fields`, `audit_logs`) maintain a direct foreign key `companyId` pointing to `companies.id`.
- **Platform Separation**: Platform operators are stored in the isolated `super_admins` table with zero company context.

```text
               ┌───────────────────────┐
               │       Company         │
               └──────────┬────────────┘
                          │ (1:N companyId)
         ┌────────────────┼────────────────┬────────────────┐
         ▼                ▼                ▼                ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
   │   User    │    │   Role    │    │   Team    │    │   Lead    │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                │                │                │
         │ (1:N)          │ (1:N)          │ (M:N)          │ (1:N)
         ▼                ▼                ▼                ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
   │  Session  │    │Permission │    │TeamMember │    │ Activity  │
   └───────────┘    └───────────┘    └───────────┘    └─────┬─────┘
                                                            │
                                                      ┌─────┴─────┐
                                                      ▼           ▼
                                                 ┌─────────┐ ┌─────────┐
                                                 │  Task   │ │CustValue│
                                                 └─────────┘ └─────────┘
```

---

## 2. Core Entity Catalog

### 2.1 Company (`companies`)
The tenant root record driving tenant-wide settings and lifecycle access.
- `id` (String, cuid): Primary key.
- `name` (String): Legal organization name.
- `slug` (String, unique): URL-safe multi-tenant slug.
- `status` (`CompanyStatus`: `ACTIVE` | `SUSPENDED`): Determines whether users can access the application.
- `timezone` (String, default: "UTC"): Company operating timezone.
- `currency` (String, default: "USD"): ISO currency symbol for deal values and pipeline reports.
- `dateFormat` (String, default: "YYYY-MM-DD"): Preferred date formatting standard.

### 2.2 User (`users`)
Company-scoped user accounts.
- `id` (String, cuid): Primary key.
- `companyId` (String): References `companies.id`.
- `roleId` (String): References `roles.id`.
- `email` (String): User's work email.
- `hashedPassword` (String, nullable): bcrypt hash (null for unaccepted invitations).
- `status` (`UserStatus`: `ACTIVE` | `INVITED` | `DISABLED`): Account lifecycle state.
- `deletedAt` (DateTime, nullable): Soft delete timestamp.

### 2.3 Role & Permission (`roles`, `permissions`)
Dynamic Role-Based Access Control.
- **Role**:
  - `name`: Unique within company (`@@unique([companyId, name])`).
  - `isSystem` (Boolean): True for immutable seeded roles (`Admin`, `Manager`, `Sales Rep`, `Viewer`, `Support`).
- **Permission**:
  - `roleId`: Foreign key to `roles.id`.
  - `module` (String): e.g. `leads`, `activities`, `tasks`, `analytics`, `users`, `teams`, `settings`, `audit_logs`.
  - `action` (String): e.g. `view`, `create`, `update`, `delete`, `assign`, `manage`.
  - `dataScope` (`DataScope`: `OWN` | `TEAM` | `COMPANY` | `PLATFORM`).

### 2.4 Team & Team Member (`teams`, `team_members`)
Departmental structures and lead routing.
- **Team**:
  - `managerId` (String, nullable): References `users.id`.
  - `isActive` (Boolean, default: true): Soft-archive flag preserving historical lead assignments.
- **TeamMember** (`team_members`):
  - Junction table connecting `teamId` and `userId`.
  - Enforces `@@unique([teamId, userId])` to prevent duplicate memberships.

### 2.5 Lead (`leads`)
Core sales opportunities.
- `id` (String, cuid): Primary key.
- `companyId` (String): References `companies.id`.
- `name` (String): Contact or business lead name.
- `email`, `phone`, `company` (String, nullable): Contact coordinates.
- `amount` (Decimal, nullable): Expected opportunity value.
- `priority` (`LeadPriority`: `LOW` | `MEDIUM` | `HIGH` | `URGENT`).
- `statusId` (String): References `lead_statuses.id`.
- `sourceId` (String, nullable): References `lead_sources.id`.
- `assignedUserId` (String, nullable): Responsible sales rep.
- `teamId` (String, nullable): Assigned departmental team.
- `customerId` (String, nullable): Persistent customer identity reference.
- `offeringId` (String, nullable): References `offerings.id` (commercial offering).
- `defaultPriceAtCreation` (Decimal, nullable): Base offering price captured at enquiry creation.
- `quotedPrice` (Decimal, nullable): Effective quoted price approved/overridden.
- `priceOverridden` (Boolean, default: false): True if sales price was overridden.
- `priceOverrideReason` (String, nullable): Business justification for deviation.
- `priceUpdatedById` (String, nullable): Sales rep or admin who performed the override.
- `priceUpdatedAt` (DateTime, nullable): Timestamp of price override.
- `deletedAt` (DateTime, nullable): Soft delete timestamp.

### 2.5.1 Customer Identity Models (V1.1 Phase 1 & 5)
- **Customer (`customers`)**: Multi-year persistent customer identity. One Customer has Many Enquiries (`ONE CUSTOMER ≠ ONE ENQUIRY`).
  - Fields: `id`, `companyId`, `name`, `displayName`, `companyName`, `notes`, `deletedAt`, `createdAt`, `updatedAt`.
- **CustomerPhone (`customer_phones`)**: Multi-phone identity registry.
  - Fields: `id`, `companyId`, `customerId`, `rawPhone`, `normalizedPhone` (canonical E.164), `countryCode`, `type`, `isPrimary`, `isVerified`.
  - Unique constraint: `@@unique([companyId, normalizedPhone])`.
- **CustomerEmail (`customer_emails`)**: Multi-email identity registry.
  - Fields: `id`, `companyId`, `customerId`, `email` (lowercase trimmed), `type`, `isPrimary`, `isVerified`.
  - Unique constraint: `@@unique([companyId, email])`.

### 2.5.2 Offerings Catalog (V1.1 Phase 6)
- **Offering (`offerings`)**: Generic tenant catalog for Products and Services.
  - Fields: `id`, `companyId`, `name`, `type` (`PRODUCT` | `SERVICE`), `code` (nullable), `description`, `defaultPrice` (Decimal), `currency`, `isActive`, `allowSalesPriceOverride` (Boolean), `deletedAt`, `createdAt`, `updatedAt`.
  - Unique constraint: `@@unique([companyId, code])`.
  - Soft deletion preserves all historical enquiry relationships.

### 2.6 Activity & Follow-up Task (`activities`, `tasks`)
- **Activity**: Multi-channel interactions (`CALL`, `WHATSAPP`, `EMAIL`, `NOTE`, `MEETING`) and lifecycle events (`LEAD_CREATED`, `STATUS_CHANGED`, `REASSIGNED`, `TASK_COMPLETED`). Includes JSON `metadata`.
- **Task**: Scheduled follow-ups with `dueAt`, `priority`, `status` (`PENDING`, `COMPLETED`, `CANCELLED`), `completedById`, and `completedAt`.

### 2.7 Custom Fields (`custom_fields`, `custom_field_values`)
- **CustomField**: Company-scoped field definitions supporting 11 types (`TEXT`, `TEXTAREA`, `NUMBER`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `URL`, `EMAIL`, `PHONE`).
  - Unique constraint: `@@unique([companyId, entityType, key])`.
- **CustomFieldValue**: EAV normalized value storage.
  - Unique constraint: `@@unique([companyId, customFieldId, entityId])`.

### 2.8 Session & Invitation (`sessions`, `invitations`)
- **Session**: Active database sessions storing `tokenHash` (SHA-256), `userId`, `expiresAt`, `ipAddress`, and `userAgent`.
- **Invitation**: 7-day single-use onboarding invitations storing `tokenHash`, `roleId`, `teamId`, and `acceptedAt`.

### 2.9 Audit Log (`audit_logs`)
- Read-only, append-only operational audit trail capturing `action`, `entityType`, `entityId`, `userId`, `ipAddress`, `userAgent`, and JSON `metadata` (state diffs).

### 2.10 Platform Infrastructure Models (Slice 8)
- **SuperAdmin (`super_admins`)**: Platform administrative operators with zero company context.
  - Fields: `id`, `email` (unique), `hashedPassword`, `name`, `isActive`, `lastLoginAt`, `createdAt`, `updatedAt`, `deletedAt`.
- **SuperAdminSession (`super_admin_sessions`)**: Dedicated platform sessions.
  - Fields: `id`, `superAdminId`, `tokenHash` (SHA-256 unique), `expiresAt`, `userAgent`, `ipAddress`, `createdAt`.
- **Plan (`plans`)**: Subscription tier definitions controlling tenant capacity.
  - Fields: `id`, `name`, `code` (`PlanTier`: `FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`), `description`, `maxUsers`, `maxLeads`, `features` (JSON), `isActive`.
  - Linked to `Company.planId`.
- **PlatformAuditLog (`platform_audit_logs`)**: Immutable append-only platform event log.
  - Fields: `id`, `superAdminId`, `action`, `entityType`, `entityId`, `metadata`, `beforeState`, `afterState`, `ipAddress`, `userAgent`, `createdAt`.

### 2.11 Customer Identity Layer (Phases 1–5)
- **Customer (`customers`)**: Long-term person or organization master entity.
  - Fields: `id`, `companyId`, `name`, `displayName`, `companyName`, `notes`, `deletedAt`, `createdAt`, `updatedAt`.
  - Relation: `enquiries` (`Lead[]`), `phones` (`CustomerPhone[]`), `emails` (`CustomerEmail[]`).
- **CustomerPhone (`customer_phones`)**: Normalized telephone contact channels.
  - Fields: `id`, `companyId`, `customerId`, `rawPhone`, `normalizedPhone` (E.164), `countryCode`, `type`, `isPrimary`, `isVerified`, `createdAt`, `updatedAt`.
  - Constraint: `@@unique([companyId, normalizedPhone])` (Strict tenant-scoped phone uniqueness).
- **CustomerEmail (`customer_emails`)**: Normalized email contact channels.
  - Fields: `id`, `companyId`, `customerId`, `email`, `type`, `isPrimary`, `isVerified`, `createdAt`, `updatedAt`.
  - Constraint: `@@unique([companyId, email])` (Strict tenant-scoped email uniqueness).
- **Enquiry Reference (`leads.customerId`)**:
  - Foreign key `customerId` referencing `customers.id` with `onDelete: SetNull`.
  - Preserves the core invariant: **ONE CUSTOMER ≠ ONE ENQUIRY**.

---

## 3. High-Performance Indexing Strategy

Universal CRM uses targeted composite indexes to support high-speed queries without table scans:

| Table | Index Columns | Purpose & Query Pattern |
|---|---|---|
| `customers` | `[companyId, createdAt(Desc)]` | Paginated customer lists ordered by creation date |
| `customers` | `[companyId, deletedAt]` | Filter active vs soft-deleted customers |
| `customers` | `[companyId, name]` | Prefix/autocomplete indexing on customer names |
| `customer_phones` | `[companyId, normalizedPhone]` | O(1) duplicate phone checks and identity resolution |
| `customer_phones` | `[companyId, customerId]` | Rapid contact point hydration on customer profiles |
| `customer_emails` | `[companyId, email]` | O(1) duplicate email checks |
| `customer_emails` | `[companyId, customerId]` | Rapid email contact point hydration |
| `leads` | `[companyId, customerId]` | Rapid retrieval of customer-specific enquiries |
| `leads` | `[companyId, createdAt(Desc)]` | High-speed paginated lead lists ordered by creation date |
| `leads` | `[companyId, assignedUserId]` | `OWN` data scope queries for Sales Reps |
| `leads` | `[companyId, teamId]` | `TEAM` data scope queries for Managers |
| `leads` | `[companyId, statusId]` | Pipeline status distribution and funnel metrics |
| `leads` | `[companyId, sourceId]` | Lead acquisition channel reporting |
| `activities` | `[companyId, leadId, createdAt(Desc)]` | Real-time lead timeline generation |
| `tasks` | `[companyId, assignedUserId, dueAt]` | Follow-up task workspace and overdue reminder queries |
| `custom_fields` | `[companyId, sortOrder]` | Form rendering in deterministic order |
| `custom_field_values` | `[companyId, entityId]` | Rapid hydration of custom fields on lead detail cards |
| `sessions` | `[tokenHash]` | O(1) instantaneous session lookup on every authenticated request |
| `invitations` | `[tokenHash]` | O(1) public token redemption lookup |
| `audit_logs` | `[companyId, createdAt(Desc)]` | Paginated audit trail queries |
| `teams` | `[companyId, isActive]` | Active team dropdowns and listings |
| `super_admins` | `[email]` | Unique index for Super Admin authentication lookup |
| `super_admin_sessions` | `[tokenHash]` | O(1) platform session verification lookup |
| `super_admin_sessions` | `[superAdminId]` | Fast active session listing and bulk revocation |
| `plans` | `[code]` | Unique index for plan tier lookups |
| `companies` | `[planId]` | Fast plan subscriber aggregation queries |
| `platform_audit_logs` | `[createdAt(Desc)]` | High-speed paginated platform audit log viewing |
| `platform_audit_logs` | `[superAdminId]` | Auditor filtering by platform operator |
| `platform_audit_logs` | `[entityType, entityId]` | Tenant-specific platform history lookup in inspector |
