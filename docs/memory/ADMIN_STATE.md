[STATE]

# Admin Product System State

## Status: V8 Admin Product System Active
## Super Admin Review: COMPLETE (V1.1 Planned / Awaiting Authorization)
## Governing Blueprint: docs/SUPER_ADMIN_PLATFORM_REVIEW_AND_V1_1_PLAN.md

---

## 1. Product Invariants & Boundaries

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

**Super Admin is NOT a tenant CRM.**
- Super Admin must never become a normal lead-management or sales activity workspace.
- Super Admin operates at the fleet level: managing organizations, inspecting user accounts, enforcing quota boundaries, and auditing cross-tenant platform events.

Tenant CRM remains strictly isolated:
$$\text{Company} \longrightarrow \text{Teams} \longrightarrow \text{Users} \longrightarrow \text{Leads} \longrightarrow \text{Activities} \longrightarrow \text{Follow-ups} \longrightarrow \text{Reports}$$

---

## 2. Navigation Architecture

### Current Navigation (Locked V1.0)
- Dashboard (`/admin`)
- Companies (`/admin/companies`)
- Plans & Quotas (`/admin/plans`)
- Platform Audit (`/admin/audit-logs`)
- Security (`/admin/security`)

### Planned Future Navigation (V1.1 Blueprint)
- Dashboard (`/admin`) — Clickable KPI drill-downs
- Companies (`/admin/companies`) — Fleet table, provisioning, and Company Detail workspace
- Users (`/admin/users`) [NEW] — Cross-tenant user directory and User Detail inspector
- Plans & Quotas (`/admin/plans`) — Subscription capacity tiers and quota editor
- Platform Audit (`/admin/audit-logs`) — Cross-tenant immutable audit trail
- Security (`/admin/security`) — Super Admin profile, credentials, and fleet security health

---

## 3. Workspace Patterns

### Company Detail Workspace (`/admin/companies/[id]`)
Must not remain a flat monolithic page. Future structure requires 7 dedicated operational tabs:
1. **Overview**: Fleet KPIs, capacity gauges, primary admin contact card, configuration.
2. **Users**: Searchable company user roster (Name, Email, Role, Teams, Status, Last Login, Sessions).
3. **Leads & Pipeline**: Lead volume vs plan capacity, status breakdown, acquisition source breakdown.
4. **Usage & Quotas**: Seats, leads, feature flag entitlements.
5. **Activity & Tasks**: Multi-channel activity volume, follow-up task health.
6. **Security & Sessions**: Active tenant sessions list, emergency bulk session purge, suspension reason history.
7. **Platform Audit Trail**: Filtered `PlatformAuditLog` records for this specific tenant.

### Global Platform Users Workspace (`/admin/users` & `/admin/users/[id]`)
- Global search across all tenants by user name, email, phone, or company slug.
- User Detail inspector covering Identity, Account Lifecycle, Access & Scope, Active Sessions, and Recent Activity.
- Credential Safety: Plaintext passwords, password hashes, and raw token secrets are **never** exposed.

### Clickable Dashboard Standard
Every meaningful number on the dashboard is an interactive drill-down:
- `Total Companies` → `/admin/companies`
- `Active Companies` → `/admin/companies?status=ACTIVE`
- `Suspended Companies` → `/admin/companies?status=SUSPENDED`
- `Total Users` → `/admin/users`
- `Active Users` → `/admin/users?status=ACTIVE`
- `Plan Subscriber Counts` → `/admin/companies?planTier=TIER`

---

## 4. Deferred Capabilities & Data Gaps

- **Deferred**: Real billing/MRR, storage tracking, platform RBAC sub-roles, impersonation.
- **Data Gaps**: Do not invent fake MRR, storage metrics, or session last-activity timestamps; current Prisma schema does not store these fields.
