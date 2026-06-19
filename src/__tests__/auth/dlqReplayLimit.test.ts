/**
 * DLQ replay execution-limit tests.
 *
 * Verifies that:
 *  - Single-event replay refuses when `isExecutionAllowed` returns false
 *  - Bulk replay passes the batch size to `isExecutionAllowed` so the entire
 *    fan-out is budgeted against the monthly limit
 *  - `isExecutionAllowed` itself respects an `additional` budget argument
 */

import { describe, expect, test } from "bun:test";

import { isExecutionAllowed } from "lib/entitlements/enforce";

import type { dbPool } from "lib/db/db";

// Controlled plan limit and run count, injected into isExecutionAllowed via its
// deps seam (billing enabled, with a fake db and a stubbed plan limit) so the
// metered path is exercised without mocking modules
let stubbedRunLimit = 100;
let stubbedRunCount = 0;

/** Deps overriding the billing flag, database, and plan limit */
const deps = () => ({
  hasBilling: true,
  // Fake drizzle chain returning the stubbed monthly run count
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ runCount: stubbedRunCount }],
        }),
      }),
    }),
  } as unknown as typeof dbPool,
  getPlanLimit: async () => stubbedRunLimit,
});

describe("isExecutionAllowed with additional budget", () => {
  test("returns true when current + additional is under the limit", async () => {
    stubbedRunLimit = 100;
    stubbedRunCount = 50;

    expect(await isExecutionAllowed("org-1", 10, deps())).toBe(true);
  });

  test("returns false when current + additional would exceed the limit", async () => {
    stubbedRunLimit = 100;
    stubbedRunCount = 95;

    expect(await isExecutionAllowed("org-1", 10, deps())).toBe(false);
  });

  test("single execution (additional = 1) is bounded at the limit", async () => {
    stubbedRunLimit = 100;
    stubbedRunCount = 100;

    // count(100) + 1 = 101 > 100 -> not allowed
    expect(await isExecutionAllowed("org-1", 1, deps())).toBe(false);

    stubbedRunCount = 99;
    // count(99) + 1 = 100, not > 100 -> still allowed
    expect(await isExecutionAllowed("org-1", 1, deps())).toBe(true);
  });

  test("returns true when limit is -1 (unlimited)", async () => {
    stubbedRunLimit = -1;
    stubbedRunCount = 9999;

    expect(await isExecutionAllowed("org-1", 1000, deps())).toBe(true);
  });
});

describe("DLQ route source enforcement", () => {
  test("dlq.ts imports isExecutionAllowed", async () => {
    const src = await Bun.file("src/routes/dlq.ts").text();
    expect(src).toContain("isExecutionAllowed");
  });

  test("single replay handler calls isExecutionAllowed before publishing", async () => {
    const src = await Bun.file("src/routes/dlq.ts").text();
    const handlerStart = src.indexOf('"/:id/replay"');
    expect(handlerStart).toBeGreaterThan(-1);

    // Find the publish call within the replay handler
    const handler = src.slice(handlerStart);
    const publishIdx = handler.indexOf("eventsClient.publish");
    const isAllowedIdx = handler.indexOf("isExecutionAllowed");

    expect(isAllowedIdx).toBeGreaterThan(-1);
    expect(publishIdx).toBeGreaterThan(-1);
    expect(isAllowedIdx).toBeLessThan(publishIdx);
  });

  test("bulk replay passes the event count to isExecutionAllowed", async () => {
    const src = await Bun.file("src/routes/dlq.ts").text();
    // The bulk replay handler should pass `events.length` (the batch size)
    // to isExecutionAllowed so the whole replay is budgeted at once
    expect(src).toMatch(
      /isExecutionAllowed\(\s*organizationId,\s*events\.length\s*\)/,
    );
  });

  test("bulk replay records rejected_executions with the batch size", async () => {
    const src = await Bun.file("src/routes/dlq.ts").text();
    // When the limit is exceeded, the bulk endpoint should attribute the
    // full batch count to rejected_executions (not just 1)
    expect(src).toMatch(/"rejected_executions",\s*events\.length/);
  });
});
