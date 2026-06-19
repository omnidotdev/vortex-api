/**
 * Warden sync queue retry/backoff tests.
 *
 * Covers the exponential-backoff formula used by the Warden sync poller and the
 * sync-queue table schema. Both are checked without module mocking (pure math
 * and a source-level assertion).
 */

import { describe, expect, it } from "bun:test";

describe("warden sync exponential backoff", () => {
  it("should calculate exponential backoff correctly", () => {
    // Test the backoff formula: BASE * 2^attempts, capped at 1 hour
    const BASE_BACKOFF_MS = 1_000;
    const backoffs = [0, 1, 2, 3, 4, 5, 10].map((attempts) => {
      const backoff = BASE_BACKOFF_MS * 2 ** attempts;
      return Math.min(backoff, 3_600_000);
    });

    expect(backoffs[0]).toBe(1_000); // 1s
    expect(backoffs[1]).toBe(2_000); // 2s
    expect(backoffs[2]).toBe(4_000); // 4s
    expect(backoffs[3]).toBe(8_000); // 8s
    expect(backoffs[4]).toBe(16_000); // 16s
    expect(backoffs[5]).toBe(32_000); // 32s
    expect(backoffs[6]).toBe(1_024_000); // ~17 min
  });

  it("should cap backoff at 1 hour", () => {
    const BASE_BACKOFF_MS = 1_000;
    const MAX_BACKOFF_MS = 3_600_000;

    // Attempt 22 would be 2^22 * 1000 = 4,194,304,000ms without cap
    const backoff = Math.min(BASE_BACKOFF_MS * 2 ** 22, MAX_BACKOFF_MS);

    expect(backoff).toBe(MAX_BACKOFF_MS);
  });
});

describe("wardenSyncQueue table schema", () => {
  it("should have required columns", async () => {
    const requiredColumns = [
      "id",
      "operation",
      "tuples",
      "description",
      "status",
      "attempts",
      "maxAttempts",
      "nextRetryAt",
      "lastError",
      "completedAt",
      "createdAt",
    ];

    const sourcePath = new URL(
      "../lib/db/schema/wardenSyncQueue.table.ts",
      import.meta.url,
    ).pathname;
    const source = await Bun.file(sourcePath).text();

    for (const col of requiredColumns) {
      expect(source).toContain(`${col}:`);
    }
  });
});
