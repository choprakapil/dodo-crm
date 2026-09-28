# Reports & Analytics Dashboard

The Executive Dashboard at `/app` provides a real-time, aggregated overview of your sales performance and operational health.

---

## 1. KPI Summary Cards

The top of the dashboard displays 6 primary sales performance indicators:
1. **Total Leads**: The total volume of active (non-deleted) leads within your data scope.
2. **New Leads**: Leads created within the currently selected date range, along with a zero-safe comparison delta against the preceding period.
3. **Converted Leads**: Leads that have reached a `CONVERTED` or `WON` status within the window.
4. **Conversion Rate**: Percentage of leads converted (`Converted / Total * 100`).
5. **Pipeline Value**: Aggregate monetary value of active opportunities in the pipeline.
6. **Follow-ups Due**: Pending follow-up tasks due today or overdue requiring urgent attention.

---

## 2. Date Range Filter

Use the date range selector at the top-right to adjust metrics:
- **Preset Options**: `Today`, `7 Days`, `30 Days`, `This Month`, `Quarter`, `Year`.
- **Custom Range**: Specify an exact start and end date (up to a maximum of 730 days).

---

## 3. Lead Creation Trend Chart

The interactive SVG area chart visualizes lead acquisition velocity:
- **Dynamic Bucketing**: Automatically groups data points by **Day** (periods <= 31 days), **Week** (<= 90 days), or **Month** (> 90 days).
- **Hover Tooltips**: Hover over data nodes to see the exact date and volume of leads captured.
- **Continuous Zero-Baseline**: Dates with zero lead creation are displayed with explicit 0 values for an honest, undistorted trendline.

---

## 4. Status & Source Breakdowns

- **Status Distribution**: Progress bars showing lead distribution across stages (e.g., New, Contacted, Qualified, Negotiation, Won, Lost).
- **Source Breakdown**: Acquisition channels (e.g., Website, Referrals, Google Ads, LinkedIn) with total lead counts and deal amounts.

---

## 5. Team Performance Leaderboard

Admins and Managers can inspect agent productivity:
- Displays Assigned Leads, Won Deals, Pipeline Amount, Completed Activities, and Conversion Rates.
- Uses server-side batched aggregations to ensure instant loading even with large historical databases.
- Click **Export CSV** to download a spreadsheet report with formula-injection defenses applied.
