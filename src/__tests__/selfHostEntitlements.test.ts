/**
 * Self-hosted entitlements bypass tests.
 *
 * When BILLING_BASE_URL is not set (self-hosted deployments),
 * all entitlement limits must be bypassed so self-hosters
 * get unlimited access to all features.
 */

import { describe, expect, mock, test } from "bun:test";

// Mock env config with hasBilling = false (self-hosted scenario)
mock.module("lib/config/env.config", () => ({
  DATABASE_URL: "postgres://test",
  AUTH_BASE_URL: "http://gatekeeper.test",
  BILLING_BASE_URL: undefined,
  BILLING_SERVICE_API_KEY: undefined,
  AUTHZ_API_URL: undefined,
  AUTHZ_SERVICE_KEY: undefined,
  INTERNAL_API_SECRET: undefined,
  CORS_ALLOWED_ORIGINS: "*",
  HATCHET_CLIENT_TOKEN: "test-token",
  LOG_LEVEL: "info",
  isProdEnv: false,
  isDevEnv: false,
  protectRoutes: false,
  isAuthzEnabled: false,
  hasBilling: false,
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
  dbPool: {
    query: {},
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve([{ runCount: 999 }]),
        }),
        where: () => Promise.resolve([{ count: 999 }]),
      }),
    }),
  },
}));

mock.module("lib/db/schema", () => ({
  workflowTable: { id: "id", organizationId: "organization_id" },
  workflowRunTable: {
    workflowId: "workflow_id",
    startedAt: "started_at",
  },
}));

mock.module("lib/providers", () => ({
  billing: {
    checkEntitlement: async () => {
      throw new Error("Billing provider should not be called in self-hosted");
    },
    getEntitlements: async () => {
      throw new Error("Billing provider should not be called in self-hosted");
    },
  },
}));

describe("self-hosted entitlements (hasBilling = false)", () => {
  test("getPlanLimit returns unlimited (-1) for all features", async () => {
    const { getPlanLimit } = await import("lib/entitlements/enforce");

    const limit = await getPlanLimit("org-test", "max_workflows");
    expect(limit).toBe(-1);

    const execLimit = await getPlanLimit(
      "org-test",
      "max_executions_per_month",
    );
    expect(execLimit).toBe(-1);
  });

  test("checkFeatureEnabled returns true for all features", async () => {
    const { checkFeatureEnabled } = await import("lib/entitlements/enforce");

    const ssoEnabled = await checkFeatureEnabled("org-test", "sso_enabled");
    expect(ssoEnabled).toBe(true);

    const customPlugins = await checkFeatureEnabled(
      "org-test",
      "custom_plugins",
    );
    expect(customPlugins).toBe(true);

    const auditLogs = await checkFeatureEnabled("org-test", "audit_logs");
    expect(auditLogs).toBe(true);
  });

  test("isWithinLimit returns true regardless of count", async () => {
    const { isWithinLimit } = await import("lib/entitlements/enforce");

    const allowed = await isWithinLimit(
      { organizationId: "org-test" },
      "max_workflows",
      999999,
    );
    expect(allowed).toBe(true);
  });

  test("checkOrganizationLimit returns true regardless of count", async () => {
    const { checkOrganizationLimit } = await import("lib/entitlements/enforce");

    const allowed = await checkOrganizationLimit(
      "org-test",
      "max_workflows",
      999999,
    );
    expect(allowed).toBe(true);
  });

  test("isExecutionAllowed returns true", async () => {
    const { isExecutionAllowed } = await import("lib/entitlements/enforce");

    const allowed = await isExecutionAllowed("org-test");
    expect(allowed).toBe(true);
  });

  test("getOrganizationTier returns enterprise for self-hosted", async () => {
    const { getOrganizationTier } = await import("lib/entitlements/enforce");

    const tier = await getOrganizationTier("org-test");
    expect(tier).toBe("enterprise");
  });
});
