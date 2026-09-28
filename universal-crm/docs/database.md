# Universal CRM — Database Documentation

Version: 1.0
Updated: Slice 1 Foundation

---

## Overview

PostgreSQL 15+ with Prisma 5.22 ORM.
Schema defined in `prisma/schema.prisma`.

All timestamps stored in UTC. Timezone conversion for display is done in the
application layer using `date-fns-tz` and the company's configured timezone.

---

## Tenant Isolation

Every tenant-owned table has `companyId` as a foreign key to `companies.id`.
No RLS is used — isolation is enforced at the application repository layer.

**Rule:** Every Prisma query on tenant-owned tables MUST include:
```typescript
where: { companyId: ctx.companyId, ... }
```

This is verified in code review and the Spectator phase of each slice.

---

## Entity Summary

| Table | Description | Tenant-Owned | Soft Delete |
|---|---|---|---|
| `super_admins` | Platform-level admin | No | No |
| `companies` | Tenant roots | No | No |
| `roles` | Per-company roles | Yes | No |
| `permissions` | Role permissions | Yes | No |
| `users` | Company users | Yes | Yes (deletedAt) |
| `teams` | User groups | Yes | No |
| `team_members` | Team assignments | Yes | No |
| `sessions` | Auth sessions | Yes | No |
| `invitations` | User invitations | Yes | No |
| `password_reset_tokens` | Password resets | Yes (via user) | No |
| `lead_sources` | Source config | Yes | No |
| `lead_statuses` | Status pipeline | Yes | No |
| `leads` | Core CRM entity | Yes | Yes (deletedAt) |
| `lead_status_histories` | Status timeline | Yes | No |
| `lead_assignment_histories` | Assignment timeline | Yes | No |
| `activities` | Lead timeline events | Yes | No |
| `notes` | Lead notes | Yes | No |
| `tasks` | Follow-up tasks | Yes | No |
| `audit_logs` | Audit trail | Yes/No | No |

---

## Schema Design Decisions

### IDs
All IDs use `cuid()` (via Prisma's `@default(cuid())`). URL-safe, collision-resistant,
sortable. Not sequential (no information leakage about entity counts).

### Soft Delete
`deletedAt: DateTime?` on `leads` and `users`. All normal queries filter:
```typescript
where: { companyId, deletedAt: null }
```
Hard delete is never performed on these entities in V1.

### Tokens
All tokens (sessions, invitations, password resets) stored as SHA-256 hashes.
Raw tokens are sent to the client only. This prevents exposure if the database
is compromised.

### Timestamps
All timestamps: `DateTime` = PostgreSQL `TIMESTAMP(3) WITH TIME ZONE` stored in UTC.

---

## Indexes

### High-Priority Indexes (for filter performance)
```
leads: companyId
leads: (companyId, statusId)
leads: (companyId, sourceId)
leads: (companyId, assignedUserId)
leads: (companyId, teamId)
leads: (companyId, priority)
leads: (companyId, createdAt DESC)
leads: (companyId, deletedAt)
audit_logs: (companyId, createdAt DESC)
activities: (companyId, createdAt DESC)
sessions: expiresAt               ← for cleanup job
sessions: tokenHash               ← unique lookup
```

### Search (Planned Slice 4)
`pg_trgm` extension on `leads.name`, `leads.email`, `leads.phone`.
GIN index for trigram-based fuzzy search.

---

## Common Queries

### Lead List (paginated, filtered)
```typescript
prisma.lead.findMany({
  where: {
    companyId: ctx.companyId,
    deletedAt: null,
    statusId: params.statusId,       // optional filter
    assignedUserId: params.userId,   // optional filter
  },
  orderBy: { createdAt: "desc" },
  skip: (page - 1) * pageSize,
  take: pageSize,
  include: { status: true, assignedUser: true, source: true },
});
```

### Lead Count (for pagination)
```typescript
prisma.lead.count({
  where: { companyId: ctx.companyId, deletedAt: null, ...filters },
});
```

### Session Lookup (per request)
```typescript
prisma.session.findUnique({
  where: { tokenHash: sha256(cookieToken) },
  include: { user: { include: { role: { include: { permissions: true } } } }, company: true },
});
```

---

## Migration Workflow

```bash
# Development: create and apply migration
npx prisma migrate dev --name "describe_change"

# Production: apply pending migrations
npx prisma migrate deploy

# Reset dev database (seed included)
npm run db:reset
```

## Seed

```bash
# Run seed (requires DATABASE_URL in .env.local)
npx prisma db seed
```

Seed creates:
- 1 Super Admin
- 2 Companies (Acme Corp, Zenith Solutions)
- 5 roles per company with permissions
- 4 users per company
- 1 team per company
- 5 lead sources + 6 lead statuses per company
- 50 leads per company with notes, tasks, and activities

See `prisma/seed.ts` for credentials printed at the end of the seed run.
