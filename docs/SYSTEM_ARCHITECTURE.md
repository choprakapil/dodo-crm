# Universal CRM — System Architecture

A comprehensive technical blueprint of the architecture, security invariants, data flow, and runtime mechanics of Universal CRM.

---

## 1. Architectural Philosophy: The Multi-Tenant Modular Monolith

Universal CRM is built as a **Multi-Tenant Modular Monolith** using **Next.js 16 (App Router)**, **TypeScript**, **PostgreSQL 16**, and **Prisma ORM**.

### Core Tenets:
1. **Zero Client Trust**: All tenant, user, role, and permission identities are derived purely server-side from the authenticated database session. Client-supplied IDs in headers, query strings, or JSON bodies are ignored or rejected.
2. **Row-Level Tenant Scoping**: Every tenant-owned database entity includes a foreign key `companyId` indexed for query isolation.
3. **Decoupled Service Layer**: Route handlers contain zero business logic. All validation, business rules, multi-step transactions, and data scoping reside in domain services.
4. **Pure Aggregate Queries**: Analytics, funnels, and leaderboard statistics utilize PostgreSQL composite indexes and Prisma aggregate/groupBy operations. Zero N+1 queries.

---

## 2. End-to-End Request Pipeline

Every incoming request to Universal CRM flows through a deterministic authorization and execution pipeline:

```text
HTTP Request (Cookie: crm_session_token)
      │
      ▼
Edge Middleware (middleware.ts)
   • Static asset bypass
   • Public route bypass (/login, /invite/*)
   • Session existence check
   • Security header injection
      │
      ▼
Route Handler / Server Component
   • getAuthContext()
      │
      ▼
Server-Side Identity Verification (session.ts)
   • Hash token: SHA-256(token)
   • Lookup session in PostgreSQL
   • Verify: session.expiresAt > now
   • Verify: user.status === "ACTIVE"
   • Verify: user.deletedAt === null
   • Verify: company.status === "ACTIVE"
   • Hydrate AuthContext (User, Company, Role, Permissions)
      │
      ▼
Input Validation (Zod Schemas)
   • Request body / query validation
   • String trimming & email normalization
      │
      ▼
Permission & Data Scope Resolution (scope.ts)
   • requirePermission(ctx, module, action)
   • Resolve DataScope: OWN | TEAM | COMPANY
   • Generate Prisma WHERE clause: getLeadDataScopeWhere()
      │
      ▼
Domain Service Execution (e.g. LeadService)
   • Database transaction
   • Enforce foreign key tenant isolation
   • Emit timeline activities & audit logs
      │
      ▼
Standardized API Response / UI Render
```

---

## 3. The Multi-Tenant Identity Context (`AuthContext`)

The `AuthContext` object is the single source of truth for all authenticated operations.

```typescript
export interface AuthContext {
  session: Session;
  user: {
    id: string;
    email: string;
    name: string;
    status: UserStatus;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    status: CompanyStatus;
    timezone: string;
    currency: string;
    dateFormat: string;
  };
  role: {
    id: string;
    name: string;
    isSystem: boolean;
  };
  permissions: Array<{
    module: string;
    action: string;
    dataScope: DataScope;
  }>;
  hasPermission(module: string, action: string): boolean;
  getScope(module: string, action: string): DataScope | null;
}
```

### The Golden Security Invariant:
> [!IMPORTANT]
> **Client-supplied `companyId`, `userId`, `role`, and `permissions` MUST NOT be trusted.**
> 
> When executing a query, such as updating a lead:
> ```typescript
> // CORRECT:
> await prisma.lead.update({
>   where: {
>     id: leadId,
>     companyId: ctx.company.id, // Strictly derived from server session!
>   },
>   data: sanitizedPayload,
> });
> ```
> Even if a malicious user passes `{ companyId: "other-tenant-id" }` in the JSON body, the payload schema strips the field, and the database query binds directly to `ctx.company.id`.

---

## 4. Database-Backed Sessions & Immediate Revocation

Unlike stateless JWTs which cannot be revoked without maintaining a distributed blacklist, Universal CRM uses **database-backed HTTP-only sessions**:

