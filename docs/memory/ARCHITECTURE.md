[STATE]

# Architecture State

CURRENT VERSION: Universal CRM V1.0
STATUS: Slices 1–8 COMPLETE & LOCKED
SUPER ADMIN REVIEW: COMPLETE
V1.1: PLANNED — NOT STARTED (Awaiting Authorization)
SOURCE OF TRUTH: docs/SUPER_ADMIN_PLATFORM_REVIEW_AND_V1_1_PLAN.md

---

## 1. Multi-Tenancy Architecture

Universal CRM is structured as a multi-tenant modular monolith:
- **Tenant Scope**: Every tenant data record carries `companyId` foreign key.
- **Tenant Identity**: Server-side `AuthContext` resolved from database-backed session token (`universal_crm_session` cookie).
- **Data Scopes**: Evaluated at runtime via `OWN`, `TEAM`, and `COMPANY` dynamic Prisma queries.
- **Client IDs Untrusted**: All client-supplied `companyId` and `userId` fields are strictly ignored/rejected.

---

## 2. Platform & Super Admin Architecture

- **Strict Boundary**: Platform operators belong to `SuperAdmin` (table `super_admins`) with no `companyId` context.
- **Dedicated Cookie**: `universal_crm_superadmin_session` verified by `requireSuperAdmin()`.
- **Zero Session Crossover**: Tenant sessions cannot access `/admin/*` or `/api/v1/admin/*`. Super Admin sessions cannot access `/app/*` or tenant endpoints.
- **Tenant Suspension**: Atomically sets `Company.status = SUSPENDED` and purges all active tenant sessions from the database.

---

## 3. Product Boundaries

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

**Super Admin is NOT a tenant CRM.** Super Admin does not create leads, close sales deals, or manage daily pipeline activities.

Tenant CRM remains completely isolated:
$$\text{Company} \longrightarrow \text{Teams} \longrightarrow \text{Users} \longrightarrow \text{Leads} \longrightarrow \text{Activities} \longrightarrow \text{Follow-ups} \longrightarrow \text{Reports}$$

---

## 4. Future V1.1 Architectural Blueprint

Detailed in [docs/SUPER_ADMIN_PLATFORM_REVIEW_AND_V1_1_PLAN.md](file:///Users/apple/Downloads/Universal%20Crm/docs/SUPER_ADMIN_PLATFORM_REVIEW_AND_V1_1_PLAN.md):
- **Navigation**: 6-item clean header (Dashboard, Companies, Users, Plans & Quotas, Platform Audit, Security).
- **Global Users Directory**: Cross-tenant search and user inspection without exposing sensitive credentials.
- **Company Detail Workspace**: 7 dedicated tabs (Overview, Users, Leads, Usage, Activity, Security, Audit).
- **Clickable Dashboard**: All KPI cards and plan subscriber badges serve as interactive drill-down entry points.
