# Universal CRM — Super Admin Platform Operations Guide

> **STATUS: SLICE 8 COMPLETE, VERIFIED & LOCKED**
>
> The platform Super Admin console, multi-tenant fleet operations, subscription tiers, server-side quotas, and platform audit trail are fully implemented and verified in **Slice 8**.

---

## 1. Architectural Distinction: Super Admin vs. Tenant User

In Universal CRM, a Super Admin is **NOT** a standard company user with an elevated role. 

The platform architecture enforces an absolute boundary between tenant users and platform operators:

```text
Normal Tenant Architecture
┌────────────────────────┐
│  Tenant User Session   │ (universal_crm_session cookie)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│     User Identity      │
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│   Company / Tenant     │ (Scoped via companyId)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│   Role & Permissions   │ (Admin, Manager, Sales Rep, Viewer, Support)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│   Tenant APIs (/app/*) │
└────────────────────────┘

Super Admin Platform Architecture
┌────────────────────────┐
│   Super Admin Session  │ (universal_crm_superadmin_session cookie)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│  Super Admin Identity  │
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ Platform Authorization │ (Zero companyId context)
└───────────┬────────────┘
            ▼
┌────────────────────────┐
│ Platform APIs (/admin) │
└────────────────────────┘
```

### Key Architectural Isolation Rules
1. **Model Separation**: Super Admins reside in `SuperAdmin` (`super_admins` table); tenant users reside in `User` (`users` table).
2. **Zero Company Context**: `SuperAdmin` records have no `companyId` foreign key and cannot be associated with a tenant.
3. **Session Separation**: Super Admin sessions reside in `SuperAdminSession` with a dedicated SHA-256 hashed token.
4. **Cookie Separation**: Super Admins use `universal_crm_superadmin_session`. Tenant users use `universal_crm_session`. Cross-authentication is impossible.
5. **Middleware Enforcement**:
   - Tenant sessions attempting to access `/admin/*` or `/api/v1/admin/*` are strictly blocked.
   - Super Admin sessions attempting to access `/app/*` or tenant APIs are strictly blocked.

---

## 2. Platform Console Workspaces

The Super Admin Console provides an operational workspace accessible at `/admin`:

| Route | Workspace | Operational Capabilities |
|---|---|---|
| `/admin/login` | Platform Login Gateway | Rate-limited, brute-force protected authentication for Super Admins |
| `/admin` | Platform Telemetry Dashboard | Fleet overview: total/active/suspended tenants, total users, total leads, plan distribution, platform health |
| `/admin/companies` | Tenant Fleet Directory | Search, filter by status (`ACTIVE`, `SUSPENDED`) or plan tier, pagination, user/lead counts |
| `/admin/companies/new` | Transactional Provisioning | Provisions company, system roles, lead statuses/sources, plan, and initial admin invitation link |
| `/admin/companies/[id]` | Deep Tenant Inspector | Real-time usage meters (users, leads), entity stats, plan modifier, suspension / reactivation triggers, tenant audit history |
| `/admin/plans` | Subscription Plan Manager | View tiers (`FREE`, `STARTER`, `PROFESSIONAL`, `ENTERPRISE`), subscriber counts, update user/lead quotas and feature flags |
| `/admin/audit-logs` | Platform Audit Trail | Immutable, append-only log of all administrative actions with actor, IP, timestamp, and JSON metadata |
| `/admin/security` | Platform Security Center | Profile view, password update, active platform sessions inspection, individual or bulk session revocation |

---

## 3. Operations & Workflows

### 3.1 Initial Super Admin Bootstrap

Super Admin accounts are created securely via environment variables and the database seed runner. Plaintext credentials are never committed or logged.

#### Bootstrap Procedure:
1. Configure deployment environment variables:
   ```env
   SEED_SUPER_ADMIN_EMAIL="superadmin@universalcrm.com"
   SEED_SUPER_ADMIN_PASSWORD="YourStrongPlatformPasswordHere!"
   SEED_SUPER_ADMIN_NAME="Platform Administrator"
   ```
2. Execute the idempotent seed command:
   ```bash
   npm run seed
   ```
3. The script creates the `SuperAdmin` record only if no record with that email exists. Passwords are encrypted with bcrypt (12 rounds).
4. Verify by signing in at `/admin/login`.

---

### 3.2 Tenant Provisioning Workflow

To provision a new tenant organization transactionally:
1. Navigate to `/admin/companies/new`.
2. Input:
   - **Company Name**: e.g., `Acme Industrial`
   - **Slug**: URL identifier, e.g., `acme-industrial` (lowercase, alphanumeric, hyphens)
   - **Initial Admin Name & Email**: Name and destination email for the tenant's primary admin
   - **Plan Tier**: Select `FREE`, `STARTER`, `PROFESSIONAL`, or `ENTERPRISE`
   - **Timezone & Currency**: Default operational configuration
