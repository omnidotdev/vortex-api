/**
 * Self-hosted entitlements bypass tests.
 *
 * When BILLING_BASE_URL is not set (self-hosted deployments), all entitlement
 * limits must be bypassed so self-hosters get unlimited access to all features.
 *
 * The test environment leaves BILLING_BASE_URL unset, so `hasBilling` is false
 * and every function exercises its self-hosted early-return path directly, with
 * no module mocking or dependency injection required.
 */

import { describe, expect, test } from "bun:test";

import {
  checkFeatureEnabled,
  checkOrganizationLimit,
  getOrganizationTier,
  getPlanLimit,
  isExecutionAllowed,
  isWithinLimit,
} from "lib/entitlements/enforce";

describe("self-hosted entitlements (hasBilling = false)", () => {
  test("getPlanLimit returns unlimited (-1) for all features", async () => {
    const limit = await getPlanLimit("org-test", "max_workflows");
    expect(limit).toBe(-1);

    const execLimit = await getPlanLimit(
      "org-test",
      "max_executions_per_month",
    );
    expect(execLimit).toBe(-1);
  });

  test("checkFeatureEnabled returns true for all features", async () => {
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
    const allowed = await isWithinLimit(
      { organizationId: "org-test" },
      "max_workflows",
      999999,
    );
    expect(allowed).toBe(true);
  });

  test("checkOrganizationLimit returns true regardless of count", async () => {
    const allowed = await checkOrganizationLimit(
      "org-test",
      "max_workflows",
      999999,
    );
    expect(allowed).toBe(true);
  });

  test("isExecutionAllowed returns true", async () => {
    const allowed = await isExecutionAllowed("org-test");
    expect(allowed).toBe(true);
  });

  test("getOrganizationTier returns enterprise for self-hosted", async () => {
    const tier = await getOrganizationTier("org-test");
    expect(tier).toBe("enterprise");
  });
});
