[STATE]

# Documentation State & Coverage

Status: COMPLETE
Slice: SLICE 7.5 — DOCUMENTATION & HELP CENTER
Date: 2026-09-17

---

## 1. Documentation Architecture

Universal CRM provides a dual documentation system:
1. **Developer & Engineering Reference (`docs/`)**: Markdown files structured for technical maintainers, devops, and security auditors.
2. **In-App Help Center (`/app/help`)**: Interactive, fast, searchable documentation center embedded directly inside the authenticated web application, with permission-aware article filtering.

---

## 2. Available Engineering & Operational Guides

| Document | Audience | Scope | Status |
|---|---|---|:---:|
| `docs/INDEX.md` | All | Master documentation table of contents | ✅ Complete |
| `docs/USER_GUIDE.md` | Users / Sales Staff | End-user lead workflows, daily follow-ups, and security | ✅ Complete |
| `docs/ADMIN_GUIDE.md` | Company Admins | User provisioning, invitations, teams, custom roles, sessions | ✅ Complete |
| `docs/SUPER_ADMIN_GUIDE.md` | Platform Operators | Platform console & cross-tenant ops (*Slice 8 target*) | ⏳ Planned Spec |
| `docs/SYSTEM_ARCHITECTURE.md` | Engineers | Identity flow, AuthContext, data scoping, multi-tenancy | ✅ Complete |
| `docs/SECURITY_OPERATIONS.md` | Security / Devs | Cryptography, session hashing, IDOR defense, developer rules | ✅ Complete |
| `docs/TROUBLESHOOTING.md` | Support / Devs | Diagnostics playbooks for login, leads, invites, and sessions | ✅ Complete |
| `docs/DEPLOYMENT_GUIDE.md` | DevOps | Node.js, PostgreSQL, Nginx, SSL, PM2, and backup runbooks | ✅ Complete |
| `docs/API_GUIDE.md` | Developers | REST API catalog across all active endpoints (Slices 1–7) | ✅ Complete |
| `docs/DATABASE_GUIDE.md` | DBAs / Engineers | Prisma schema, relational foreign keys, composite indexes | ✅ Complete |
| `docs/CHANGELOG.md` | All | Historical changelog of completed vertical slices | ✅ Complete |

---

## 3. In-App Help Center (`/app/help`)

- **Route**: `/app/help`
- **Component**: `components/help/help-center-workspace.tsx`
- **Data Source**: `lib/help-articles.ts`
- **Markdown Mirror**: `docs/help/*.md` (14 articles)
- **Features**:
  - Global real-time keyword search across titles, summaries, tags, and content.
  - Category sidebar with badge counters.
  - Dedicated article reader with clean typography and tag pills.
  - Permission-aware visibility: Admin-only categories (`users`, `teams`, `roles-permissions`, `company-settings`, `custom-fields`, `audit-logs`) are hidden from standard users lacking administrative permissions.

---

## 4. Contextual Help Links Across Existing Screens

Unobtrusive `?` help links connect users from operational screens directly to the relevant help guide:
- Users Management → `/app/help?article=users`
- Teams Management → `/app/help?article=teams`
- Roles & Permissions → `/app/help?article=roles-permissions`
- Company Settings → `/app/help?article=company-settings`
- Security & Sessions → `/app/help?article=security`
- Audit Logs → `/app/help?article=audit-logs`
- Custom Fields → `/app/help?article=custom-fields`
- Lead Import → `/app/help?article=import-export`
- Leads List → `/app/help?article=leads`
- Follow-ups Workspace → `/app/help?article=follow-ups`
- Executive Dashboard → `/app/help?article=dashboard`

---

## 5. Relationship with Slice 8 Documentation

- Super Admin operations are documented exclusively in `docs/SUPER_ADMIN_GUIDE.md` and are explicitly tagged **PLANNED / NOT YET IMPLEMENTED**.
- No placeholder routes or mock Super Admin pages exist in `/app/help` or the application code.
- When Slice 8 is executed, `docs/SUPER_ADMIN_GUIDE.md` will be promoted from a planned specification to an active operational guide.
