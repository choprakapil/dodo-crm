# Universal CRM — Security Operations & Developer Policy

A definitive security manual documenting the cryptographic standards, multi-tenant defense layers, and mandatory security rules for developers maintaining Universal CRM.

---

## 1. Cryptographic Standards & Credentials

### 1.1 Password Hashing
- **Algorithm**: `bcryptjs` with **12 salt rounds**.
- **Password Complexity Rules**:
  - Minimum 8 characters.
  - At least 1 uppercase letter (`[A-Z]`).
  - At least 1 lowercase letter (`[a-z]`).
  - At least 1 number (`[0-9]`).
  - At least 1 special character (`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).
- **Timing Safe Verification**: Uses bcrypt's built-in constant-time comparison to prevent timing side-channel attacks.

### 1.2 Session Token Hashing & Management
- **Token Generation**: 32 cryptographically secure random bytes generated using Node.js `crypto.randomBytes(32).toString("hex")` (64-character hex string with 256 bits of entropy).
- **Token Storage**: The raw token is **never stored in the database**.
  - A **SHA-256 hash** (`crypto.createHash("sha256").update(token).digest("hex")`) is saved to the `sessions.tokenHash` column.
  - If the database is compromised, existing session tokens cannot be extracted.
- **Client Transport**: Delivered exclusively via HTTP-only, SameSite=Lax, Path=/, 24-hour expiration cookies (`crm_session_token`). Marked `Secure` in production environments.
- **Revocation**: Deleting the row in `sessions` immediately terminates all access.

### 1.3 Invitation Token Security
- 32-byte crypto token generated on invitation creation.
- Stored as SHA-256 in `invitations.tokenHash`.
- Hard 7-day expiration (`expiresAt`).
- Enforces single-use status: `acceptedAt` is checked and set atomically within a database transaction upon account creation.

---

## 2. Multi-Tenant Defense-in-Depth

Universal CRM implements four layers of defense to guarantee tenant data isolation:

```text
Layer 1: Edge Route Protection (middleware.ts)
   ↳ Validates session cookie presence before routing to /app/* or /admin/*

Layer 2: Server-Side Context Hydration (session.ts)
   ↳ Fetches User, Tenant, Role, and Permissions strictly from DB
   ↳ Verifies UserStatus == ACTIVE, CompanyStatus == ACTIVE, deletedAt == null

Layer 3: Service-Level Query Binding
   ↳ All database queries explicitly include `companyId: ctx.company.id`

Layer 4: Foreign Key Tenant Ownership Validation
   ↳ Verifies statusId, sourceId, teamId, or userId belong to caller's companyId
```

### 2.1 IDOR (Insecure Direct Object Reference) Protection
When querying or updating any entity by ID:
```typescript
// SECURE PATTERN ENFORCED EVERYWHERE:
const lead = await prisma.lead.findFirst({
  where: {
    id: targetId,
    companyId: ctx.company.id, // Mandatory tenant isolation
    deletedAt: null,           // Exclude soft-deleted
  },
});

if (!lead) {
  // Returns 404 regardless of whether ID exists in another tenant!
  // Prevents account enumeration and foreign existence leakage.
  throw new NotFoundError("Lead not found");
}
```

### 2.2 Foreign Key Injection Defense
When an entity references another entity (e.g. assigning a lead to a team or status):
```typescript
// The service verifies foreign keys belong to the caller's tenant:
if (input.statusId) {
  const status = await prisma.leadStatus.findFirst({
    where: { id: input.statusId, companyId: ctx.company.id },
  });
  if (!status) throw new ValidationError("Invalid lead status");
}
```
A malicious user from Company A cannot attach an opportunity to Company B's status or team.

---

## 3. Threat Model Defenses

### 3.1 Spreadsheet Formula Injection (CSV Injection)
When exporting lead reports:
- Spreadsheet applications (Excel, Google Sheets, LibreOffice) can execute arbitrary code if cell values begin with formulas.
- **Defense**: Universal CRM checks every cell. Any string starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is automatically escaped by prepending a single quote (`'`).

### 3.2 Privilege Escalation Prevention
- **System Roles**: `Admin`, `Manager`, `Sales Rep`, `Viewer`, `Support` are flagged with `isSystem: true` and cannot be deleted or renamed.
- **Custom Role Boundary**: Only users possessing administrative privileges can create or modify roles. A user cannot assign a role with permissions they do not possess.
- **Self-Lockout**: Administrators cannot deactivate their own account or strip their own administrative role.

### 3.3 Soft Delete Data Isolation
Entities with historical significance (`Lead`, `User`, `CustomField`) implement soft deletion via `deletedAt DateTime?`.
- Standard API endpoints filter `deletedAt: null`.
- Direct lookups for soft-deleted records return HTTP 404 (`NotFoundError`).
- Historical audit logs and timelines retain integrity.

---

## 4. Mandatory Developer Security Commandments

Every engineer contributing to Universal CRM must strictly adhere to these rules:

1. **NEVER trust client-supplied `companyId`**: Always derive the tenant ID from `ctx.company.id`.
2. **NEVER trust client-supplied `userId`**: Derive actor identity from `ctx.user.id`.
3. **NEVER trust client-supplied `role` or `permissions`**: Read permissions from `ctx.permissions`.
4. **NEVER query tenant data without tenant scope**: Every `findFirst`, `findMany`, `update`, or `delete` must filter by `companyId: ctx.company.id`.
5. **NEVER expose soft-deleted records**: Always include `deletedAt: null` in query predicates.
6. **NEVER return different error messages for foreign vs non-existent records**: Always return generic `NotFoundError: Entity not found` (HTTP 404) to prevent cross-tenant enumeration.
7. **NEVER log sensitive credentials**: Application logs must never output raw passwords, hashes, reset tokens, or session tokens.
8. **NEVER allow custom role privilege escalation**: Ensure role creation and mutation endpoints verify the creator's administrative standing.
9. **NEVER cross tenant and platform session boundaries**: Platform operators must use dedicated `universal_crm_superadmin_session` cookies; tenant sessions must be rejected by all `/admin/*` routes.
10. **NEVER leave active sessions alive on tenant suspension**: Suspending a company must immediately purge all active tenant sessions from PostgreSQL.
11. **NEVER allow customer profile viewing to bypass Enquiry Data Scope**: A Sales Rep with `OWN` scope must only see their assigned enquiries on customer detail profiles; foreign enquiries must be completely redacted.
12. **NEVER mutate or delete underlying enquiries on customer modification/soft-deletion**: The relationship is strictly `ONE CUSTOMER ≠ ONE ENQUIRY`. Deleting a customer must never orphan or cascade delete transactional opportunity records.

---

## 5. Super Admin Platform Security Protocols (Slice 8)

### 5.1 Cookie Separation & Zero-Crossover Invariant
- Platform operators use `universal_crm_superadmin_session`.
- Tenant CRM users use `universal_crm_session`.
- No cookie collision can occur. `validateSuperAdminSessionToken` strictly validates against `super_admin_sessions`; `validateSessionToken` strictly validates against tenant `sessions`.

### 5.2 Tenant Suspension Purge
Suspending a company executes:
```typescript
await prisma.$transaction([
  prisma.company.update({ where: { id: companyId }, data: { status: CompanyStatus.SUSPENDED } }),
  prisma.session.deleteMany({ where: { companyId } }),
]);
```
This ensures zero latency in revoking active tenant access across all devices.

### 5.3 Mass Assignment Defense
Every platform schema (`provisionCompanySchema`, `updatePlanSchema`, `suspendCompanySchema`, `assignPlanSchema`, etc.) enforces `.strict()`. Any client attempting to pass injected fields (`superAdminId`, `companyId`, `passwordHash`, `createdAt`) is rejected with a validation error.

### 5.4 Platform Audit Trail Immutability
`PlatformAuditLog` is append-only. There are no update or delete routes for platform audit logs. Tenant users have zero access to platform audit tables.

---

## 6. Customer Identity Security Protocols (Phase 5)

### 6.1 Multi-Tenant Phone Uniqueness & Conflict Defense
- Phones are normalized to strict E.164.
- `@@unique([companyId, normalizedPhone])` guarantees that two distinct customers within the same tenant cannot share the same phone identity.
- Conflict attempts trigger HTTP 409 Conflict without revealing unauthorized identity details.

### 6.2 Data Scope Enforcement on Customer History
- Customer profiles enforce independent enquiry scoping.
- Calling `getCustomerById()` filters linked `Lead` entities using `getLeadDataScopeWhere(ctx, "view")`.
- If a user lacks `leads.view` permission altogether, the enquiry summary returns zero records with zero error leakage.

### 6.3 Soft-Deletion Preservation
- `DELETE /api/v1/customers/:id` sets `deletedAt = now()` on the Customer entity.
- Linked `Lead`, `Activity`, `Task`, and `CustomFieldValue` rows remain untouched in PostgreSQL.
- Foreign key constraint is `onDelete: SetNull` so deleting a customer record never cascades to destroy business history.

