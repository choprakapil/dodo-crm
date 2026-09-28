# Team Management & Departmental Rosters

Teams (`/app/settings/teams`) allow companies to group sales reps by territory, product line, or department, enabling departmental data scoping.

---

## 1. Creating a Team

1. Navigate to **Settings > Teams**.
2. Click **+ Create Team**.
3. Provide:
   - **Team Name**: e.g., "Enterprise Sales", "Inbound SDRs", "West Coast".
   - **Description**: Optional purpose or scope summary.
   - **Team Manager**: Designate an active user as manager.
4. Click **Create Team**.

> [!NOTE]
> When a manager is designated, they are automatically upserted into the `team_members` junction table so their roster is always synchronized.

---

## 2. Managing the Team Roster

Click on any team row to open the dedicated team view:
- **Add Member**: Click **+ Add Member**, select an active user, and add them to the team.
- **Remove Member**: Click **Remove** beside any member row to detach them from the roster.
- **Manager Badge**: The team manager is highlighted with a distinct shield badge.

---

## 3. Team Archiving

To retire a team without corrupting historical lead assignments:
1. Click **Archive Team** on the team card or detail view.
2. The team's `isActive` flag is set to `false`.
3. Leads and tasks previously assigned to the team remain intact, but the team can no longer receive new assignments.