1. **Token Generation**: 32-byte cryptographically secure token (`crypto.randomBytes(32).toString("hex")`).
2. **Persistence**: A **SHA-256 hash** of the token is saved in PostgreSQL (`sessions.tokenHash`). The raw token is returned to the client as an HTTP-only cookie.
3. **Verification**: On each request, the cookie token is hashed and matched against the database.
4. **Immediate Invalidation**:
   - If an administrator disables a user, `DELETE FROM sessions WHERE "userId" = :id` is run.
   - If a company is suspended, `company.status = SUSPENDED` immediately causes `validateSessionToken()` to return `null`.
   - Access is terminated instantly on the next request, with zero propagation delay.

---

## 5. Dynamic Data-Scope Engine (`lib/auth/scope.ts`)

Instead of scattering hardcoded role checks like `if (role === "Sales Rep")` across services, Universal CRM uses a centralized **Data Scope Engine**:

```typescript
export function getLeadDataScopeWhere(
  ctx: AuthContext,
  action: string
): Prisma.LeadWhereInput {
  const scope = ctx.getScope("leads", action);

  switch (scope) {
    case "OWN":
      return { assignedUserId: ctx.user.id };

    case "TEAM": {
      // Find all teams the user belongs to or manages
      const userTeams = await getUserTeamMemberships(ctx.user.id);
      return {
        OR: [
          { assignedUserId: ctx.user.id },
          { teamId: { in: userTeams } },
        ],
      };
    }

    case "COMPANY":
    case "PLATFORM":
      return {}; // No additional restriction beyond companyId

    default:
      return { id: "impossible-match-deny-all" };
  }
}
```

This pattern ensures that:
- Any new custom role automatically inherits correct data scoping.
- Business logic in `lead.service.ts` remains completely decoupled from role titles.

---

## 6. Super Admin Platform Architecture (Slice 8)

Universal CRM enforces a strict structural separation between the multi-tenant customer application and the platform operations layer:

```text
Normal Tenant Layer                      Platform Operations Layer
┌───────────────────────────────┐        ┌───────────────────────────────┐
│       Tenant User Session     │        │      Super Admin Session      │
│ (universal_crm_session cookie)│        │ (universal_crm_superadmin_...││
└──────────────┬────────────────┘        └──────────────┬────────────────┘
               ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│        User Identity          │        │      Super Admin Identity     │
│       (users table)           │        │      (super_admins table)     │
└──────────────┬────────────────┘        └──────────────┬────────────────┘
               ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│       Company / Tenant        │        │     Platform Authorization    │
│    (Row-level companyId)      │        │    (Zero companyId Context)   │
└──────────────┬────────────────┘        └──────────────┬────────────────┘
               ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│   Tenant Services & APIs      │        │    Platform Services & APIs   │
│         (/app/*)              │        │           (/admin/*)          │
└───────────────────────────────┘        └───────────────────────────────┘
```

### Core Invariants:
1. **Zero Company Context**: `SuperAdmin` records possess no `companyId` foreign key and can never be associated with a tenant or leak into tenant queries.
2. **Dedicated Token Hashing**: Super Admin sessions are stored in `SuperAdminSession` (`super_admin_sessions` table) with raw 32-byte tokens saved only as SHA-256 hashes.
3. **Dedicated Platform Cookie**: Uses `universal_crm_superadmin_session`. Tenant application uses `universal_crm_session`. Zero cross-authentication.
4. **Immediate Suspension Purge**: Suspending a tenant atomically terminates all active tenant user sessions in PostgreSQL (`prisma.session.deleteMany({ where: { companyId } })`).
5. **Server-Side Quota Gate**: `QuotaService` verifies tenant resource limits against their `Plan` tier before allowing user or lead creations.

---

## 7. Layered Directory Structure

