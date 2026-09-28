# Roles, Permissions & Data Scopes

Universal CRM implements a strict, centralized Role-Based Access Control (RBAC) model with multi-tenant data scoping.

---

## 1. The 5 Immutable System Roles

Every company account is seeded with 5 core system roles:
1. **Admin**: Complete administrative control over all modules, company settings, users, and audit logs.
2. **Manager**: Departmental leadership with `TEAM` scope over leads, tasks, and analytics.
3. **Sales Rep**: Frontline sales rep with `OWN` scope over assigned leads and follow-ups.
4. **Viewer**: Read-only access to company-wide leads and reports without editing rights.
5. **Support**: Operational support access for managing customer touchpoints.

> [!IMPORTANT]
> System roles have `isSystem: true` and cannot be deleted or renamed.

---

## 2. Custom Role Builder (`/app/settings/roles`)

Administrators can construct custom roles tailored to specific workflows:
1. Navigate to **Settings > Roles**.
2. Click **+ Create Custom Role**.
3. Enter a role name and description.
4. Configure permissions across the 8 core modules:
   - `leads` (`view`, `create`, `update`, `delete`, `assign`)
   - `activities` (`view`, `create`, `update`, `delete`)
   - `tasks` (`view`, `create`, `update`, `delete`)
   - `analytics` (`view`, `export`)
   - `users` (`view`, `create`, `update`, `manage`)
   - `teams` (`view`, `create`, `update`, `manage`, `delete`)
   - `settings` (`view`, `manage`)
   - `audit_logs` (`view`)
5. Select the **Data Scope** for each permission:
   - **OWN**: Restricted to records assigned to the caller.
   - **TEAM**: Restricted to records assigned to the caller's team.
   - **COMPANY**: Full organization visibility.
6. Click **Save Role**.

### Privilege Escalation Protections
- Non-administrators cannot grant permissions they do not possess.
- Custom roles cannot grant platform-level privileges.
