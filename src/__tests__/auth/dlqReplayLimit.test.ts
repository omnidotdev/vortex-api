/**
 * DLQ replay execution-limit tests.
 *
 * Verifies that:
 *  - Single-event replay refuses when `isExecutionAllowed` returns false
 *  - Bulk replay passes the batch size to `isExecutionAllowed` so the entire
 *    fan-out is budgeted against the monthly limit
 *  - `isExecutionAllowed` itself respects an `additional` budget argument
 */

import { describe, expect, mock, test } from "bun:test";

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://gatekeeper.test",
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  AUTHZ_API_URL: undefined,
  AUTHZ_SERVICE_KEY: undefined,
  AUTHZ_WEBHOOK_SECRET: undefined,
  AUDIT_WEBHOOK_SECRET: undefined,
  AUTH_DEBUG: undefined,
  AUTH_WEBHOOK_SECRET: undefined,
  BILLING_BASE_URL: undefined,
  BILLING_SERVICE_API_KEY: undefined,
  BILLING_WEBHOOK_SECRET: undefined,
  CACHE_URL: null,
  DISCORD_OAUTH_CLIENT_ID: undefined,
  DISCORD_OAUTH_CLIENT_SECRET: undefined,
  EMAIL_WEBHOOK_SECRET: undefined,
  ENCRYPTION_KEY: undefined,
  GITHUB_OAUTH_CLIENT_ID: undefined,
  GITHUB_OAUTH_CLIENT_SECRET: undefined,
  GOOGLE_OAUTH_CLIENT_ID: undefined,
  GOOGLE_OAUTH_CLIENT_SECRET: undefined,
  GRAPHQL_MAX_COMPLEXITY_COST: "5000",
  HOST: "0.0.0.0",
  IDP_WEBHOOK_SECRET: undefined,
  INTERNAL_API_SECRET: undefined,
  NODE_ENV: "test",
  PLATFORM_ORG_ID: undefined,
  PLUGIN_STORAGE_BASE_URL: undefined,
  PLUGIN_STORAGE_BUCKET: undefined,
  PORT: "4000",
  PROTECT_ROUTES: undefined,
  SEARCH_BOOTSTRAP_WEBHOOK_SECRET: undefined,
  SLACK_OAUTH_CLIENT_ID: undefined,
  SLACK_OAUTH_CLIENT_SECRET: undefined,
  STRIPE_API_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  TEMPORAL_ADDRESS: undefined,
  TEMPORAL_NAMESPACE: undefined,
  TEMPORAL_TASK_QUEUE: undefined,
  VORTEX_PUBLIC_URL: undefined,
  WORKER_URL: undefined,
  LOG_LEVEL: "info",
  isDevEnv: false,
  isProdEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: true,
  getOAuthCredentials: () => null,
}));

mock.module("lib/logger", () => ({
  default: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  },
}));

// Track how getPlanLimit is called and stub it with a controlled limit
let stubbedRunLimit = 100;
let stubbedRunCount = 0;

mock.module("lib/db/db", () => ({
  dbPool: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [{ runCount: stubbedRunCount }],
        }),
      }),
    }),
  },
  pgPool: { end: async () => {} },
}));

mock.module("lib/providers", () => ({
  billing: {
    checkEntitlement: async () => String(stubbedRunLimit),
    getEntitlements: async () => null,
  },
}));

describe("isExecutionAllowed with additional budget", () => {
  test("returns true when current + additional is under the limit", async () => {
    stubbedRunLimit = 100;
    stubbedRunCount = 50;

    const { isExecutionAllowed } = await import("lib/entitlements/enforce");
    expect(await isExecutionAllowed("org-1", 10)).toBe(true);
  });

  test("returns false when current + additional would exceed the limit", async () => {
    stubbedRunLimit = 100;
    stubbedRunCount = 95;

    const { isExecutionAllowed } = await import("lib/entitlements/enforce");
    expect(await isExecutionAllowed("org-1", 10)).toBe(false);
  });

  test("default additional is 1 (single execution)", async () => {
    stubbedRunLimit = 100;
    stubbedRunCount = 100;

    const { isExecutionAllowed } = await import("lib/entitlements/enforce");
    // count(100) + 1 = 101 > 100 -> not allowed
    expect(await isExecutionAllowed("org-1")).toBe(false);

    stubbedRunCount = 99;
    // count(99) + 1 = 100, not > 100 -> still allowed
    expect(await isExecutionAllowed("org-1")).toBe(true);
  });

  test("returns true when limit is -1 (unlimited)", async () => {
    stubbedRunLimit = -1;
    stubbedRunCount = 9999;

    const { isExecutionAllowed } = await import("lib/entitlements/enforce");
    expect(await isExecutionAllowed("org-1", 1000)).toBe(true);
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
