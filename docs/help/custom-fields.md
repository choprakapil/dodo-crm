# Configuring Dynamic Custom Fields

Every business is unique. Universal CRM allows administrators to add company-specific fields without altering database code or slowing down queries.

---

## 1. Supported Custom Field Types

Universal CRM supports 11 normalized field types:
1. **TEXT**: Single-line text (e.g. "VAT Number", "Referral Code").
2. **TEXTAREA**: Multi-line description (e.g. "Special Delivery Instructions").
3. **NUMBER**: Integers or floating-point figures (e.g. "Number of Employees").
4. **DATE**: Calendar date (`YYYY-MM-DD`).
5. **DATETIME**: Date with timestamp.
6. **BOOLEAN**: Yes / No checkbox or toggle.
7. **SELECT**: Single selection from a predefined whitelist of options.
8. **MULTI_SELECT**: Multiple tag selections from a whitelist.
9. **URL**: Web link with URL validation.
10. **EMAIL**: Email address with syntax validation.
11. **PHONE**: Contact phone number.

---

## 2. Managing Custom Fields (`/app/settings/custom-fields`)

1. Navigate to **Settings > Custom Fields**.
2. Click **+ Add Custom Field**.
3. Specify:
   - **Field Label**: Display name on forms and tables.
   - **Field Key**: Unique machine-readable identifier (e.g. `budget_approved`).
   - **Field Type**: Choose from the 11 supported types.
   - **Required**: Toggle whether this field is mandatory when creating leads.
   - **Options**: For `SELECT` and `MULTI_SELECT`, provide allowable choices.
4. Click **Save Field**.

---

## 3. Reordering & Soft Deletion

- **Reordering**: Fields are displayed on lead forms according to their `sortOrder`.
- **Soft Deletion**: Deleting a custom field hides it from future lead forms while preserving historical values on existing leads.
