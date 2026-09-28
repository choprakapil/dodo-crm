# Company Profile & Localization Settings

The Company Settings page (`/app/settings/company`) configures your organization's identity and localization rules.

---

## 1. Branding & Identity

- **Company Name**: Your business's registered or trading name displayed in navigation and emails.
- **Company Slug**: Immutable multi-tenant URL slug.
- **Logo URL**: Public HTTPS URL to your company's logo icon.
- **Support Email & Phone**: Contact coordinates displayed on invitation emails and internal help banners.

---

## 2. Localization & Formats

- **Timezone**: Set your operating timezone (e.g. `UTC`, `America/New_York`, `Europe/London`, `Asia/Kolkata`). All backend dates are stored in UTC and rendered in your company timezone.
- **Currency**: Primary currency symbol (e.g. `USD`, `EUR`, `GBP`, `INR`, `AED`) applied to deal values, pipeline reports, and analytics.
- **Date Format**: Standardized display preference (`YYYY-MM-DD`, `DD/MM/YYYY`, or `MM/DD/YYYY`).

---

## 3. Audit Trail Integration

All updates made in Company Settings are atomically logged in the company's audit trail under the `company_settings.updated` action with a diff of modified fields.
