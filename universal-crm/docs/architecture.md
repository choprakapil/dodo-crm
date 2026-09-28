# Universal CRM — Architecture Documentation

Version: 1.0
Status: LIVE — Updated after Slice 1 Foundation

---

## Overview

Universal CRM is a multi-tenant SaaS CRM built as a **Modular Monolith**
using Next.js 15 App Router. Multiple independent businesses operate from a
single installation with completely isolated data.

---

## Technology Stack

| Layer | Technology | Version | Decision |
|---|---|---|---|
| Framework | Next.js | 16.x | ADR-016 |
| Language | TypeScript | 5.x strict | — |
| Database | PostgreSQL | 15+ | PRD §4 |
| ORM | Prisma | 5.22.x | ADR-015 |
| UI Library | shadcn/ui + Tailwind | 4.x | PRD §4 |
| Session | iron-session | 9.x | ADR-002 |
| Validation | Zod | 4.x | — |
| Date/Time | date-fns + date-fns-tz | — | ADR-013 |
| Password Hashing | bcryptjs | 3.x | — |

---

## Project Structure

```
universal-crm/
├── app/                          # Next.js App Router
│   ├── api/v1/                   # REST API routes (Slice 2+)
│   ├── (auth)/                   # Auth route group (Slice 2)
│   ├── (dashboard)/              # Dashboard route group (Slice 3+)
│   ├── health/route.ts           # GET /health — liveness
│   ├── ready/route.ts            # GET /ready — readiness + DB check
│   ├── not-found.tsx             # Global 404
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global CSS + Tailwind
│
├── lib/                          # Shared library code
│   ├── db/                       # Prisma client singleton
│   ├── errors/                   # AppError, error codes, API error handler
│   ├── logger/                   # Structured logger
│   ├── utils/
│   │   ├── pagination.ts         # Pagination helpers (offset + cursor)
│   │   ├── timezone.ts           # Timezone-aware date formatting
│   │   └── tokens.ts             # Secure token generation + hashing
│   └── services/
│       ├── email/                # EmailService interface + mock
│       ├── storage/              # StorageService interface + local disk
│       └── rate-limit/           # RateLimiter interface + in-memory
│
├── prisma/
│   ├── schema.prisma             # Complete V1 schema — all 19 entities
│   ├── seed.ts                   # Seed: 1 superadmin, 2 companies, 100 leads
│   └── migrations/               # Auto-generated migration files
│
└── docs/                         # Architecture + decision documentation
```

---

## Tenant Isolation Architecture

**Core principle:** `companyId` is on every tenant-owned table. Every query
includes `WHERE companyId = :companyId`. This is enforced at the repository
layer, not the database layer.

```
HTTP Request
    │
    ▼
Middleware (auth cookie → session lookup)
    │
    ├─ Session not found → 401
    ├─ Company SUSPENDED → 403
    ├─ User DISABLED → 403
    │
    ▼
Route Handler
    │
    ▼
authorize(ctx, "leads.view")     ← ALWAYS called before any data access
    │
    ├─ Permission denied → 403
    │
    ▼
Repository (Prisma query)
    │
    └─ ALL queries include: where: { companyId: ctx.companyId }
       ← If this is missing, it is a BUG — never silently accept it
```

---

## Authorization Model

Permissions are stored in the database per role. No role-name checks in code.

```
User → Role → Permission[]
Permission: { module, action, dataScope }
```

### Modules
`leads | users | teams | reports | settings | audit_logs | tasks | notes`

### Actions
`view | create | update | delete | assign | manage`

### Data Scopes
- `OWN` — only records assigned to/created by the requesting user
- `TEAM` — records associated with the user's team
- `COMPANY` — all records within the company
- `PLATFORM` — super admin only (cross-company)

---

## Authentication Flow

1. User submits credentials to `POST /api/v1/auth/login`
2. Password verified with bcrypt (HASH_ROUNDS=12)
3. Secure random session token generated (32 bytes, base64url)
4. Token hashed with SHA-256 before database storage
5. Raw token stored in HTTP-only, Secure, SameSite=Lax cookie
6. Session record created: `{ userId, companyId, tokenHash, expiresAt }`
7. Every request: middleware reads cookie, hashes it, looks up session in DB
8. If session found + not expired + user ACTIVE + company ACTIVE → proceed

**Session revocation:** Delete session row. Effect is immediate. No JWT expiry lag.

---

## API Standards

All API routes: `app/api/v1/...`

### Request Headers
```
Content-Type: application/json
Cookie: session=<token>         (set automatically by browser)
```

### Success Response Format
```json
{
  "data": { ... },
  "pagination": {              // present on list endpoints
    "page": 1,
    "pageSize": 20,
    "total": 350,
    "totalPages": 18,
    "hasPreviousPage": false,
    "hasNextPage": true
  }
}
```

### Error Response Format
```json
{
  "error": {
    "code": "LEAD_NOT_FOUND",
    "message": "Lead not found",
    "requestId": "req_abc123"
  }
}
```

Error codes are stable strings from `lib/errors/index.ts`. Never expose
stack traces, SQL errors, or internal details in API responses.

---

## Service Abstractions

All external service dependencies are abstracted behind interfaces.
Business logic never imports a concrete implementation.

| Service | Interface | V1 Implementation | Future |
|---|---|---|---|
| Email | `EmailService` | Mock (console log) | Resend / SendGrid |
| Storage | `StorageService` | Local filesystem | S3-compatible |
| Rate Limit | `RateLimiter` | In-memory Map | Redis (Upstash) |

To swap an implementation: change the `PROVIDER` env variable and add the
implementation class. No business logic changes required.

---

## Performance Strategy

- Server Components by default (no unnecessary JavaScript to client)
- Offset pagination for UI lists (20/50/100 per page)
- Cursor pagination for large lead lists (1M+ records)
- Composite indexes on all common filter columns (see schema.prisma)
- `pg_trgm` for lead search (Slice 4+)
- No Redis caching in V1 — measure before adding infrastructure

---

## Error States

Every async action supports these states in the UI:
`idle → loading → success | empty | validation-error | permission-error | not-found | rate-limited | timeout | network-error | server-error`

Every recoverable failure provides:
- Human-readable message
- Useful next action
- Retry path where retry is meaningful
- Preserved user input where safe
- No raw stack traces

---

## Deployment

- Runtime: Node.js 20+ on single VPS (V1)
- Database: PostgreSQL 15+ (local or managed)
- Environment: All config via environment variables (see `.env.example`)
- Super Admin: Created via `npm run seed` only
- Sessions: Stored in PostgreSQL (swap to Redis for multi-server later)
