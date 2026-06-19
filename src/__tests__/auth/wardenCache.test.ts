/**
 * Warden authorize() cache wiring tests.
 *
 * Verifies that the authorize() wrapper caches positive/negative decisions
 * for a short TTL and that cache hits short-circuit the live Warden call.
 *
 * The live Warden call is injected via `authorize`'s deps seam (along with an
 * enabled `authzApiUrl`), so no module mocking is needed. The real in-memory
 * permission cache is exercised; fresh UUIDs per test keep cache keys disjoint.
 */

import { describe, expect, test } from "bun:test";

import authorize from "lib/warden/authorize";

const AUTHZ_API_URL = "http://warden.test";

/** Build a checkPermission spy that records calls and returns a fixed decision */
const spyCheck = (decision: boolean) => {
  let calls = 0;
  const checkPermission = async () => {
    calls++;
    return decision;
  };
  return { checkPermission, getCalls: () => calls };
};

describe("authorize() cache wiring", () => {
  test("first call hits Warden, second call uses in-memory cache", async () => {
    const { checkPermission, getCalls } = spyCheck(true);

    const userId = `user-${crypto.randomUUID()}`;
    const orgId = `org-${crypto.randomUUID()}`;

    const a = await authorize(userId, "organization", orgId, "member", {
      authzApiUrl: AUTHZ_API_URL,
      checkPermission,
    });
    expect(a).toBe(true);
    expect(getCalls()).toBe(1);

    const b = await authorize(userId, "organization", orgId, "member", {
      authzApiUrl: AUTHZ_API_URL,
      checkPermission,
    });
    expect(b).toBe(true);
    // Second call should hit the cache, not Warden
    expect(getCalls()).toBe(1);
  });

  test("negative decisions are cached too", async () => {
    const { checkPermission, getCalls } = spyCheck(false);

    const userId = `user-${crypto.randomUUID()}`;
    const orgId = `org-${crypto.randomUUID()}`;

    const a = await authorize(userId, "organization", orgId, "admin", {
      authzApiUrl: AUTHZ_API_URL,
      checkPermission,
    });
    expect(a).toBe(false);
    expect(getCalls()).toBe(1);

    const b = await authorize(userId, "organization", orgId, "admin", {
      authzApiUrl: AUTHZ_API_URL,
      checkPermission,
    });
    expect(b).toBe(false);
    expect(getCalls()).toBe(1);
  });

  test("different cache keys produce independent Warden calls", async () => {
    const { checkPermission, getCalls } = spyCheck(true);

    const userId = `user-${crypto.randomUUID()}`;
    const orgId = `org-${crypto.randomUUID()}`;
    const deps = { authzApiUrl: AUTHZ_API_URL, checkPermission };

    await authorize(userId, "organization", orgId, "member", deps);
    await authorize(userId, "organization", orgId, "admin", deps);
    await authorize(userId, "organization", `${orgId}-other`, "member", deps);

    // Three distinct keys => three live Warden calls
    expect(getCalls()).toBe(3);
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
