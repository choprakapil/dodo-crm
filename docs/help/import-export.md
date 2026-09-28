# Lead Import & Export Operations

Universal CRM includes a high-performance, streaming RFC 4180 CSV engine built from the ground up for reliable bulk data migration.

---

## 1. Importing Leads from CSV

To access the import wizard:
1. Navigate to `/app/leads` and click **Import Leads** (or visit `/app/leads/import`).
2. **Step 1 — Upload**:
   - Drag and drop your `.csv` file.
   - The file is read client-side and sent to the server preview endpoint.
3. **Step 2 — Column Mapping**:
   - The system automatically matches CSV headers against lead fields (Name, Email, Phone, Company, Deal Value, Status, Source, Priority) and company **Custom Fields**.
   - Review the suggested mappings and adjust any unmapped columns.
4. **Step 3 — Duplicate Strategy**:
   - **SKIP**: If a lead with matching email or phone exists, ignore the CSV row.
   - **UPDATE**: Update existing lead attributes with the CSV row values.
   - **CREATE**: Always create a new lead record regardless of matches.
5. **Step 4 — Execute**:
   - Click **Start Import**. The server processes rows in atomic 100-row transaction chunks with in-memory reference caching.
   - Upon completion, view total rows processed, created, updated, and skipped.
   - If any rows failed validation, download the **Error Summary CSV** to inspect and correct the invalid lines.

---

## 2. Exporting Leads to CSV

To export your CRM data:
1. Navigate to `/app/leads`.
2. Apply any desired filters (e.g. status, priority, or search term).
3. Click **Export CSV** in the top-right toolbar.
4. The server generates a clean, RFC 4180 compliant CSV containing:
   - All standard lead columns.
   - Active dynamic custom fields.
   - Strictly scoped to your permissions (Sales Reps export only their leads; Admins export company leads).

### Spreadsheet Formula Injection Protection
Exported files automatically neutralize malicious spreadsheet formulas:
- Any cell value starting with dangerous formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) is automatically prefixed with a single quote (`'`).
- This prevents formula execution attacks when opening exported data in Microsoft Excel or Google Sheets.
