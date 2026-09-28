# Feature Contract: Dynamic Custom Fields (Slice 5)

**Status:** APPROVED & LOCKED  
**Module:** `custom_fields`, `leads`  
**Version:** 1.0  
**Target Scale:** 1,000+ companies / 1,000,000+ leads / dynamic normalized attributes  

---

## 1. Actors & Data Scope Permissions
- **Tenant Admin:** `COMPANY` data scope across `custom_fields` (`manage`, `create`, `update`, `delete`). Can define, modify, reorder, and soft-delete company custom field definitions.
- **Manager:** `TEAM` data scope across leads (`view`, `update`). Can view custom field definitions (`custom_fields:view`) and populate custom field values for leads in their team.
- **Sales Rep / Employee:** `OWN` data scope across leads (`view`, `update`). Can view active custom field definitions and populate/update custom field values for leads assigned to or created by them.
- **Support / Viewer:** Read-only (`COMPANY` scope). Can view custom field values on visible leads.

---

## 2. Preconditions & Tenant Isolation
- User must possess a valid, non-expired database-backed session cookie (`universal_crm_session`).
- User must belong to an `ACTIVE` company.
- Tenant context is strictly derived from the validated server-side `AuthContext`.
- Client-supplied `companyId`, `tenantId`, `id`, `createdAt`, `updatedAt` are rejected and sanitized.
- Custom field definitions and values are isolated per tenant (`companyId`). Cross-tenant field definitions or values return HTTP 404 (`NotFoundError`) to prevent information leakage.
- Unique constraints: `[companyId, entityType, key]` on `CustomField` ensures no colliding keys within the tenant.
- Normalization: Custom field values are stored in a normalized `custom_field_values` table with composite unique index `[companyId, customFieldId, entityId]`.

---

## 3. Supported Field Types & Validation Rules
1. `TEXT`: Single-line text up to 500 characters.
2. `TEXTAREA`: Multi-line text up to 5,000 characters.
3. `NUMBER`: Numeric floating-point or integer value (stored as JSON number, validated via `z.number()`).
4. `DATE`: ISO 8601 date string (`YYYY-MM-DD`).
5. `DATETIME`: ISO 8601 datetime string.
6. `BOOLEAN`: Boolean value (`true` / `false`).
7. `SELECT`: Single choice selected strictly from the custom field's predefined `options` list.
8. `MULTI_SELECT`: Array of choices, each of which must exist in the predefined `options` list.
9. `URL`: Valid URL string conforming to web URL standard.
10. `EMAIL`: Valid RFC 5322 email string format.
11. `PHONE`: Phone string normalized to international or local format (max 50 chars).

---

## 4. End-to-End User Flows

### A. Custom Field Management Workspace (`/app/settings/custom-fields`)
1. Tenant Admin navigates to `/app/settings/custom-fields` via the "Custom Fields" top navigation item.
2. Workspace lists all company custom fields ordered by `sortOrder` ascending.
3. Admin clicks `[+ Add Custom Field]` modal dialog.
4. Enters Label (e.g. "Property Budget"), Key (auto-generated snake_case e.g. "property_budget"), Field Type (1 of 11), Required flag, Description, and Options (for Select / Multi-Select).
5. Submits `POST /api/v1/custom-fields`. Server validates payload, checks for duplicate key, persists record, and logs `custom_field.create` to `AuditLog`.
6. Admin can edit labels, descriptions, options, or toggle active status via `PATCH /api/v1/custom-fields/:id`.
7. Admin can soft-delete a field via `DELETE /api/v1/custom-fields/:id` (`deletedAt: new Date()`, `active: false`).
8. Admin can reorder fields atomically via `POST /api/v1/custom-fields/reorder`.

### B. Lead Creation & Editing with Custom Fields
1. Actor clicks `[+ New Lead]` on `/app/leads`.
2. The create lead dialog fetches active custom fields for `LEAD` and dynamically renders inputs matching each field's type:
   - Text/Email/Phone/URL -> Styled Input
   - Textarea -> Styled Textarea
   - Number -> Numeric Input
   - Boolean -> Native Toggle/Checkbox
   - Select -> Dropdown populated with field options
   - Multi-Select -> Checkbox group / tag picker
3. Submitting `POST /api/v1/leads` includes `customFields: { [key]: value }`.
4. Server parses and validates each custom value against its field type and options inside a database transaction.
5. In `Lead Detail` (`/app/leads/:id`), a dedicated `Custom Fields` card displays all active custom attributes formatted according to type (e.g. badges for multi-select, formatted dates, clickable URLs/emails).

---

## 5. Security & Tamper Resistance Guarantees
- **IDOR Protection:** All operations strictly enforce `companyId: ctx.company.id`. Cross-tenant custom field access returns 404.
- **Type Tampering Prevention:** Saving invalid data types (e.g. passing `"not-a-number"` to `NUMBER`, or an option not in `options` to `SELECT`) is rejected at runtime with `ValidationError` (400).
- **Scope Enforcement:** Users can only save custom fields on leads they are authorized to edit (`getLeadDataScopeWhere(ctx, "edit")`).
- **Audit Logging:** Every custom field creation, update, and soft-deletion is recorded in `AuditLog`.
