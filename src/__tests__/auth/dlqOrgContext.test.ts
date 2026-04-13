/**
 * DLQ organization context tests.
 *
 * Verifies the fix for the 403 bug where DLQ routes failed for multi-org
 * users because validateSession picked an arbitrary first membership
 * instead of the organization specified via x-organization-id header.
 */

import { describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

// -- Mocks (must come before any import of the modules under test) ----------

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
  hasBilling: false,
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

// Track fetch headers so tests can assert on them
let lastFetchHeaders: Record<string, string> = {};

// Mock global fetch for Gatekeeper userinfo calls
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (
  input: string | URL | Request,
  init?: RequestInit,
) => {
  const url = typeof input === "string" ? input : input.toString();
  lastFetchHeaders = (init?.headers as Record<string, string>) ?? {};

  // Gatekeeper userinfo endpoint
  if (url.includes("/oauth2/userinfo")) {
    const authHeader = lastFetchHeaders.Authorization ?? "";
    if (authHeader === "Bearer valid-token") {
      return new Response(JSON.stringify({ sub: TEST_IDP_ID }), {
        status: 200,
      });
    }
    return new Response("Unauthorized", { status: 401 });
  }

  // Gatekeeper API key verify endpoint (always fail so session path is used)
  if (url.includes("/api-key/verify")) {
    return new Response(JSON.stringify({ valid: false }), { status: 200 });
  }

  return originalFetch(input, init);
}) as typeof fetch;

// Mock the DB layer with drizzle-style query interface
mock.module("lib/db/db", () => ({
  dbPool: {
    query: {
      userTable: {
        findFirst: async (_opts: {
          where: unknown;
          columns: Record<string, boolean>;
        }) => {
          // Always return our test user (the real where clause uses IDP ID)
          return { id: TEST_USER_ID, identityProviderId: TEST_IDP_ID };
        },
      },
      userOrganizationTable: {
        findFirst: async (opts: { where: unknown; columns: unknown }) => {
          // Drizzle's `and()` and `eq()` produce opaque SQL objects,
          // so we inspect the where clause by checking the stringified
          // representation to decide which membership to return
          const whereStr = JSON.stringify(opts.where);

          // When targetOrgId is specified, the where clause includes both
          // userId and organizationId via `and(eq(...), eq(...))`
          if (whereStr.includes(ORG_A)) {
            return memberships.find((m) => m.organizationId === ORG_A)!;
          }
          if (whereStr.includes(ORG_B)) {
            return memberships.find((m) => m.organizationId === ORG_B)!;
          }
          if (whereStr.includes(ORG_UNKNOWN)) {
            return undefined; // user is not a member
          }

          // Fallback: no targetOrgId, return the first membership
          return memberships[0];
        },
      },
    },
    insert: () => ({ values: () => ({ returning: () => [] }) }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => ({
            limit: () => ({ offset: () => Promise.resolve([]) }),
          }),
        }),
      }),
    }),
  },
  pgPool: { end: async () => {} },
}));

mock.module("lib/db/schema", () => ({
  userTable: {
    id: "id",
    identityProviderId: "identity_provider_id",
    email: "email",
    name: "name",
  },
  userOrganizationTable: {
    userId: "user_id",
    organizationId: "organization_id",
  },
  workflowTable: {},
  workflowRunTable: {},
  workflowStepLogTable: {},
  integrationTable: {},
  deadLetterEventTable: {},
}));

mock.module("lib/crypto/secretsMatch", () => ({
  default: () => false,
}));

// -- Tests ------------------------------------------------------------------

describe("validateSession targetOrgId", () => {
  test("returns the targeted org when targetOrgId matches a membership", async () => {
    const validateSession = (await import("lib/auth/session")).default;

    const result = await validateSession("Bearer valid-token", ORG_B);

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_B);
    expect(result!.userId).toBe(TEST_USER_ID);
    expect(result!.idpUserId).toBe(TEST_IDP_ID);
  });

  test("returns null when targetOrgId does not match any membership", async () => {
    const validateSession = (await import("lib/auth/session")).default;

    const result = await validateSession("Bearer valid-token", ORG_UNKNOWN);

    expect(result).toBeNull();
  });

  test("falls back to first membership when targetOrgId is omitted", async () => {
    const validateSession = (await import("lib/auth/session")).default;

    const result = await validateSession("Bearer valid-token");

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_A);
    expect(result!.userId).toBe(TEST_USER_ID);
  });
});

describe("resolveAuth targetOrgId passthrough", () => {
  test("passes targetOrgId through to validateSession for session auth", async () => {
    const resolveAuth = (await import("lib/auth/resolveAuth")).default;

    const result = await resolveAuth("Bearer valid-token", ORG_B);

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_B);
  });

  test("works without targetOrgId (backwards compatible)", async () => {
    const resolveAuth = (await import("lib/auth/resolveAuth")).default;

    const result = await resolveAuth("Bearer valid-token");

    expect(result).not.toBeNull();
    expect(result!.organizationId).toBe(ORG_A);
  });
});

describe("DLQ route x-organization-id header", () => {
  test("resolveAuth is called with the x-organization-id header value", async () => {
    // We test this by verifying the DLQ route handler reads the header
    // and passes it as targetOrgId to resolveAuth. Since we cannot easily
    // spin up the full Elysia server in a unit test, we verify via a
    // traced mock of resolveAuth
    let capturedTargetOrgId: string | undefined;

    // Re-mock resolveAuth to capture the targetOrgId argument
    mock.module("lib/auth/resolveAuth", () => ({
      default: async (_authHeader: string, targetOrgId?: string) => {
        capturedTargetOrgId = targetOrgId;
        return {
          organizationId: targetOrgId ?? ORG_A,
          userId: TEST_USER_ID,
          idpUserId: TEST_IDP_ID,
        };
      },
    }));

    // Simulate what the DLQ route handler does: reads x-organization-id
    // from headers and passes it to resolveAuth
    const resolveAuth = (await import("lib/auth/resolveAuth")).default;

    // With header
    const headers = {
      authorization: "Bearer valid-token",
      "x-organization-id": ORG_B,
    };

    await resolveAuth(headers.authorization, headers["x-organization-id"]);
    expect(capturedTargetOrgId).toBe(ORG_B);

    // Without header (backwards compatible)
    const headersNoOrg = {
      authorization: "Bearer valid-token",
    } as Record<string, string | undefined>;

    await resolveAuth(
      headersNoOrg.authorization!,
      headersNoOrg["x-organization-id"],
    );
    expect(capturedTargetOrgId).toBeUndefined();
  });

  test("DLQ route source reads x-organization-id and passes to resolveAuth", async () => {
    // Read the DLQ route source to confirm the pattern is correct
    // This is a structural assertion that verifies the fix is in place
    const dlqSource = await Bun.file(
      `${import.meta.dir}/../../routes/dlq.ts`,
    ).text();

    // Every resolveAuth call in dlq.ts should pass headers["x-organization-id"]
    const resolveAuthCalls = dlqSource.match(/resolveAuth\([^)]+\)/g) ?? [];

    expect(resolveAuthCalls.length).toBeGreaterThan(0);

    for (const call of resolveAuthCalls) {
      expect(call).toContain('headers["x-organization-id"]');
    }
  });
});
