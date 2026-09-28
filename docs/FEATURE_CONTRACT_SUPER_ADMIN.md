# Feature Contract: Slice 8 — Super Admin Platform Console & Tenant Operations

## 1. Overview
Slice 8 establishes the platform administration layer above individual tenant organizations. It provides multi-tenant fleet management, transactional company provisioning, instant tenant suspension with active session purging, subscription tier management with server-side quota enforcement, and an immutable platform audit trail.

---

## 2. Architectural Boundary & Invariants

```text
Actor          Cookie Name                         Authorized Paths            Blocked Paths
─────────────────────────────────────────────────────────────────────────────────────────────
Tenant User    universal_crm_session               /app/*, /api/v1/* (tenant)  /admin/*, /api/v1/admin/*
Super Admin    universal_crm_superadmin_session    /admin/*, /api/v1/admin/*   /app/*, /api/v1/* (tenant)
```

### Invariants:
1. `SuperAdmin` has no `companyId` context.
2. Tenant sessions cannot authenticate to `/admin/*` or `/api/v1/admin/*`.
3. Super Admin sessions cannot access `/app/*` or tenant endpoints.
4. Tenant suspension atomically deletes all active tenant sessions from the database.
5. All administrative mutations record immutable `PlatformAuditLog` entries.
6. Plaintext passwords are never stored, logged, or returned in API responses.

---

## 3. Data Models

### 3.1 `SuperAdmin`
- `id`: String (cuid, PK)
- `email`: String (unique, indexed)
- `hashedPassword`: String (bcrypt, 12 rounds)
- `name`: String
- `isActive`: Boolean (default `true`)
- `lastLoginAt`: DateTime?
- `createdAt`: DateTime
- `updatedAt`: DateTime
- `deletedAt`: DateTime? (soft delete)
- Relations: `sessions` (`SuperAdminSession[]`), `auditLogs` (`PlatformAuditLog[]`)

### 3.2 `SuperAdminSession`
- `id`: String (cuid, PK)
- `superAdminId`: String (FK -> `SuperAdmin.id`, indexed)
- `tokenHash`: String (unique, indexed, SHA-256)
- `expiresAt`: DateTime (indexed)
- `userAgent`: String?
- `ipAddress`: String?
- `createdAt`: DateTime

### 3.3 `Plan`
- `id`: String (cuid, PK)
- `name`: String
- `code`: PlanTier enum (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`, unique, indexed)
- `description`: String?
- `maxUsers`: Int (default 5)
- `maxLeads`: Int (default 1,000)
- `features`: Json (feature flags)
- `isActive`: Boolean (default `true`)
- `createdAt`: DateTime
- `updatedAt`: DateTime
- Relations: `companies` (`Company[]`)

### 3.4 `PlatformAuditLog`
- `id`: String (cuid, PK)
- `superAdminId`: String? (FK -> `SuperAdmin.id`, indexed)
- `action`: String (indexed)
- `entityType`: String
- `entityId`: String?
- `metadata`: Json?
- `beforeState`: Json?
- `afterState`: Json?
- `ipAddress`: String?
- `userAgent`: String?
- `createdAt`: DateTime (indexed desc)

---

## 4. API Specification

| Method | Path | Description | Protected By |
|---|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Super Admin authentication | Rate limiter + Credentials |
| `POST` | `/api/v1/admin/auth/logout` | Revoke active platform session | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/auth/me` | Current Super Admin identity | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/dashboard` | Aggregated fleet telemetry | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/companies` | List companies with search/filters | `requireSuperAdmin` |
| `POST` | `/api/v1/admin/companies` | Transactional company provisioning | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/companies/[id]` | Deep company inspector | `requireSuperAdmin` |
| `POST` | `/api/v1/admin/companies/[id]/suspend` | Suspend tenant + session purge | `requireSuperAdmin` |
| `POST` | `/api/v1/admin/companies/[id]/reactivate` | Reactivate suspended tenant | `requireSuperAdmin` |
| `PATCH`| `/api/v1/admin/companies/[id]/plan` | Reassign tenant subscription plan | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/plans` | List plans and subscriber counts | `requireSuperAdmin` |
| `PATCH`| `/api/v1/admin/plans/[id]` | Update plan quotas & features | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/audit-logs` | Query platform audit trail | `requireSuperAdmin` |
| `GET`  | `/api/v1/admin/security/sessions` | List active platform sessions | `requireSuperAdmin` |
| `DELETE`| `/api/v1/admin/security/sessions` | Revoke platform session(s) | `requireSuperAdmin` |
| `POST` | `/api/v1/admin/security/change-password` | Update Super Admin password | `requireSuperAdmin` |

---

## 5. Security & Verification Summary

1. **Mass Assignment**: All input schemas enforce `.strict()`, rejecting unexpected fields like `superAdminId`, `companyId`, or `passwordHash`.
2. **Quota Gates**: Server-side validation blocks user and lead creation when tenant plan limits are exceeded (`QuotaExceededError`).
3. **Session Purge**: Suspending a tenant purges all active sessions in the same transaction, blocking immediate access.
4. **Zero Cookie Collision**: Dedicated cookie name `universal_crm_superadmin_session` prevents any crossover with tenant sessions.
