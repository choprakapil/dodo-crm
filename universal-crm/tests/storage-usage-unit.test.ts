/**
 * Storage Usage & Unit Formatting Unit Tests
 *
 * Verifies byte conversion, threshold evaluation, and utilization percentage calculations.
 */

import {
  formatBytes,
  parseBytesToUnit,
  calculateUsagePercentage,
  evaluateStorageStatus,
} from "../lib/utils/format-bytes";

export async function runStorageUsageUnitTests() {
  console.log("\n🧪 Running Storage Usage & Formatting Unit Tests...");

  // 1. formatBytes tests
  console.log("  → [formatBytes] Zero, null, undefined, negative handling...");
  if (formatBytes(0) !== "0 B") throw new Error(`formatBytes(0) failed: got ${formatBytes(0)}`);
  if (formatBytes(null) !== "0 B") throw new Error(`formatBytes(null) failed: got ${formatBytes(null)}`);
  if (formatBytes(undefined) !== "0 B") throw new Error(`formatBytes(undefined) failed: got ${formatBytes(undefined)}`);
  if (formatBytes(-100) !== "0 B") throw new Error(`formatBytes(-100) failed: got ${formatBytes(-100)}`);
  if (formatBytes(NaN) !== "0 B") throw new Error(`formatBytes(NaN) failed: got ${formatBytes(NaN)}`);

  console.log("  → [formatBytes] Standard unit scaling (B, KB, MB, GB, TB)...");
  if (formatBytes(512) !== "512 B") throw new Error(`formatBytes(512) failed: got ${formatBytes(512)}`);
  if (formatBytes(1024) !== "1 KB") throw new Error(`formatBytes(1024) failed: got ${formatBytes(1024)}`);
  if (formatBytes(842 * 1024) !== "842 KB") throw new Error(`842 KB failed: got ${formatBytes(842 * 1024)}`);
  if (formatBytes(14.6 * 1024 * 1024) !== "14.6 MB") throw new Error(`14.6 MB failed: got ${formatBytes(14.6 * 1024 * 1024)}`);
  if (formatBytes(1.84 * 1024 * 1024 * 1024) !== "1.84 GB") throw new Error(`1.84 GB failed: got ${formatBytes(1.84 * 1024 * 1024 * 1024)}`);
  if (formatBytes(10 * 1024 * 1024 * 1024) !== "10 GB") throw new Error(`10 GB failed: got ${formatBytes(10 * 1024 * 1024 * 1024)}`);
  if (formatBytes(2.31 * 1024 * 1024 * 1024 * 1024) !== "2.31 TB") throw new Error(`2.31 TB failed: got ${formatBytes(2.31 * 1024 * 1024 * 1024 * 1024)}`);

  // 2. parseBytesToUnit tests
  console.log("  → [parseBytesToUnit] Deconstructed values...");
  const parsed = parseBytesToUnit(1.84 * 1024 * 1024 * 1024);
  if (parsed.unit !== "GB" || parsed.value !== 1.84) {
    throw new Error(`parseBytesToUnit failed: got ${JSON.stringify(parsed)}`);
  }

  // 3. calculateUsagePercentage tests
  console.log("  → [calculateUsagePercentage] Zero, null, edge cases...");
  if (calculateUsagePercentage(100, null) !== null) throw new Error("null limit should return null");
  if (calculateUsagePercentage(100, undefined) !== null) throw new Error("undefined limit should return null");
  if (calculateUsagePercentage(100, 0) !== null) throw new Error("0 limit should return null");
  if (calculateUsagePercentage(100, -100) !== null) throw new Error("negative limit should return null");

  console.log("  → [calculateUsagePercentage] Normal and over-limit percentages...");
  if (calculateUsagePercentage(0, 1000) !== 0) throw new Error("0 used should be 0%");
  if (calculateUsagePercentage(184, 1000) !== 18.4) throw new Error(`Expected 18.4%, got ${calculateUsagePercentage(184, 1000)}%`);
  if (calculateUsagePercentage(850, 1000) !== 85) throw new Error(`Expected 85%, got ${calculateUsagePercentage(850, 1000)}%`);
  if (calculateUsagePercentage(1500, 1000) !== 150) throw new Error(`Expected 150%, got ${calculateUsagePercentage(1500, 1000)}%`);

  // 4. evaluateStorageStatus tests
  console.log("  → [evaluateStorageStatus] Status thresholds...");
  if (evaluateStorageStatus(100, null) !== "LIMIT_NOT_CONFIGURED") throw new Error("null limit should be LIMIT_NOT_CONFIGURED");
  if (evaluateStorageStatus(100, 0) !== "LIMIT_NOT_CONFIGURED") throw new Error("0 limit should be LIMIT_NOT_CONFIGURED");
  if (evaluateStorageStatus(500, 1000) !== "HEALTHY") throw new Error("50% should be HEALTHY");
  if (evaluateStorageStatus(800, 1000) !== "NEAR_LIMIT") throw new Error("80% should be NEAR_LIMIT");
  if (evaluateStorageStatus(890, 1000) !== "NEAR_LIMIT") throw new Error("89% should be NEAR_LIMIT");
  if (evaluateStorageStatus(900, 1000) !== "CRITICAL_90") throw new Error("90% should be CRITICAL_90");
  if (evaluateStorageStatus(990, 1000) !== "CRITICAL_90") throw new Error("99% should be CRITICAL_90");
  if (evaluateStorageStatus(1000, 1000) !== "OVER_LIMIT") throw new Error("100% should be OVER_LIMIT");
  if (evaluateStorageStatus(1500, 1000) !== "OVER_LIMIT") throw new Error("150% should be OVER_LIMIT");

  console.log("  ✓ All Storage Usage & Formatting Unit Tests Passed Successfully!");
}

if (require.main === module) {
  runStorageUsageUnitTests().catch((e) => {
    console.error("Storage usage unit test failed:", e);
    process.exit(1);
  });
}
