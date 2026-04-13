import { describe, expect, it, mock } from "bun:test";

import { SafeError } from "postgraphile/grafast";

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

mock.module("lib/db/db", () => ({
  dbPool: {},
  pgPool: { end: async () => {} },
}));

mock.module("lib/providers", () => ({
  billing: {},
}));

const { assertUnderLimit } = await import("lib/entitlements/enforce");

describe("assertUnderLimit", () => {
  it("should throw SafeError when count meets limit", () => {
    expect(() => assertUnderLimit(5, 5, "workflows")).toThrow(SafeError);
  });

  it("should throw SafeError when count exceeds limit", () => {
    expect(() => assertUnderLimit(5, 10, "workflows")).toThrow(SafeError);
  });

  it("should include count and limit in error message", () => {
    try {
      assertUnderLimit(5, 10, "workflows");
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect((err as Error).message).toContain("10/5");
      expect((err as Error).message).toContain("Upgrade your plan");
    }
  });

  it("should not throw when count is under limit", () => {
    expect(() => assertUnderLimit(5, 2, "workflows")).not.toThrow();
  });

  it("should not throw when limit is -1 (unlimited)", () => {
    expect(() => assertUnderLimit(-1, 999, "workflows")).not.toThrow();
  });

  it("should not throw when count is 0", () => {
    expect(() => assertUnderLimit(5, 0, "workflows")).not.toThrow();
  });
});
