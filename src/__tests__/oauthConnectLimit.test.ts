/**
 * OAuth integration connect gate tests.
 *
 * Connecting an integration over OAuth used to require the `sso_enabled`
 * entitlement, which is 0 on Free and Pro, so those plans could not connect
 * any integration over OAuth despite selling "All integrations" with 10 and
 * unlimited connected accounts. The gate is the connected-accounts limit
 * (`max_integrations`), the same one the GraphQL create path enforces
 */

import { describe, expect, it } from "bun:test";

import { FEATURE_KEYS } from "lib/entitlements/constants";
import { isIntegrationConnectAllowed } from "lib/oauth/connectLimit";

/**
 * Stub plan limits keyed by feature, mirroring the Free tier in the catalog.
 */
const planLimits =
  (limits: Record<string, number>) =>
  async (_organizationId: string, featureKey: string) =>
    limits[featureKey] ?? -1;

const FREE_TIER = {
  [FEATURE_KEYS.MAX_INTEGRATIONS]: 10,
  [FEATURE_KEYS.SSO_ENABLED]: 0,
};

const PRO_TIER = {
  [FEATURE_KEYS.MAX_INTEGRATIONS]: -1,
  [FEATURE_KEYS.SSO_ENABLED]: 0,
};

describe("isIntegrationConnectAllowed", () => {
  it("allows a Free workspace under its connected-account limit without SSO", async () => {
    const result = await isIntegrationConnectAllowed("org-free", {
      getPlanLimit: planLimits(FREE_TIER),
      countIntegrations: async () => 3,
    });

    expect(result).toEqual({ allowed: true, limit: 10, current: 3 });
  });

  it("refuses a Free workspace that has reached its connected-account limit", async () => {
    const result = await isIntegrationConnectAllowed("org-free", {
      getPlanLimit: planLimits(FREE_TIER),
      countIntegrations: async () => 10,
    });

    expect(result.allowed).toBe(false);
  });

  it("allows a Pro workspace with unlimited connected accounts", async () => {
    const result = await isIntegrationConnectAllowed("org-pro", {
      getPlanLimit: planLimits(PRO_TIER),
      countIntegrations: async () => 500,
    });

    expect(result.allowed).toBe(true);
  });

  it("reads only the connected-accounts limit, never SSO", async () => {
    const requested: string[] = [];

    await isIntegrationConnectAllowed("org-free", {
      getPlanLimit: async (_organizationId, featureKey) => {
        requested.push(featureKey);
        return 10;
      },
      countIntegrations: async () => 0,
    });

    expect(requested).toEqual([FEATURE_KEYS.MAX_INTEGRATIONS]);
  });
});

describe("OAuth routes", () => {
  const source = () => Bun.file("src/lib/oauth/routes.ts").text();

  const section = (src: string, from: string, to: string) =>
    src.slice(src.indexOf(from), src.indexOf(to));

  it("do not gate integration connect on the SSO entitlement", async () => {
    const src = await source();

    expect(src).not.toContain("SSO_ENABLED");
    expect(src).not.toContain("sso_enabled");
  });

  it("run the shared connect checks on both authorization entry points", async () => {
    const src = await source();

    const redirectRoute = section(
      src,
      '"/:provider/authorize"',
      '"/:provider/authorize-url"',
    );
    const urlRoute = section(
      src,
      '"/:provider/authorize-url"',
      '"/:provider/callback"',
    );

    expect(redirectRoute).toContain("prepareAuthorizationUrl(");
    expect(urlRoute).toContain("prepareAuthorizationUrl(");
    expect(urlRoute).toContain("{ url: result.url }");
  });

  it("re-check the connected-accounts limit in the callback before inserting", async () => {
    const src = await source();
    const callback = section(
      src,
      '"/:provider/callback"',
      '"/:provider/disconnect"',
    );

    expect(callback).toContain("isIntegrationConnectAllowed(");
    expect(callback.indexOf("isIntegrationConnectAllowed(")).toBeLessThan(
      callback.indexOf("insert(integrationTable)"),
    );
  });
});
