import assert from "node:assert/strict";
import { resolveDateRange, calculateChangePercent } from "../lib/services/analytics/date-range";
import { analyticsQuerySchema, analyticsExportSchema } from "../lib/validations/analytics";

export async function runAnalyticsUnitTests() {
  console.log("\n🧪 Running Slice 6: Analytics Unit Tests...");

  // ---------------------------------------------------------------------------
  // 1. Percentage Change Calculations
  // ---------------------------------------------------------------------------
  assert.equal(calculateChangePercent(0, 0), 0, "0 vs 0 must equal 0%");
  assert.equal(calculateChangePercent(10, 0), 100, "10 vs 0 must equal +100%");
  assert.equal(calculateChangePercent(-10, 0), -100, "-10 vs 0 must equal -100%");
  assert.equal(calculateChangePercent(150, 100), 50, "150 vs 100 must equal 50%");
  assert.equal(calculateChangePercent(80, 100), -20, "80 vs 100 must equal -20%");
  assert.equal(calculateChangePercent(115, 100), 15, "115 vs 100 must equal 15%");
  assert.equal(calculateChangePercent(105, 100), 5, "105 vs 100 must equal 5%");
  console.log("  ✓ Percentage change zero-safe math verified");

  // ---------------------------------------------------------------------------
  // 2. Preset Date Range Calculations
  // ---------------------------------------------------------------------------
  const refNow = new Date("2026-09-16T15:00:00.000Z");

  // TODAY
  const todayRange = resolveDateRange({ preset: "TODAY", referenceNow: refNow });
  assert.equal(todayRange.current.start.toISOString().slice(0, 10), "2026-09-16");
  assert.equal(todayRange.current.end.toISOString().slice(0, 10), "2026-09-16");
  assert.equal(todayRange.previous.start.toISOString().slice(0, 10), "2026-09-15");
  assert.equal(todayRange.previous.end.toISOString().slice(0, 10), "2026-09-15");

  // YESTERDAY
  const yesterdayRange = resolveDateRange({ preset: "YESTERDAY", referenceNow: refNow });
  assert.equal(yesterdayRange.current.start.toISOString().slice(0, 10), "2026-09-15");
  assert.equal(yesterdayRange.current.end.toISOString().slice(0, 10), "2026-09-15");

  // LAST_7_DAYS
  const last7DaysRange = resolveDateRange({ preset: "LAST_7_DAYS", referenceNow: refNow });
  const dayDiff7 = Math.round(
    (last7DaysRange.current.end.getTime() - last7DaysRange.current.start.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  assert.equal(dayDiff7, 7, "Last 7 days duration must be 7 days");
  assert.equal(
    last7DaysRange.previous.end.getTime() + 1,
    last7DaysRange.current.start.getTime(),
    "Previous period must immediately precede current period"
  );

  // LAST_30_DAYS
  const last30DaysRange = resolveDateRange({ preset: "LAST_30_DAYS", referenceNow: refNow });
  const dayDiff30 = Math.round(
    (last30DaysRange.current.end.getTime() - last30DaysRange.current.start.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  assert.equal(dayDiff30, 30, "Last 30 days duration must be 30 days");

  // THIS_MONTH
  const thisMonthRange = resolveDateRange({ preset: "THIS_MONTH", referenceNow: refNow });
  assert.equal(thisMonthRange.current.start.getDate(), 1, "This month must start on 1st");
  assert.equal(thisMonthRange.current.start.getMonth(), refNow.getMonth());

  // THIS_YEAR
  const thisYearRange = resolveDateRange({ preset: "THIS_YEAR", referenceNow: refNow });
  assert.equal(thisYearRange.current.start.getFullYear(), refNow.getFullYear());
  assert.equal(thisYearRange.current.start.getMonth(), 0);
  assert.equal(thisYearRange.current.start.getDate(), 1);

  // CUSTOM RANGE
  const customRange = resolveDateRange({
    preset: "CUSTOM",
    from: "2026-08-01",
    to: "2026-08-15",
  });
  assert.equal(customRange.current.start.toISOString().slice(0, 10), "2026-08-01");
  assert.equal(customRange.current.end.toISOString().slice(0, 10), "2026-08-15");
  console.log("  ✓ All date presets and comparison windows resolved accurately");

  // ---------------------------------------------------------------------------
  // 3. Validation Schemas
  // ---------------------------------------------------------------------------
  // Default query parsing
  const defaultQuery = analyticsQuerySchema.parse({});
  assert.equal(defaultQuery.preset, "LAST_30_DAYS");

  // Valid custom query
  const validCustom = analyticsQuerySchema.parse({
    preset: "CUSTOM",
    from: "2026-01-01",
    to: "2026-03-31",
    teamId: "team_123",
  });
  assert.equal(validCustom.preset, "CUSTOM");
  assert.equal(validCustom.teamId, "team_123");

  // Invalid custom: from > to
  const invalidOrder = analyticsQuerySchema.safeParse({
    preset: "CUSTOM",
    from: "2026-05-01",
    to: "2026-01-01",
  });
  assert.equal(invalidOrder.success, false, "Must reject from > to");

  // Invalid custom: missing from or to
  const missingDates = analyticsQuerySchema.safeParse({
    preset: "CUSTOM",
    from: "2026-01-01",
  });
  assert.equal(missingDates.success, false, "Must reject custom without to date");

  // Invalid custom: diff > 730 days (DoS defense)
  const excessiveRange = analyticsQuerySchema.safeParse({
    preset: "CUSTOM",
    from: "2020-01-01",
    to: "2026-01-01",
  });
  assert.equal(excessiveRange.success, false, "Must reject date range exceeding 730 days");

  // Export query validation
  const exportQuery = analyticsExportSchema.parse({
    report: "team",
    preset: "LAST_7_DAYS",
  });
  assert.equal(exportQuery.report, "team");
  assert.equal(exportQuery.preset, "LAST_7_DAYS");

  const invalidReport = analyticsExportSchema.safeParse({
    report: "unsupported_report",
  });
  assert.equal(invalidReport.success, false, "Must reject unsupported report types");

  console.log("  ✓ Analytics query & export validation schemas passed");
  console.log("✅ Slice 6: Analytics Unit Tests Passed!\n");
}

if (require.main === module) {
  runAnalyticsUnitTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
