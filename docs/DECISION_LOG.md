[STATE]

# Decision Log

Record every non-trivial architectural, product, UX, security, dependency, and
scope decision. This is how future developers (including you in 6 months)
understand why the project is built the way it is, not just what was built.

---

## DECISION-001: Session Architecture — HTTP-only Cookies + PostgreSQL-backed Sessions

**Date:** 2026-09-16
**Owner:** User (approved via implementation plan)
**Status:** APPROVED

### Question/Problem
How do we persist user sessions securely while supporting instant revocation (disabled users, suspended companies)?

### Options Considered
1. **JWT tokens** — stateless, no DB lookup, hard to revoke mid-flight
2. **HTTP-only cookies + DB sessions** — instant revocation, CSRF-safe, simple
3. **Hybrid (JWT + refresh token)** — complex for V1

### Decision
HTTP-only cookies (`iron-session`) + PostgreSQL-backed session records.

### Rationale
- Instant revocation: delete session row → user is out immediately
- Critical for: disabled users, suspended companies, password changes
- No JWT expiry problems
- Team familiarity; simpler to audit

### Trade-offs Accepted
- Every authenticated request requires a DB session lookup (acceptable at V1 scale; can add Redis-backed sessions later)
- Horizontal scaling requires shared session store (abstract interface allows Redis swap without app changes)

---

## DECISION-002: Email Provider — Abstract Interface + Console Mock for V1

**Date:** 2026-09-16
**Owner:** User (approved via implementation plan defaults)
**Status:** APPROVED

### Decision
`EmailService` interface with a mock implementation that logs to console. Swap to Resend/SendGrid by replacing the implementation only.

### Rationale
- No external dependency in V1
- Interface ensures future swap doesn't touch business logic

---

## DECISION-003: File Storage — Abstract Interface + Local Filesystem for V1

**Date:** 2026-09-16
**Owner:** User (approved via implementation plan defaults)
**Status:** APPROVED

### Decision
`StorageService` interface with local filesystem implementation. Swap to S3-compatible by replacing implementation only.

### Trade-offs Accepted
- Local storage not suitable for multi-server without shared filesystem
- Acceptable for V1 single-server deployment; swap documented in architecture

---

## DECISION-004: Super Admin Creation — Seed Script Only

**Date:** 2026-09-16
**Owner:** User (approved via implementation plan defaults)
**Status:** APPROVED

### Decision
Super Admin created via `prisma/seed.ts`. No first-run setup route in V1.

### Rationale
- Simpler; reduces attack surface
- VPS deployment means server access is already controlled
- Credentials set via environment variable in seed

---

## DECISION-005: Rate Limiting — In-Memory + Abstract Interface

**Date:** 2026-09-16
**Owner:** User (approved via implementation plan defaults)
**Status:** APPROVED

### Decision
`RateLimiter` interface with in-memory implementation (Map + sliding window). Swap to Redis (`@upstash/ratelimit`) for multi-server.

### Trade-offs Accepted
- In-memory rate limiting lost on process restart
- Acceptable for V1 single-server

---

## DECISION-006: Deployment Hostname — Environment-Configurable via APP_URL

**Date:** 2026-09-16
**Owner:** User (explicit instruction)
**Status:** APPROVED

### Decision
No hardcoded production domain. All cookie `domain`, CSP, and CORS configuration reads from `APP_URL` environment variable.

---

## DECISION-007: Tenant Isolation — Row-Level companyId on All Tenant-Owned Entities

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
Every tenant-owned table has a `companyId` column. Every repository query mandatorily includes `WHERE companyId = ?`. No PostgreSQL RLS for V1 (row-level at application layer is simpler to test and audit).

---

## DECISION-008: Permission Model — DB-Stored + Centralized authorize()

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
Permissions stored in DB per role. Centralized `authorize(ctx, action)` called at every API route. No scattered if/role-name checks. Data scope (OWN/TEAM/COMPANY) enforced at repository query level.

---

## DECISION-009: Pagination — Offset for UI Lists, Cursor for Large Entity Lists

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
Default page size 20. Max 100. Offset pagination for admin lists and settings. Cursor pagination for leads (1M+ records). No unbounded GET /all endpoints.

---

## DECISION-010: Search — PostgreSQL Full-Text + pg_trgm

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
Use `pg_trgm` extension for trigram-based search on leads (name, email, phone). No Elasticsearch for V1. Measure before adding infrastructure.

---

## DECISION-011: Background Jobs — Inline Async + Abstract JobQueue Interface

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
V1: process inline async for tasks like email sending (non-blocking where appropriate). Abstract `JobQueue` interface created for future BullMQ swap.

---

## DECISION-012: Caching — Next.js unstable_cache Only Where Proven Necessary

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
No Redis cache layer for V1. Use Next.js `unstable_cache` (or `cache()`) only for proven hot paths (e.g., permission loading, company settings). Measure before caching.

---

## DECISION-013: Timezone — UTC Storage + Company Timezone Display

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
All timestamps stored as UTC in PostgreSQL. All display formatted using company's configured timezone via `date-fns-tz`. Date-range report filters use company-local calendar boundaries.

---

## DECISION-014: ORM — Prisma 5.x

**Date:** 2026-09-16
**Owner:** PRD v2.0 specification
**Status:** APPROVED

### Decision
Prisma 5.x. All queries via Prisma client (no raw SQL except for migrations and performance-critical indexed queries). Parameterized queries enforced by Prisma.

---

## DECISION-015: Soft Delete — deletedAt on CRM Entities

**Date:** 2026-09-16
**Owner:** Architectural decision
**Status:** APPROVED

### Decision
`deletedAt: DateTime?` on Lead, User. Hard delete never used for CRM entities. Soft-deleted records excluded from all normal queries by default.

---

## DECISION-016: Rendering Strategy — Server Components Default

**Date:** 2026-09-16
**Owner:** Next.js architecture decision
**Status:** APPROVED

### Decision
Default to React Server Components. Use `"use client"` only where required (interactivity, browser APIs, state). Authorization always verified server-side. Never trust client-supplied tenant/user/permission data.

---

## DECISION-017: API Versioning — /api/v1/ Prefix

**Date:** 2026-09-16
**Owner:** PRD v2.0 specification
**Status:** APPROVED

### Decision
All API route handlers under `/app/api/v1/`. Breaking changes require `/api/v2/`. Stable error codes across versions.
