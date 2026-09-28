# Universal CRM — Data Safety & Backup Contract
**Phase B.6: Data Safety & Recovery Hardening**
**Status:** Canonical Operator Document

---

## 1. ARCHITECTURAL PRINCIPLES

Universal CRM adheres to a strict division of responsibility between **Application Guarantees** and **Infrastructure / Operator Responsibilities**:

```
+--------------------------------------------------------------------------+
|                       APPLICATION GUARANTEES                             |
|  - Strict row-level tenant isolation (companyId everywhere)              |
|  - Soft-delete semantics on primary business entities (Lead, Customer)    |
|  - Idempotent identity resolution with zero resurrection                 |
|  - Transactional fail-closed destructive operations                     |
|  - Two-phase tenant purge (atomic DB cascade + decoupled storage audit)  |
|  - Read-only data integrity verification tooling                         |
|  - Zero secret leakage in logs, audit records, or telemetry              |
|  - Fail-closed test database guards (positive identification)            |
+--------------------------------------------------------------------------+
                                    │
                                    ▼
+--------------------------------------------------------------------------+
|               INFRASTRUCTURE / OPERATOR RESPONSIBILITIES                 |
|  - Point-in-time recovery (PITR) & automated PostgreSQL WAL archiving    |
|  - Scheduled logical backups (pg_dump / pg_basebackup)                   |
|  - Storage bucket versioning & object lifecycle policies (Cloudflare R2) |
|  - Off-site immutable backup replication & encryption at rest (KMS)      |
|  - Staging restoration drills & disaster recovery testing                |
|  - Key rotation & external secret management (Vault / AWS Secrets)       |
+--------------------------------------------------------------------------+
```

---

## 2. DATABASE BACKUP SPECIFICATION

Universal CRM relies on PostgreSQL. Application code does NOT attempt to replace native database backup systems. The operator must establish the following backup framework:

### A. Logical Backups (Daily & Weekly)
- **Tool**: `pg_dump` with custom directory/archive format (`-Fc`).
- **Frequency**:
  - Daily differential / incremental or full daily snapshots.
  - Weekly full logical archive.
- **Example Execution**:
  ```bash
  pg_dump -Fc --no-owner --no-privileges \
    --dbname="$DATABASE_URL" \
    --file="/backups/universal_crm_$(date +%Y%m%d_%H%M%S).dump"
  ```
- **Retention Schedule**:
  - Daily backups: Retained for 30 days.
  - Weekly backups: Retained for 12 weeks.
  - Monthly archives: Retained for 12 months.

### B. Physical Streaming & WAL Archiving (Continuous)
- For production environments with near-zero RPO requirements, PostgreSQL Write-Ahead Log (WAL) archiving (e.g. pgBackRest or cloud-managed PITR such as AWS RDS / Google Cloud SQL / Supabase / Neon) must be enabled.

### C. Backup Encryption & Access Control
- All backup artifacts must be encrypted at rest using AES-256 / GCM or provider-managed KMS keys.
- Backup credentials and destination storage (e.g., S3/GCS immutable bucket) must remain external to the application environment and application database.
- Application database users (`crm_app`) must never possess administrative privileges (`SUPERUSER`) or access to backup storage credentials.

---

## 3. FILE & OBJECT STORAGE SAFETY

- **Provider**: Cloudflare R2 / AWS S3 (S3-compatible API).
- **Tenant Namespace Isolation**: Every tenant asset is stored strictly under `{companyId}/{folder}/{filename}-{uniqueId}.{ext}`.
- **Immutability & Versioning**: Operators should enable **Object Versioning** on the production storage bucket. If an object is accidentally overwritten or deleted, prior versions can be recovered through bucket lifecycle tools.
- **Fail-Closed Operations**: If `STORAGE_PROVIDER=r2` is set in production, missing credentials fail closed immediately. Local filesystem fallback in production is strictly prohibited.

---

## 4. SECRETS SAFETY IN BACKUPS

- Environment secrets (`COOKIE_SECRET`, `STORAGE_SECRET_KEY`, `RESEND_API_KEY`, etc.) are never stored in database tables.
- Authentication hashes stored in the database (`hashedPassword`, `tokenHash`) use salted bcrypt (cost factor 10) and SHA-256; raw tokens are never persisted.
- Audit logs and platform telemetry strictly redact passwords, tokens, API keys, and authorization headers before persistence.

---

## 5. RECOVERY OBJECTIVES (RPO & RTO)

> [!IMPORTANT]
> The exact RPO and RTO depend entirely on the infrastructure tier configured by the operator.

- **With Managed Continuous WAL Archiving**:
  - **Target RPO**: < 5 minutes (WAL interval).
  - **Target RTO**: < 1 hour (database restore + schema verification + smoke tests).
- **With Daily Logical Backups Only**:
  - **Target RPO**: < 24 hours.
  - **Target RTO**: < 2 hours.
