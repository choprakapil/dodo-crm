# Universal CRM — Tenant Purge Runbook (Super Admin)
**Phase B.6: Data Safety & Recovery Hardening**
**Status:** Canonical Platform Operations Runbook

---

## 1. PURPOSE & SECURITY POSTURE

Tenant Purge permanently removes a company and all of its associated tenant records (leads, customers, users, roles, tasks, activities, custom fields, and audit history).

> [!WARNING]
> Tenant purge is **IRREVERSIBLE**. It completely purges the database records of the tenant and triggers external storage deletion. It is reserved exclusively for GDPR/CCPA "right to be forgotten", contract termination, or test tenant decommissioning.

---

## 2. SECURITY INVARIANTS

1. **Authorization**: Only authenticated **Super Admins** (`requireSuperAdmin`) can initiate a purge. Tenant administrators cannot purge their own company.
2. **Server-Side Validation**: The target company is re-fetched server-side from `id`. Client-supplied tenant headers are completely ignored.
3. **Double Confirmation**: The operator must provide the matching `confirmSlug` matching `company.slug`. If slugs do not match, the purge aborts immediately with `ValidationError`.
4. **Atomic Transaction**: All database deletions execute inside a single `prisma.$transaction`. If any foreign key violation occurs, the entire transaction rolls back—zero partial records deleted.
5. **Two-Phase Safety**:
   - **Phase 1**: Database transaction executes completely and commits.
   - **Phase 2**: External Cloudflare R2 / S3 storage keys under `{companyId}/*` are deleted with explicit confirmation tracking.
6. **Platform Audit Trail**: Logs a permanent record in `platform_audit_logs` containing exact entity deletion counts, operator ID, timestamp, and IP address.

---

## 3. DEPENDENCY-AWARE DELETION SEQUENCE

To satisfy PostgreSQL foreign-key constraints without resorting to risky uncontrolled cascades, the purge executes in this deterministic order:

| Step | Entity | Table | Constraint Consideration |
|:---:|:---|:---|:---|
| **1** | User Sessions | `sessions` | Invalidate all tenant tokens immediately |
| **2** | Follow-up Reschedule History | `task_reschedule_history` | References task and company |
| **3** | Lead Disposition History | `lead_disposition_history` | References toDisposition (`onDelete: Restrict`) |
| **4** | Custom Field Values | `custom_field_values` | References custom_field and lead |
| **5** | Activity Timeline | `activities` | References lead, user, and company |
| **6** | Tasks / Follow-ups | `tasks` | References lead, user, team |
| **7** | Lead Imports | `lead_imports` | References user and company |
| **8** | Leads / Enquiries | `leads` | Core entity |
| **9** | Customer Phones & Emails | `customer_phones`, `customer_emails` | Unique tenant constraints |
| **10** | Customers | `customers` | Core entity |
| **11** | Custom Fields | `custom_fields` | Schema definitions for company |
| **12** | Dispositions | `dispositions` | Clear `parentId = null` first to prevent hierarchy Restrict violations |
| **13** | Offerings | `offerings` | Product / Service catalog |
| **14** | Lead Statuses & Sources | `lead_statuses`, `lead_sources` | Company pipeline configurations |
| **15** | Invitations | `invitations` | Pending staff invites |
| **16** | Team Members & Teams | `team_members`, `teams` | Organizational groupings |
| **17** | Tenant Audit Logs | `audit_logs` | Tenant-level audit trail |
| **18** | Permissions | `permissions` | Permissions tied to tenant roles |
| **19** | Users | `users` | Tenant staff accounts |
| **20** | Roles | `roles` | Tenant RBAC roles |
| **21** | Company Root | `companies` | Tenant root record |

---

## 4. API USAGE EXAMPLE

**Request:**
```http
DELETE /api/v1/admin/companies/comp_sample123
Authorization: Bearer <super_admin_session_cookie>
Content-Type: application/json

{
  "confirmSlug": "acme-corp"
}
```

**Response (HTTP 200 OK):**
```json
{
  "success": true,
  "message": "Company and all associated tenant data purged successfully.",
  "data": {
    "companyId": "comp_sample123",
    "companyName": "Acme Corp",
    "companySlug": "acme-corp",
    "databaseCounts": {
      "sessions": 4,
      "taskRescheduleHistories": 12,
      "leadDispositionHistories": 8,
      "customFieldValues": 24,
      "activities": 18,
      "tasks": 10,
      "leadImports": 1,
      "leads": 15,
      "customerPhones": 6,
      "customerEmails": 5,
      "customers": 5,
      "customFields": 3,
      "dispositions": 7,
      "offerings": 2,
      "leadStatuses": 4,
      "leadSources": 3,
      "invitations": 1,
      "teamMembers": 4,
      "teams": 2,
      "auditLogs": 35,
      "permissions": 30,
      "users": 3,
      "roles": 2,
      "companies": 1
    },
    "storageCleanup": {
      "attempted": true,
      "confirmed": true
    }
  }
}
```

---

## 5. TWO-PHASE STORAGE PURGE SEMANTICS & OPERATOR RECOVERY

### Architecture
Universal CRM adopts a strict two-phase safety model for tenant purges:
1. **Phase 1: Database Purge Transaction (`prisma.$transaction`)**
   - Atomic, dependency-aware deletion of all database records across 21 steps.
   - If any step fails, the entire database transaction rolls back, leaving tenant database state completely unmodified.
2. **Phase 2: External Storage Cleanup (Post-Transaction)**
   - External object storage (S3/R2) cannot participate in PostgreSQL ACID transactions.
   - External cleanup is executed only **after** the database transaction has successfully committed.

### State Machine & Failure Behavior
```
DB Purge Succeeded
        │
        ▼
Storage Cleanup Attempted
        ├── S3/R2 deletion succeeded ──► confirmed: true (Complete)
        └── S3/R2 deletion failed    ──► confirmed: false + explicit error (Action Required)
```

**Guarantees:**
- **Zero False Claims**: The API response and platform audit logs will **never** claim `confirmed: true` if the storage driver encountered an error, timeout, or lack of confirmation.
- **Transactional Independence**: If storage cleanup fails, the database purge remains permanent and committed. The database state is not re-created or left partially deleted.
- **Observability & Auditability**:
  - The API response returns `storageCleanup: { attempted: true, confirmed: false, error: "<reason>" }`.
  - An entry is recorded in `platform_audit_logs` with action `COMPANY_PURGED` capturing `metadata.storageCleanup`.
  - A structured warning log is emitted containing the `companyId`, `companySlug`, and `error`.

### Operator Recovery Runbook (When `confirmed: false`)
Since no asynchronous background retry queue exists for tenant deletions, unconfirmed external storage cleanup requires manual operator intervention:

1. **Locate Target Namespace**:
   Using the `companyId` reported in the purge audit log:
   ```bash
   TARGET_PREFIX="${COMPANY_ID}/"
   ```
2. **Inspect External Bucket (AWS S3 / Cloudflare R2)**:
   ```bash
   aws s3 ls "s3://${STORAGE_BUCKET}/${TARGET_PREFIX}"
   ```
3. **Purge Tenant Storage Objects Manually**:
   ```bash
   aws s3 rm "s3://${STORAGE_BUCKET}/${TARGET_PREFIX}" --recursive
   ```
4. **Log Operator Resolution**:
   Document the manual cleanup in the infrastructure changelog referencing the original `PlatformAuditLog.id` and `requestId`.

