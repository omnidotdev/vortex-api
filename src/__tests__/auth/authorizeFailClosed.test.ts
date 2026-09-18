/**
 * Warden authorize fail-closed tests (P1: fail-open authz on missing config).
 *
 * Reproduces the hole where `authorize()` returned `true` when no PDP URL was
 * configured, handing every caller admin on every organization on a
 * misconfigured deploy. A missing URL must now deny.
 */

import { describe, expect, it } from "bun:test";

import authorize from "lib/warden/authorize";

describe("authorize fails closed when the PDP is not configured", () => {
  it("denies when authzApiUrl is unset", async () => {
    const allowed = await authorize(
      "user-1",
      "organization",
      "org-1",
      "admin",
      {
        authzApiUrl: undefined,
      },
    );
    expect(allowed).toBe(false);
  });

  it("still grants when the PDP is configured and returns allow", async () => {
    const allowed = await authorize(
      "user-1",
      "organization",
      "org-1",
      "admin",
      {
        authzApiUrl: "http://warden.internal",
        getCachedPermission: async () => null,
        setCachedPermission: async () => {},
        buildPermissionCacheKey: () => "k",
        checkPermission: async () => true,
      },
    );
    expect(allowed).toBe(true);
  });

  it("denies when the PDP is configured but the live check throws", async () => {
    const allowed = await authorize(
      "user-1",
      "organization",
      "org-1",
      "admin",
      {
        authzApiUrl: "http://warden.internal",
        getCachedPermission: async () => null,
        setCachedPermission: async () => {},
        buildPermissionCacheKey: () => "k",
        checkPermission: async () => {
          throw new Error("PDP unreachable");
        },
      },
    );
    expect(allowed).toBe(false);
  });
});