3. Submit the form (`POST /api/v1/admin/companies`).
4. In a single database transaction, the platform provisions:
   - `Company` record linked to the selected `Plan`
   - Initial `User` in `INVITED` state
   - 5 System Roles: `Admin`, `Manager`, `Sales Rep`, `Viewer`, `Support`
   - 12 Permission sets mapped across CRM modules
   - Default Lead Statuses: `New`, `Contacted`, `Qualified`, `Proposal`, `Won`, `Lost`
   - Default Lead Sources: `Website`, `Referral`, `LinkedIn`, `Cold Outreach`, `Inbound Call`
   - Cryptographically secure 32-byte invitation token
   - Platform audit log entry: `COMPANY_CREATED`
5. The console displays the single-use invitation link (e.g., `https://crm.domain.com/invite/<token>`). Provide this link securely to the initial administrator.

---

### 3.3 Tenant Suspension & Reactivation

#### Suspending a Tenant:
1. Navigate to `/admin/companies/[id]`.
2. Click **Suspend Tenant** and provide an operational reason.
3. Submitting executes an atomic two-step operation:
   - Updates `Company.status = SUSPENDED`.
   - Purges all active tenant sessions immediately from the database (`prisma.session.deleteMany({ where: { companyId } })`).
   - Writes `COMPANY_SUSPENDED` to the `PlatformAuditLog`.
4. **Result**: All users in that company are instantly logged out. Any active HTTP requests or subsequent login attempts are rejected with HTTP 403 (`COMPANY_SUSPENDED`).
5. **Data Preservation**: No leads, users, teams, activities, notes, tasks, or audit logs are deleted.

#### Reactivating a Tenant:
1. Navigate to `/admin/companies/[id]`.
2. Click **Reactivate Tenant**.
3. Updates `Company.status = ACTIVE` and records `COMPANY_REACTIVATED`.
4. Tenant users can immediately sign in again. All historical data remains fully intact.

---

### 3.4 Subscription Plans & Quota Management

Universal CRM provides four subscription tiers:

| Tier | Default Max Users | Default Max Leads | Custom Fields | CSV Export | Advanced Analytics | Audit Logs |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `FREE` | 2 | 100 | ❌ | ❌ | ✅ | ❌ |
| `STARTER` | 5 | 1,000 | ✅ | ✅ | ✅ | ✅ |
| `PROFESSIONAL` | 25 | 10,000 | ✅ | ✅ | ✅ | ✅ |
| `ENTERPRISE` | 500 | 500,000 | ✅ | ✅ | ✅ | ✅ |

#### Modifying Plan Limits:
- Navigate to `/admin/plans`.
- Click **Edit Limits & Features** on any tier.
- Adjust `maxUsers`, `maxLeads`, or feature flags.
- Modifications apply immediately to all subscribers on that tier and log a `PLAN_UPDATED` audit record.

#### Reassigning a Tenant's Plan:
- Navigate to `/admin/companies/[id]`.
- Click **Change Subscription Plan**.
- Select the new tier. Updates `Company.planId` and logs `PLAN_ASSIGNED`.

#### Server-Side Quota Enforcement:
- Handled by [`lib/services/quota.service.ts`](file:///Users/apple/Downloads/Universal%20Crm/universal-crm/lib/services/quota.service.ts).
- `QuotaService.assertCanCreateUser(companyId)` verifies user limit prior to user creation or invitation.
- `QuotaService.assertCanCreateLead(companyId)` verifies lead limit prior to lead creation or CSV import.
- Throws `QuotaExceededError` (HTTP 403, code `QUOTA_EXCEEDED`) when quota is exceeded.

---

### 3.5 Platform Audit Trail

Every administrative operation is permanently recorded in `PlatformAuditLog`:
- Append-only immutability.
- Logged actions:
  - `SUPER_ADMIN_LOGIN`
  - `SUPER_ADMIN_LOGOUT`
  - `SUPER_ADMIN_PASSWORD_CHANGED`
  - `COMPANY_CREATED`
  - `COMPANY_SUSPENDED`
  - `COMPANY_REACTIVATED`
  - `PLAN_UPDATED`
  - `PLAN_ASSIGNED`
- Accessible via `/admin/audit-logs` or `GET /api/v1/admin/audit-logs`.
- Protected from tenant access: tenant users cannot read or query platform audit logs under any circumstances.

---

### 3.6 Platform Security & Session Revocation

The Platform Security Center at `/admin/security` enables Super Admins to:
- Review active platform sessions with IP address, User-Agent, creation time, and expiration.
- Revoke individual suspicious sessions.
- Revoke all other active platform sessions.
- Update master credentials with current password verification.
