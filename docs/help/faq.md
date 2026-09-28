# Frequently Asked Questions (FAQ)

### Q: Why can't I see all the leads in my company?
**A:** Universal CRM enforces strict **Data Scoping**. If you have a **Sales Rep** role, you can only see leads assigned directly to you (`OWN` scope). If you have a **Manager** role, you see leads assigned to members of your team (`TEAM` scope). Only **Admins** have organization-wide visibility (`COMPANY` scope).

---

### Q: What happens when an invitation token expires?
**A:** Invitation tokens expire after 7 days. If an invite expires, an administrator can simply open **Settings > Users** and re-send an invitation to generate a fresh 7-day token.

---

### Q: If a user is deactivated, can they still log in?
**A:** No. When a user's status is changed to `DISABLED`, all active sessions are instantly purged from the database. Any existing session token is rejected immediately on the next request.

---

### Q: Can deleted leads be recovered?
**A:** Leads are soft-deleted by applying a `deletedAt` timestamp. While they do not appear in normal CRM tables or searches, their historical activities, assignments, and audit logs remain intact in the database.

---

### Q: How are duplicate leads detected during CSV import?
**A:** The import wizard checks for existing leads matching either the **Email** or **Phone** number within your company. You can choose whether to `SKIP` duplicate rows, `UPDATE` existing leads with the CSV data, or `CREATE` new records anyway.

---

### Q: Can custom fields be exported?
**A:** Yes. When you click **Export CSV** on the Leads page, all active custom fields are included as columns in the exported spreadsheet.