```text
universal-crm/
├── app/
│   ├── (auth)/                  # Public auth routes (login, reset-password)
│   ├── admin/                   # Super Admin Platform Console (Slice 8)
│   │   ├── page.tsx             # Telemetry Dashboard
│   │   ├── login/               # Dedicated Platform Login Gateway
│   │   ├── companies/           # Multi-tenant fleet management & inspector
│   │   ├── plans/               # Subscription tiers & quota editor
│   │   ├── audit-logs/          # Immutable platform audit trail
│   │   └── security/            # Platform session management & credentials
│   ├── api/v1/                  # Versioned JSON REST API endpoints
│   │   ├── admin/               # Super Admin Platform APIs (Slice 8)
│   │   │   ├── auth/            # Platform login, logout, me
│   │   │   ├── dashboard/       # Fleet telemetry aggregates
│   │   │   ├── companies/       # Provisioning, inspector, suspension, plan
│   │   │   ├── plans/           # Tier definitions & quota updates
│   │   │   ├── audit-logs/      # Immutable platform audit trail
│   │   │   └── security/        # Session viewer, revocation, password change
│   │   ├── auth/                # Tenant login, logout, me, reset-password
│   │   ├── customers/           # Customer CRUD, contact management, resolution (Phase 5)
│   │   ├── leads/               # Lead/Enquiry CRUD, activities, import, export
│   │   ├── follow-ups/          # Task queries, completions, rescheduling
│   │   ├── custom-fields/       # Custom attribute definitions & reordering
│   │   ├── analytics/           # Overview metrics, funnels, CSV exports
│   │   ├── users/               # User administration, status, invites
│   │   ├── teams/               # Departmental team management & rosters
│   │   ├── roles/               # System and custom role permissions
│   │   ├── company/             # Company profile & localization
│   │   ├── security/            # Tenant password changes & session revocation
│   │   └── audit-logs/          # Tenant audit trail queries
│   ├── app/                     # Authenticated customer workspace
│   │   ├── page.tsx             # Executive Dashboard
│   │   ├── customers/           # Customer directory & detail workspaces (Phase 5)
│   │   ├── leads/               # Lead/Enquiry table, detail, import
│   │   ├── follow-ups/          # Daily follow-up task workspace
│   │   ├── settings/            # Settings workspaces (users, teams, roles...)
│   │   └── help/                # In-App Help & Documentation Center
│   ├── invite/                  # Public invitation acceptance portal
│   ├── health/                  # Liveness probe (HTTP 200)
│   └── ready/                   # Readiness probe (DB connection check)
├── lib/
│   ├── auth/                    # Session management, bcrypt, super-admin-session
│   ├── services/                # Decoupled business logic (CustomerService, LeadService, etc.)
│   ├── validations/             # Centralized Zod validation schemas
│   ├── utils/                   # Phone normalization, CSV parser, tokens
│   └── db/                      # Global Prisma client singleton
├── components/                  # High-density UI component library
│   ├── admin/                   # Platform navigation & console components
│   ├── ui/                      # Base UI primitives (buttons, inputs, dialogs)
│   ├── customers/               # Customer list & detail components (Phase 5)
│   ├── leads/                   # Lead tables, forms, timelines
│   ├── follow-ups/              # Follow-up tables, filter tabs
│   ├── analytics/               # SVG charts, KPI cards, funnels
│   ├── settings/                # User, team, role, and audit workspaces
│   └── help/                    # In-app help search & reader components
└── prisma/
    ├── schema.prisma            # Single source of database schema truth
    └── seed.ts                  # Idempotent database seeder (plans, superadmin, tenants)
```

---

## 9. Customer Identity & Invariant Architecture (Phases 1–5)

### 9.1 The Identity Invariant: ONE CUSTOMER ≠ ONE ENQUIRY
- **Customer**: Represents persistent person or business identity across years.
- **Lead / Enquiry**: Represents a discrete, transactional sales deal or customer service cycle.
- Multiple enquiries link to a single customer via `Lead.customerId`.
- Mutating or soft-deleting a Customer **never** cancels, closes, or destroys linked enquiries.

### 9.2 Contact Point Governance
- Phone numbers are normalized to E.164 via `lib/utils/phone.ts` using tenant default country codes.
- `@@unique([companyId, normalizedPhone])` enforces tenant-scoped phone uniqueness without cross-tenant collision.
- Primary contact promotion guarantees that deleting a primary phone or email promotes the next available contact point.

### 9.3 Data Scope Enforcement on Customer History
- Customer profile enquiry history does not grant unrestricted access.
- `CustomerService.getCustomerById` passes `AuthContext` to `getLeadDataScopeWhere(ctx, "view")` and merges the generated conditions with `customerId`.
- A representative with `OWN` scope viewing a customer profile will only see their own assigned enquiries. Foreign enquiries are completely redacted.
