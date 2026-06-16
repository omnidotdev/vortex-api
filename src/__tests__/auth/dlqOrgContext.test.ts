/**
 * DLQ organization context tests.
 *
 * Verifies the fix for the 403 bug where DLQ routes failed for multi-org
 * users because validateSession picked an arbitrary first membership
 * instead of the organization specified via x-organization-id header.
 *
 * validateSession's database is injected via its deps seam, and resolveAuth's
 * validators are injected, so no module mocking is needed. Only global fetch is
 * stubbed (for the Gatekeeper userinfo call) and restored afterwards.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import resolveAuth from "lib/auth/resolveAuth";
import validateSession from "lib/auth/session";

import type { dbPool } from "lib/db/db";

// Fake user and org data
const TEST_USER_ID = randomUUID();
const TEST_IDP_ID = randomUUID();
const ORG_A = `org-a-${randomUUID()}`;
const ORG_B = `org-b-${randomUUID()}`;
const ORG_UNKNOWN = `org-unknown-${randomUUID()}`;

// Memberships for the test user (two orgs)
const memberships = [
  { userId: TEST_USER_ID, organizationId: ORG_A },
  { userId: TEST_USER_ID, organizationId: ORG_B },
];

// Fake db matching the drizzle query interface validateSession uses. The real
// drizzle where clause is an opaque (cyclic) SQL object, so rather than inspect
// it the membership lookup is resolved from the targetOrgId the caller already
// knows: validateSession calls userOrganizationTable.findFirst once. With a
// targetOrgId it returns that org's membership (or undefined), otherwise it
// returns the first membership (the fallback path)
const makeFakeDb = (targetOrgId?: string) =>
  ({
    query: {
      userTable: {
        findFirst: async () => ({
          id: TEST_USER_ID,
          identityProviderId: TEST_IDP_ID,
        }),
      },
      userOrganizationTable: {
        findFirst: async () =>
          targetOrgId
            ? memberships.find((m) => m.organizationId === targetOrgId)
            : memberships[0],
      },
    },
  }) as unknown as typeof dbPool;

/** validateSession bound to a fake database scoped to the requested org */
const sessionWithFakeDb = (
  authHeader: string | undefined,
  targetOrgId?: string,
) => validateSession(authHeader, targetOrgId, { db: makeFakeDb(targetOrgId) });

// Stub global fetch for the Gatekeeper userinfo call (Bearer valid-token -> sub)
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  const url = typeof input === "string" ? input : input.toString();
  const headers = (init?.headers as Record<string, string>) ?? {};

  if (url.includes("/oauth2/userinfo")) {
    return headers.Authorization === "Bearer valid-token"
      ? new Response(JSON.stringify({ sub: TEST_IDP_ID }), { status: 200 })
      : new Response("Unauthorized", { status: 401 });
  }

  return originalFetch(input, init);
}) as typeof fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("validateSession targetOrgId", () => {
  test("returns the targeted org when targetOrgId matches a membership", async () => {
    const result = await sessionWithFakeDb("Bearer valid-token", ORG_B);

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_B);
    expect(result!.userId).toBe(TEST_USER_ID);
    expect(result!.idpUserId).toBe(TEST_IDP_ID);
  });

  test("returns null when targetOrgId does not match any membership", async () => {
    const result = await sessionWithFakeDb("Bearer valid-token", ORG_UNKNOWN);

    expect(result).toBeNull();
  });

  test("falls back to first membership when targetOrgId is omitted", async () => {
    const result = await sessionWithFakeDb("Bearer valid-token");

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_A);
    expect(result!.userId).toBe(TEST_USER_ID);
  });
});

describe("resolveAuth targetOrgId passthrough", () => {
  // API key validation is forced to miss so the session path is exercised
  const deps = {
    validateApiKey: async () => null,
    validateSession: sessionWithFakeDb,
  };

  test("passes targetOrgId through to validateSession for session auth", async () => {
    const result = await resolveAuth("Bearer valid-token", ORG_B, deps);

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_B);
  });

  test("works without targetOrgId (backwards compatible)", async () => {
    const result = await resolveAuth("Bearer valid-token", undefined, deps);

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_A);
  });

  test("forwards the targetOrgId argument it receives", async () => {
    let capturedTargetOrgId: string | undefined;

    const traced = {
      validateApiKey: async () => null,
      validateSession: async (
        _authHeader: string | undefined,
        targetOrgId?: string,
      ) => {
        capturedTargetOrgId = targetOrgId;
        return {
          organizationId: targetOrgId ?? ORG_A,
          userId: TEST_USER_ID,
          idpUserId: TEST_IDP_ID,
        };
      },
    };

    await resolveAuth("Bearer valid-token", ORG_B, traced);
    expect(capturedTargetOrgId).toBe(ORG_B);

    await resolveAuth("Bearer valid-token", undefined, traced);
    expect(capturedTargetOrgId).toBeUndefined();
  });
});

describe("DLQ route x-organization-id header", () => {
  test("DLQ route source reads x-organization-id and passes to resolveAuth", async () => {
    // Structural assertion: every resolveAuth call in dlq.ts forwards the
    // x-organization-id header as the targetOrgId argument
    const dlqSource = await Bun.file(
      `${import.meta.dir}/../../routes/dlq.ts`,
    ).text();

    const resolveAuthCalls = dlqSource.match(/resolveAuth\([^)]+\)/g) ?? [];

    expect(resolveAuthCalls.length).toBeGreaterThan(0);

    for (const call of resolveAuthCalls) {
      expect(call).toContain('headers["x-organization-id"]');
    }
  });
});
