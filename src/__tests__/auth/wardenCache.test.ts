/**
 * Warden authorize() cache wiring tests.
 *
 * Verifies that the authorize() wrapper caches positive/negative decisions
 * for a short TTL and that cache hits short-circuit the live Warden call.
 */

import { describe, expect, mock, test } from "bun:test";

mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://gatekeeper.test",
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  AUTHZ_API_URL: "http://warden.test",
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
  VORTEX_PUBLIC_URL: "http://localhost:4222",
  WORKER_URL: undefined,
  LOG_LEVEL: "info",
  isDevEnv: false,
  isProdEnv: false,
  protectRoutes: false,
  isAuthzEnabled: true,
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

// Stub the cache client (null forces the in-memory fallback path)
mock.module("lib/cache", () => ({
  cacheClient: null,
}));
mock.module("lib/cache/client", () => ({
  cacheClient: null,
}));

// Track how many times checkPermission is called
let checkPermissionCalls = 0;
let lastDecision = true;

mock.module("lib/warden/client", () => ({
  AUTHZ_API_URL: "http://warden.test",
  checkPermission: async () => {
    checkPermissionCalls++;
    return lastDecision;
  },
  buildPermissionCacheKey: (
    userId: string,
    resourceType: string,
    resourceId: string,
    permission: string,
  ) => `${userId}:${resourceType}:${resourceId}:${permission}`,
  getCachedPermission: async () => null,
  setCachedPermission: async () => {},
  invalidatePermissionCache: async () => {},
}));

describe("authorize() cache wiring", () => {
  test("first call hits Warden, second call uses in-memory cache", async () => {
    // Reset between tests
    checkPermissionCalls = 0;
    lastDecision = true;

    const { default: authorize } = await import("lib/warden/authorize");

    const userId = `user-${crypto.randomUUID()}`;
    const orgId = `org-${crypto.randomUUID()}`;

    const a = await authorize(userId, "organization", orgId, "member");
    expect(a).toBe(true);
    expect(checkPermissionCalls).toBe(1);

    const b = await authorize(userId, "organization", orgId, "member");
    expect(b).toBe(true);
    // Second call should hit the cache, not Warden
    expect(checkPermissionCalls).toBe(1);
  });

  test("negative decisions are cached too", async () => {
    checkPermissionCalls = 0;
    lastDecision = false;

    const { default: authorize } = await import("lib/warden/authorize");

    const userId = `user-${crypto.randomUUID()}`;
    const orgId = `org-${crypto.randomUUID()}`;

    const a = await authorize(userId, "organization", orgId, "admin");
    expect(a).toBe(false);
    expect(checkPermissionCalls).toBe(1);

    const b = await authorize(userId, "organization", orgId, "admin");
    expect(b).toBe(false);
    expect(checkPermissionCalls).toBe(1);
  });

  test("different cache keys produce independent Warden calls", async () => {
    checkPermissionCalls = 0;
    lastDecision = true;

    const { default: authorize } = await import("lib/warden/authorize");

    const userId = `user-${crypto.randomUUID()}`;
    const orgId = `org-${crypto.randomUUID()}`;

    await authorize(userId, "organization", orgId, "member");
    await authorize(userId, "organization", orgId, "admin");
    await authorize(userId, "organization", `${orgId}-other`, "member");

    // Three distinct keys => three live Warden calls
    expect(checkPermissionCalls).toBe(3);
  });
});

describe("authorize() source wiring", () => {
  test("authorize.ts imports cache helpers", async () => {
    const src = await Bun.file("src/lib/warden/authorize.ts").text();
    expect(src).toContain("getCachedPermission");
    expect(src).toContain("setCachedPermission");
    expect(src).toContain("buildPermissionCacheKey");
  });

  test("authorize.ts uses a short TTL for cached decisions", async () => {
    const src = await Bun.file("src/lib/warden/authorize.ts").text();
    // The cache TTL constant should be present and 60s as specified
    expect(src).toContain("AUTHORIZE_CACHE_TTL_SECONDS");
    expect(src).toMatch(/AUTHORIZE_CACHE_TTL_SECONDS\s*=\s*60/);
  });
});
